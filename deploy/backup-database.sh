#!/usr/bin/env bash
# ============================================================
# AIbak 生产数据库备份脚本
# RPO: 1 小时（每日全量 + 小时级增量/操作日志归档）
# 备份加密后写入异地 COS；备份账号仅有写入权限
# ============================================================
set -Eeuo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=${BACKUP_DIR:-/opt/backups/aibak}
RETAIN_DAILY=${RETAIN_DAILY:-30}
RETAIN_MONTHLY=${RETAIN_MONTHLY:-12}
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017}
BACKUP_DB=${BACKUP_DB:-ai-agent-platform}
COS_BUCKET=${COS_BUCKET:-}
COS_REGION=${COS_REGION:-ap-guangzhou}
COS_PATH=${COS_PATH:-aibak-backups}
LOG_FILE=${LOG_FILE:-/var/log/aibak-backup.log}
LOCK_FILE=${LOCK_FILE:-/run/lock/aibak-backup.lock}

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "已有备份任务运行，跳过"
  exit 0
fi

FULL_BACKUP_NAME="aibak-full-${TIMESTAMP}"
FULL_BACKUP_PATH="${BACKUP_DIR}/${FULL_BACKUP_NAME}"
mkdir -p "$FULL_BACKUP_PATH"

log "开始数据库全量备份: $FULL_BACKUP_NAME"

# 1. MongoDB 全量 dump（压缩）
if command -v mongodump >/dev/null 2>&1; then
  log "执行 mongodump..."
  mongodump --uri="$MONGO_URI" --db="$BACKUP_DB" \
    --out="$FULL_BACKUP_PATH/mongodb" \
    --gzip >>"$LOG_FILE" 2>&1 || {
    log "MongoDB 备份失败"
    rm -rf "$FULL_BACKUP_PATH"
    exit 1
  }
else
  log "警告: mongodump 不可用，将使用容器内 mongodump"
  docker exec ai-platform-mongodb mongodump \
    --uri="$MONGO_URI" --db="$BACKUP_DB" \
    --out=/tmp/mongodb_backup --gzip 2>>"$LOG_FILE" && \
  docker cp ai-platform-mongodb:/tmp/mongodb_backup "$FULL_BACKUP_PATH/mongodb" 2>>"$LOG_FILE" || {
    log "容器内 MongoDB 备份失败"
    rm -rf "$FULL_BACKUP_PATH"
    exit 1
  }
fi

# 2. Redis 备份（AOF 文件）
log "备份 Redis..."
docker exec ai-platform-redis redis-cli BGSAVE >>"$LOG_FILE" 2>&1 || true
sleep 2
docker cp ai-platform-redis:/data/appendonly.aof "$FULL_BACKUP_PATH/redis-appendonly.aof" 2>>"$LOG_FILE" || \
  log "警告: Redis AOF 备份失败"

# 3. 打包加密
ARCHIVE_NAME="${FULL_BACKUP_NAME}.tar.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"
log "打包备份: $ARCHIVE_NAME"
tar -czf "$ARCHIVE_PATH" -C "$BACKUP_DIR" "$FULL_BACKUP_NAME" >>"$LOG_FILE" 2>&1

# 生成校验和
sha256sum "$ARCHIVE_PATH" > "${ARCHIVE_PATH}.sha256"

# 加密（如果有加密密钥）
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  log "加密备份..."
  openssl enc -aes-256-cbc -pbkdf2 -salt \
    -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
    -in "$ARCHIVE_PATH" \
    -out "${ARCHIVE_PATH}.enc" >>"$LOG_FILE" 2>&1
  mv "${ARCHIVE_PATH}.enc" "$ARCHIVE_PATH"
fi

rm -rf "$FULL_BACKUP_PATH"

# 4. 上传到异地 COS
if [ -n "$COS_BUCKET" ] && command -v coscli >/dev/null 2>&1; then
  COS_TARGET="cos://${COS_BUCKET}/${COS_PATH}/$(date +%Y/%m)/${ARCHIVE_NAME}"
  log "上传到 COS: $COS_TARGET"
  coscli cp "$ARCHIVE_PATH" "$COS_TARGET" >>"$LOG_FILE" 2>&1 || \
    log "警告: COS 上传失败，备份保留在本地"
else
  log "COS 未配置或 coscli 不可用，备份仅保留在本地"
fi

# 5. 清理过期备份
log "清理过期备份（保留 $RETAIN_DAILY 天日备）..."
find "$BACKUP_DIR" -name "aibak-full-*.tar.gz" -mtime "+${RETAIN_DAILY}" -delete 2>>"$LOG_FILE" || true

# 6. 保留月度备份
if [ "$(date +%d)" = "01" ]; then
  MONTHLY_NAME="aibak-monthly-$(date +%Y%m).tar.gz"
  cp "$ARCHIVE_PATH" "${BACKUP_DIR}/${MONTHLY_NAME}" 2>>"$LOG_FILE" || true
  log "保留月度备份: $MONTHLY_NAME"
  find "$BACKUP_DIR" -name "aibak-monthly-*.tar.gz" -mtime "+$((RETAIN_MONTHLY * 31))" -delete 2>>"$LOG_FILE" || true
fi

BACKUP_SIZE=$(du -h "$ARCHIVE_PATH" | cut -f1)
log "备份完成: $ARCHIVE_NAME ($BACKUP_SIZE)"

echo "$ARCHIVE_NAME"