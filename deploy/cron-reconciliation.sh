#!/usr/bin/env bash
# ============================================================
# AIbak 每日自动对账 Cron 脚本
# 每天 08:00 执行对账，结果写入 ReconciliationRecord
# 差异自动重试后仍不匹配的记录触发告警
# ============================================================
set -Eeuo pipefail

API_BASE=${API_BASE:-http://127.0.0.1:3000}
ADMIN_API_KEY=${ADMIN_API_KEY:-}
LOG_FILE=${LOG_FILE:-/var/log/aibak-reconciliation.log}
LOCK_FILE=${LOCK_FILE:-/run/lock/aibak-reconciliation.lock}

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "已有对账任务运行，跳过"
  exit 0
fi

log "开始每日自动对账"

AUTH_HEADER=""
if [ -n "$ADMIN_API_KEY" ]; then
  AUTH_HEADER="-H Authorization: Bearer $ADMIN_API_KEY"
fi

RESPONSE=$(curl -fsS --max-time 60 -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  $AUTH_HEADER \
  "$API_BASE/api/reconciliation/trigger" 2>&1) || {
  log "对账接口调用失败: $RESPONSE"
  exit 1
}

BATCH_ID=$(echo "$RESPONSE" | grep -o '"batchId":"[^"]*"' | head -1 | sed 's/"batchId":"\(.*\)"/\1/' || echo "unknown")
STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"\(.*\)"/\1/' || echo "unknown")
UNMATCHED=$(echo "$RESPONSE" | grep -o '"unmatchedOrders":[0-9]*' | head -1 | sed 's/"unmatchedOrders":\(.*\)/\1/' || echo "0")

if [ "$STATUS" = "matched" ]; then
  log "批次 $BATCH_ID: 对账完全匹配 ✅"
elif [ "$STATUS" = "partial" ] || [ "$UNMATCHED" != "0" ]; then
  log "批次 $BATCH_ID: 对账存在 $UNMATCHED 条差异 ⚠️"
  # 发送告警
  if [ -n "${DEPLOY_ALERT_WEBHOOK:-}" ]; then
    curl -fsS --max-time 10 -X POST \
      -H 'Content-Type: application/json' \
      --data "{\"msgtype\":\"text\",\"text\":{\"content\":\"[AIbak 对账告警] 批次 $BATCH_ID 存在 $UNMATCHED 条差异，请登录管理后台查看详情\"}}" \
      "$DEPLOY_ALERT_WEBHOOK" >>"$LOG_FILE" 2>&1 || true
  fi
else
  log "批次 $BATCH_ID: 对账状态 $STATUS（可能账单下载失败） ⚠️"
fi

log "每日自动对账完成"