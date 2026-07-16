#!/usr/bin/env bash
# ============================================================
# 服务器侧 CNB 生产发布 watcher
# - 仅监听通过 CNB 质量门禁后晋级的 deploy/production 分支
# - 同步执行部署与健康验收，成功后才更新 STATE_FILE
# - 失败自动重试；若新版本已影响运行态，自动回滚到上一成功版本
# - 同一坏版本进入冷却期，避免 systemd timer 每分钟重复昂贵构建
# ============================================================
set -Eeuo pipefail

GIT_DIR=${GIT_DIR:-/opt/ai-agent-platform.git}
GIT_WORK_TREE=${GIT_WORK_TREE:-/opt/ai-agent-platform}
REPO_URL=${REPO_URL:-https://cnb.cool/aibak.site/ai-agent-platform.git}
RELEASE_BRANCH=${RELEASE_BRANCH:-deploy/production}
STATE_FILE=${STATE_FILE:-/opt/.cnb-deploy-sha}
FAILED_STATE_FILE=${FAILED_STATE_FILE:-/opt/.cnb-deploy-failed}
LOG=${LOG:-/var/log/cnb-watcher.log}
DEPLOY_LOG=${DEPLOY_LOG:-/var/log/ai-platform-deploy.log}
LOCK_FILE=${LOCK_FILE:-/run/lock/cnb-watcher.lock}
PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-https://aibak.site}
MAX_ATTEMPTS=${MAX_ATTEMPTS:-3}
RETRY_DELAY_SECONDS=${RETRY_DELAY_SECONDS:-30}
FAILED_RETRY_COOLDOWN_SECONDS=${FAILED_RETRY_COOLDOWN_SECONDS:-900}
VERIFY_TIMEOUT_SECONDS=${VERIFY_TIMEOUT_SECONDS:-180}
VERIFY_SCRIPT=${VERIFY_SCRIPT:-/usr/local/lib/aibak-deploy/verify-release.mjs}

mkdir -p \
  "$(dirname "$STATE_FILE")" \
  "$(dirname "$FAILED_STATE_FILE")" \
  "$(dirname "$LOG")" \
  "$(dirname "$LOCK_FILE")"
touch "$LOG" "$DEPLOY_LOG"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

notify_failure() {
  local message=$1
  log "ALERT: $message"
  if [ -n "${DEPLOY_ALERT_WEBHOOK:-}" ]; then
    curl -fsS -m 10 -X POST \
      -H 'Content-Type: application/json' \
      --data "{\"text\":\"${message//\"/\\\"}\"}" \
      "$DEPLOY_ALERT_WEBHOOK" >>"$LOG" 2>&1 || log "告警 Webhook 发送失败"
  fi
}

write_state_file() {
  local path=$1
  local value=$2
  local tmp="${path}.tmp.$$"
  printf '%s\n' "$value" >"$tmp"
  mv -f "$tmp" "$path"
}

# 防止 systemd timer/cron 重叠执行。
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "已有部署任务运行，本轮跳过"
  exit 0
fi

repo_git() {
  command git --git-dir="$GIT_DIR" --work-tree="$GIT_WORK_TREE" "$@"
}

remote_release_sha() {
  repo_git ls-remote "$REPO_URL" "refs/heads/$RELEASE_BRANCH" 2>/dev/null | awk '{print $1}'
}

checkout_release() {
  local sha=$1
  repo_git remote get-url cnb >/dev/null 2>&1 || repo_git remote add cnb "$REPO_URL" || return 1
  repo_git fetch --prune cnb "$RELEASE_BRANCH" >>"$LOG" 2>&1 || return 1
  repo_git cat-file -e "${sha}^{commit}" >>"$LOG" 2>&1 || return 1
  repo_git checkout -f main >>"$LOG" 2>&1 || return 1
  repo_git reset --hard "$sha" >>"$LOG" 2>&1 || return 1
}

verify_release() {
  local sha=$1
  local script=$VERIFY_SCRIPT
  [ -f "$script" ] || script="$GIT_WORK_TREE/deploy/verify-release.mjs"
  node "$script" \
    --base-url http://127.0.0.1:3000 \
    --expected-sha "$sha" \
    --timeout-seconds "$VERIFY_TIMEOUT_SECONDS" \
    --interval-seconds 5 >>"$DEPLOY_LOG" 2>&1 || return 1

  node "$script" \
    --base-url "$PUBLIC_BASE_URL" \
    --expected-sha "$sha" \
    --timeout-seconds 60 \
    --interval-seconds 5 >>"$DEPLOY_LOG" 2>&1 || return 1
}

deploy_sha() {
  local sha=$1
  checkout_release "$sha" || return 1
  log "开始部署 $sha"
  (
    export APP_COMMIT_SHA="$sha"
    export DEPLOY_RUN_TESTS=1
    bash "$GIT_WORK_TREE/deploy/push-deploy.sh"
  ) >>"$DEPLOY_LOG" 2>&1 || return 1
  verify_release "$sha" || return 1
}

verify_rollback() {
  local url
  for url in "http://127.0.0.1:3000/api/health" "$PUBLIC_BASE_URL/api/health"; do
    curl -fsS --max-time 15 "$url" >/dev/null || return 1
  done
}

rollback_to() {
  local sha=$1
  if [ -z "$sha" ]; then
    notify_failure "没有上一成功版本可回滚，请立即人工检查"
    return 1
  fi

  log "回滚到上一成功版本 $sha"
  repo_git cat-file -e "${sha}^{commit}" >>"$LOG" 2>&1 || return 1
  repo_git reset --hard "$sha" >>"$LOG" 2>&1 || return 1
  (
    export APP_COMMIT_SHA="$sha"
    export DEPLOY_RUN_TESTS=
    bash "$GIT_WORK_TREE/deploy/push-deploy.sh"
  ) >>"$DEPLOY_LOG" 2>&1 || return 1
  # 首次启用本方案时，上一版本可能尚未暴露 revision 或公开 sandbox/status，
  # 因此回滚只验证内外网核心健康接口可达。后续版本仍由完整验收保护。
  verify_rollback || return 1
  log "回滚验收通过: $sha"
}

REMOTE_SHA=$(remote_release_sha || true)
if [ -z "$REMOTE_SHA" ]; then
  log "无法获取 CNB $RELEASE_BRANCH，跳过本轮"
  exit 0
fi

DEPLOYED_SHA=$(cat "$STATE_FILE" 2>/dev/null || true)
if [ "$REMOTE_SHA" = "$DEPLOYED_SHA" ]; then
  rm -f "$FAILED_STATE_FILE"
  exit 0
fi

FAILED_SHA=''
FAILED_AT=''
if [ -f "$FAILED_STATE_FILE" ]; then
  read -r FAILED_SHA FAILED_AT <"$FAILED_STATE_FILE" || true
fi

if [ "$FAILED_SHA" = "$REMOTE_SHA" ] && [[ "$FAILED_AT" =~ ^[0-9]+$ ]]; then
  NOW=$(date +%s)
  ELAPSED=$((NOW - FAILED_AT))
  if [ "$ELAPSED" -lt "$FAILED_RETRY_COOLDOWN_SECONDS" ]; then
    REMAINING=$((FAILED_RETRY_COOLDOWN_SECONDS - ELAPSED))
    log "版本 $REMOTE_SHA 已连续部署失败，冷却期剩余 ${REMAINING}s，本轮跳过"
    exit 0
  fi
else
  rm -f "$FAILED_STATE_FILE"
fi

log "发现待发布版本 $REMOTE_SHA（当前成功版本 ${DEPLOYED_SHA:-none}）"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  log "部署尝试 $attempt/$MAX_ATTEMPTS"
  if deploy_sha "$REMOTE_SHA"; then
    write_state_file "$STATE_FILE" "$REMOTE_SHA"
    rm -f "$FAILED_STATE_FILE"
    log "部署成功并写入状态: $REMOTE_SHA"
    exit 0
  fi

  log "新版本部署或验收失败: $REMOTE_SHA"
  if [ -n "$DEPLOYED_SHA" ]; then
    if ! rollback_to "$DEPLOYED_SHA"; then
      notify_failure "部署 $REMOTE_SHA 失败，且回滚 $DEPLOYED_SHA 也失败"
      exit 1
    fi
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    log "${RETRY_DELAY_SECONDS}s 后重试新版本"
    sleep "$RETRY_DELAY_SECONDS"
  fi
done

write_state_file "$FAILED_STATE_FILE" "$REMOTE_SHA $(date +%s)"
notify_failure "部署 $REMOTE_SHA 连续失败 $MAX_ATTEMPTS 次；当前保持版本 ${DEPLOYED_SHA:-unknown}，已进入 ${FAILED_RETRY_COOLDOWN_SECONDS}s 冷却期"
exit 1
