#!/usr/bin/env bash
# ============================================================
# cnb-watcher.sh — 服务器侧主动拉取 cnb.cool 并部署
# 设计目的：取代 "GitHub Actions 直连 ssh 推服务器" 的部署方式，
#           规避腾讯云安全组对 CI 临时入站 IP 的拦截（纯出站轮询）。
# 部署主源：cnb.cool 的 aibak.site/ai-agent-platform (main)
# 调用方式：由 systemd timer 或 cron 每分钟执行一次
#           例: * * * * * root /opt/ai-agent-platform/deploy/cnb-watcher.sh
# ============================================================
set -uo pipefail

GIT_DIR=/opt/ai-agent-platform.git
GIT_WORK_TREE=/opt/ai-agent-platform
REPO_URL="https://cnb.cool/aibak.site/ai-agent-platform.git"
STATE_FILE=/opt/.cnb-deploy-sha
LOG=/var/log/cnb-watcher.log

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# 所有 git 操作都指向服务器裸仓库 + 工作树
git() { command git --git-dir="$GIT_DIR" --work-tree="$GIT_WORK_TREE" "$@"; }

# 1) 取 cnb.cool main 最新 SHA（公开仓库匿名可读，纯出站，不受安全组入站限制）
REMOTE_SHA=$(git ls-remote "$REPO_URL" HEAD 2>/dev/null | awk '{print $1}')
if [ -z "$REMOTE_SHA" ]; then
  log "无法获取 cnb.cool HEAD，跳过本轮"
  exit 0
fi

DEPLOYED_SHA=$(cat "$STATE_FILE" 2>/dev/null || echo "")

# 2) 无变化则直接退出（轮询零成本）
if [ "$REMOTE_SHA" = "$DEPLOYED_SHA" ]; then
  exit 0
fi

log "检测到新版本 $REMOTE_SHA (当前已部署 $DEPLOYED_SHA)，开始拉取部署"

# 3) 确保 cnb remote 存在并拉取
git remote get-url cnb >/dev/null 2>&1 || git remote add cnb "$REPO_URL"
git fetch cnb main >>"$LOG" 2>&1
git checkout -f main >>"$LOG" 2>&1
git reset --hard cnb/main >>"$LOG" 2>&1

# 4) 记录已部署版本，避免重复部署
echo "$REMOTE_SHA" > "$STATE_FILE"

# 5) 触发一键部署（后台执行，日志复用既有部署日志）
log "代码已更新至 $REMOTE_SHA，触发 push-deploy"
nohup bash "$GIT_WORK_TREE/deploy/push-deploy.sh" >>/var/log/ai-platform-deploy.log 2>&1 &

log "本轮部署已异步启动"
