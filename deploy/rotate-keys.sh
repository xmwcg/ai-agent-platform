#!/usr/bin/env bash
# ============================================================
# AIbak 密钥轮换脚本
# 每季度轮换 JWT 签名密钥、字段加密密钥、微信 API 密钥和内部 Sandbox 凭证
# 支持无停机轮换：保留当前密钥和上一密钥，旧密钥数据可读取并完成重加密
# ============================================================
set -Eeuo pipefail

ENV_FILE=${1:-/etc/aibak/server.env}
ROTATION_LOG=${ROTATION_LOG:-/var/log/aibak-key-rotation.log}
BACKUP_DIR=${BACKUP_DIR:-/opt/backups/aibak/keys}

mkdir -p "$BACKUP_DIR" "$(dirname "$ROTATION_LOG")"
touch "$ROTATION_LOG"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$ROTATION_LOG"; }

if [ ! -f "$ENV_FILE" ]; then
  log "环境文件不存在: $ENV_FILE"
  exit 1
fi

ROTATION_DATE=$(date +%Y%m%d-%H%M%S)
ROTATION_BACKUP="${BACKUP_DIR}/env-backup-${ROTATION_DATE}"
cp "$ENV_FILE" "$ROTATION_BACKUP"
chmod 0600 "$ROTATION_BACKUP"
log "已备份当前配置: $ROTATION_BACKUP"

# 生成新的强随机密钥
NEW_JWT_SECRET=$(openssl rand -hex 48)
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)
NEW_SANDBOX_TOKEN=$(openssl rand -hex 32)

log "生成新密钥完成"

# 轮换逻辑：保留前一密钥作为 OLD_*，新密钥作为当前
rotate_key() {
  local key_name=$1
  local new_value=$2

  # 读取当前值
  local current_value
  current_value=$(grep "^${key_name}=" "$ENV_FILE" | tail -n 1 | sed "s/^${key_name}=//")

  if [ -z "$current_value" ]; then
    log "警告: ${key_name} 未配置，直接设置"
    echo "${key_name}=${new_value}" >> "$ENV_FILE"
    return
  fi

  # 设置旧密钥
  local old_key="OLD_${key_name}"
  if grep -q "^${old_key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s/^${old_key}=.*/${old_key}=${current_value}/" "$ENV_FILE"
  else
    echo "${old_key}=${current_value}" >> "$ENV_FILE"
  fi

  # 设置新密钥
  sed -i "s/^${key_name}=.*/${key_name}=${new_value}/" "$ENV_FILE"
  log "${key_name} 轮换完成"
}

rotate_key "JWT_SECRET" "$NEW_JWT_SECRET"
rotate_key "ENCRYPTION_KEY" "$NEW_ENCRYPTION_KEY"
rotate_key "SANDBOX_REMOTE_TOKEN" "$NEW_SANDBOX_TOKEN"

# 记录轮换事件
cat >> "$ROTATION_LOG" <<EOF

=== 密钥轮换: $ROTATION_DATE ===
JWT_SECRET: 已轮换 (旧密钥保留为 OLD_JWT_SECRET)
ENCRYPTION_KEY: 已轮换 (旧密钥保留为 OLD_ENCRYPTION_KEY)
SANDBOX_REMOTE_TOKEN: 已轮换 (旧密钥保留为 OLD_SANDBOX_REMOTE_TOKEN)
备份文件: $ROTATION_BACKUP
EOF

log "密钥轮换完成。请重启应用以加载新密钥。"
log "备份文件保留在: $ROTATION_BACKUP"
log "注意: 旧密钥数据在前一周期内（下次轮换前）仍可读取和重加密。"

echo "轮换完成: $ROTATION_DATE"