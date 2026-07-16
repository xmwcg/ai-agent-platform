#!/usr/bin/env bash
# ============================================================
# cnb-watcher.sh — 服务器侧主动拉取 cnb.cool 并部署（加固版）
# 设计目的：取代 "GitHub Actions 直连 ssh 推服务器" 的部署方式，
#           规避腾讯云安全组对 CI 临时入站 IP 的拦截（纯出站轮询）。
# 部署主源：cnb.cool 的 aibak.site/ai-agent-platform (main)
# 调用方式：由 systemd timer 或 cron 每分钟执行一次
#           例: * * * * * root /opt/ai-agent-platform/deploy/cnb-watcher.sh
#
# 关键改进（修复"推了代码却没上线"）：
#  1) 加 flock 锁，防止 cron 每分钟重叠触发导致并发踩踏。
#  2) STATE_FILE 仅在「部署成功 + 健康检查通过」后才写入；
#     任一环节失败都保留 FAIL_FILE 标记 → 下一轮轮询自动重试，
#     不再把"假成功"记为已部署而静默卡死。
#  3) 部署后置健康检查：/api/health 与 /api/sandbox/status 必须返回 200。
# ============================================================
set -uo pipefail

GIT_DIR=/opt/ai-agent-platform.git
GIT_WORK_TREE=/opt/ai-agent-platform
REPO_URL="https://cnb.cool/aibak.site/ai-agent-platform.git"
STATE_FILE=/opt/.cnb-deploy-sha
FAIL_FILE=/opt/.cnb-deploy-failed
LOCK_FILE=/opt/.cnb-watcher.lock
LOG=/var/log/cnb-watcher.log
HEALTH_URL="http://127.0.0.1:3000"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# 单实例锁：已有 watcher 在跑则跳过本轮，避免重叠
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "已有 watcher 运行中，跳过本轮"
  exit 0
fi

git() { command git --git-dir="$GIT_DIR" --work-tree="$GIT_WORK_TREE" "$@"; }

# 1) 取 cnb.cool main 最新 SHA（公开仓库匿名可读，纯出站，不受安全组入站限制）
REMOTE_SHA=$(git ls-remote "$REPO_URL" HEAD 2>/dev/null | awk '{print $1}')
if [ -z "$REMOTE_SHA" ]; then
  log "无法获取 cnb.cool HEAD，跳过本轮"
  exit 0
fi

DEPLOYED_SHA=$(cat "$STATE_FILE" 2>/dev/null || echo "")

# 2) 已部署且健康检查通过 → 跳过；存在失败标记 → 强制重试一次
if [ "$REMOTE_SHA" = "$DEPLOYED_SHA" ]; then
  if [ ! -f "$FAIL_FILE" ]; then
    exit 0
  fi
  log "检测到失败标记，重新尝试部署 $REMOTE_SHA"
fi

log "检测到新版本 $REMOTE_SHA (当前已部署 $DEPLOYED_SHA)，开始拉取部署"

# 3) 拉取并检出
git remote get-url cnb >/dev/null 2>&1 || git remote add cnb "$REPO_URL"
git fetch cnb main >>"$LOG" 2>&1 || { log "fetch 失败"; touch "$FAIL_FILE"; exit 1; }
git checkout -f main >>"$LOG" 2>&1 || { log "checkout 失败"; touch "$FAIL_FILE"; exit 1; }
git reset --hard cnb/main >>"$LOG" 2>&1 || { log "reset 失败"; touch "$FAIL_FILE"; exit 1; }

# 4) 触发一键部署（同步等待，脚本内部已含 docker 健康检查）
log "代码已更新至 $REMOTE_SHA，触发 push-deploy"
if ! bash "$GIT_WORK_TREE/deploy/push-deploy.sh" >>/var/log/ai-platform-deploy.log 2>&1; then
  log "push-deploy 失败（构建/部署未通过），保留失败标记以便重试"
  touch "$FAIL_FILE"
  exit 1
fi

# 5) 后置健康检查门禁：接口必须真正可用才算上线
OK=0
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL/api/health" >/dev/null 2>&1 && \
     curl -fsS "$HEALTH_URL/api/sandbox/status" >/dev/null 2>&1; then
    OK=1; break
  fi
  sleep 2
done

if [ "$OK" -eq 1 ]; then
  echo "$REMOTE_SHA" > "$STATE_FILE"   # 仅成功才写，保证"已部署=真可用"
  rm -f "$FAIL_FILE"
  log "部署成功并通过健康检查，已记录 $REMOTE_SHA"
else
  log "部署进程完成但健康检查未通过，标记为失败以便重试"
  touch "$FAIL_FILE"
  exit 1
fi
