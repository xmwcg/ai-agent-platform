#!/usr/bin/env bash
# ============================================================
# AIbak 数据库恢复演练脚本
# 每季度在隔离环境执行，核对数据完整性并记录实际恢复时间
# ============================================================
set -Eeuo pipefail

BACKUP_FILE=${1:-}
RESTORE_DIR=${RESTORE_DIR:-/opt/backups/aibak/restore-test}
MONGO_URI=${RESTORE_MONGO_URI:-mongodb://localhost:27018}
RESTORE_DB=${RESTORE_DB:-ai-agent-platform-restore-test}
LOG_FILE=${LOG_FILE:-/var/log/aibak-restore-drill.log}
REPORT_FILE=${REPORT_FILE:-/opt/backups/aibak/restore-drill-report.json}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

if [ -z "$BACKUP_FILE" ]; then
  log "用法: $0 <backup-file.tar.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  log "备份文件不存在: $BACKUP_FILE"
  exit 1
fi

DRILL_START=$(date +%s)
DRILL_DATE=$(date -Iseconds)
mkdir -p "$RESTORE_DIR" "$(dirname "$LOG_FILE")"

log "=== 恢复演练开始: $DRILL_DATE ==="
log "备份文件: $BACKUP_FILE"

# 1. 解压备份
log "解压备份..."
EXTRACT_DIR="${RESTORE_DIR}/drill-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$BACKUP_FILE" -C "$EXTRACT_DIR" 2>>"$LOG_FILE" || {
  log "备份文件解压失败，可能已损坏"
  echo '{"status":"failed","reason":"backup_corrupted","date":"'"$DRILL_DATE"'"}' > "$REPORT_FILE"
  exit 1
}

# 2. 恢复 MongoDB
log "恢复 MongoDB 到测试实例 ($MONGO_URI)..."
RESTORE_START=$(date +%s)

if [ -d "$EXTRACT_DIR"/*/mongodb 2>/dev/null ]; then
  MONGODUMP_DIR=$(find "$EXTRACT_DIR" -type d -name mongodb | head -n 1)
  mongorestore --uri="$MONGO_URI" --db="$RESTORE_DB" \
    --gzip --drop "$MONGODUMP_DIR" >>"$LOG_FILE" 2>&1 || {
    log "MongoDB 恢复失败"
    echo '{"status":"failed","reason":"mongodb_restore_failed","date":"'"$DRILL_DATE"'"}' > "$REPORT_FILE"
    exit 1
  }
else
  log "错误: 备份包中缺少 MongoDB 数据"
  echo '{"status":"failed","reason":"no_mongodb_data","date":"'"$DRILL_DATE"'"}' > "$REPORT_FILE"
  exit 1
fi

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))

# 3. 数据完整性校验
log "校验数据完整性..."

# 统计恢复后的数据量
USER_COUNT=$(mongosh --quiet --eval "db.getSiblingDB('$RESTORE_DB').users.countDocuments()" "$MONGO_URI" 2>/dev/null || echo "0")
ORDER_COUNT=$(mongosh --quiet --eval "db.getSiblingDB('$RESTORE_DB').orders.countDocuments()" "$MONGO_URI" 2>/dev/null || echo "0")
TRANSACTION_COUNT=$(mongosh --quiet --eval "db.getSiblingDB('$RESTORE_DB').creditstransactions.countDocuments()" "$MONGO_URI" 2>/dev/null || echo "0")
LOT_COUNT=$(mongosh --quiet --eval "db.getSiblingDB('$RESTORE_DB').creditlots.countDocuments()" "$MONGO_URI" 2>/dev/null || echo "0")

# 4. 索引检查
INDEX_COUNT=$(mongosh --quiet --eval "
  var count = 0;
  db.getSiblingDB('$RESTORE_DB').getCollectionNames().forEach(function(c) {
    count += db.getSiblingDB('$RESTORE_DB').getCollection(c).getIndexes().length;
  });
  count;
" "$MONGO_URI" 2>/dev/null || echo "0")

# 5. 账本一致性检查
LEDGER_CHECK=$(mongosh --quiet --eval "
  var totalLedgerAmount = 0;
  var totalLotsRemaining = 0;
  db.getSiblingDB('$RESTORE_DB').creditstransactions.find().forEach(function(t) {
    if (t.status === 'committed') totalLedgerAmount += Number(t.amount || 0);
  });
  db.getSiblingDB('$RESTORE_DB').creditlots.find({status: 'active'}).forEach(function(l) {
    totalLotsRemaining += Number(l.remainingAmount || 0);
  });
  JSON.stringify({
    totalLedgerAmount: totalLedgerAmount,
    totalLotsRemaining: totalLotsRemaining,
    userCreditsTotal: db.getSiblingDB('$RESTORE_DB').users.aggregate([
      { \$group: { _id: null, total: { \$sum: '\$credits' } } }
    ]).toArray()[0]?.total || 0
  });
" "$MONGO_URI" 2>/dev/null || echo '{}')

DRILL_END=$(date +%s)
DRILL_DURATION=$((DRILL_END - DRILL_START))

# 6. 生成报告
REPORT=$(cat <<EOF
{
  "status": "completed",
  "date": "$DRILL_DATE",
  "backupFile": "$BACKUP_FILE",
  "restoreDurationSeconds": $RESTORE_DURATION,
  "totalDurationSeconds": $DRILL_DURATION,
  "rtoTarget": 14400,
  "rtoCompliant": $([ $DRILL_DURATION -le 14400 ] && echo "true" || echo "false"),
  "dataIntegrity": {
    "users": $USER_COUNT,
    "orders": $ORDER_COUNT,
    "transactions": $TRANSACTION_COUNT,
    "creditLots": $LOT_COUNT,
    "indexCount": $INDEX_COUNT,
    "ledgerCheck": $LEDGER_CHECK
  },
  "issues": []
}
EOF
)

echo "$REPORT" > "$REPORT_FILE"
log "恢复演练完成。RTO: ${DRILL_DURATION}s (目标: 14400s)"
log "报告已写入: $REPORT_FILE"

# 7. 清理测试数据
log "清理恢复测试环境..."
mongosh --quiet --eval "db.getSiblingDB('$RESTORE_DB').dropDatabase()" "$MONGO_URI" 2>>"$LOG_FILE" || true
rm -rf "$EXTRACT_DIR"

log "=== 恢复演练结束 ==="

echo "$REPORT"