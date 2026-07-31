#!/usr/bin/env bash
# 在生产服务器以 root 执行：安装 CNB watcher；默认保持停用，显式批准后再激活。
set -Eeuo pipefail

PROJECT_ROOT=${PROJECT_ROOT:-/opt/ai-agent-platform}
SYSTEMD_DIR=/etc/systemd/system
DEFAULT_FILE=/etc/default/cnb-watcher
CONFIG_DIR=/etc/aibak
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-$CONFIG_DIR/server.env}
REGISTRY_AUTH_FILE=${REGISTRY_AUTH_FILE:-$CONFIG_DIR/registry.env}
RUNTIME_DIR=/usr/local/lib/aibak-deploy
WATCHER_BIN=/usr/local/sbin/aibak-cnb-watcher
ACTIVATE_WATCHER=${ACTIVATE_WATCHER:-false}

for command_name in git node curl flock docker systemctl; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "❌ 缺少运行依赖: $command_name"
    exit 1
  }
done

if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  echo "❌ 缺少 Docker Compose 插件或 docker-compose"
  exit 1
fi

[ -d "$PROJECT_ROOT" ] || { echo "❌ 项目目录不存在: $PROJECT_ROOT"; exit 1; }
for file in \
  "$PROJECT_ROOT/deploy/cnb-watcher.sh" \
  "$PROJECT_ROOT/deploy/verify-release.mjs" \
  "$PROJECT_ROOT/deploy/docker-compose.production.yml" \
  "$PROJECT_ROOT/client/nginx.ssl.runtime.conf"; do
  [ -f "$file" ] || { echo "❌ 安装源文件不存在: $file"; exit 1; }
done

install -d -m 0755 "$RUNTIME_DIR" "$RUNTIME_DIR/releases" "$CONFIG_DIR"
install -d -m 0700 /var/log/aibak-release-evidence
install -m 0755 "$PROJECT_ROOT/deploy/cnb-watcher.sh" "$WATCHER_BIN"
install -m 0755 "$PROJECT_ROOT/deploy/verify-release.mjs" "$RUNTIME_DIR/verify-release.mjs"
install -m 0644 "$PROJECT_ROOT/deploy/docker-compose.production.yml" "$RUNTIME_DIR/docker-compose.production.yml"
install -m 0644 "$PROJECT_ROOT/client/nginx.ssl.runtime.conf" "$RUNTIME_DIR/nginx.ssl.runtime.conf"
install -m 0644 "$PROJECT_ROOT/deploy/systemd/cnb-watcher.service" "$SYSTEMD_DIR/cnb-watcher.service"
install -m 0644 "$PROJECT_ROOT/deploy/systemd/cnb-watcher.timer" "$SYSTEMD_DIR/cnb-watcher.timer"

upsert_default() {
  local key=$1
  local value=$2
  if grep -q "^${key}=" "$DEFAULT_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$DEFAULT_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$DEFAULT_FILE"
  fi
}

if [ ! -f "$DEFAULT_FILE" ]; then
  cat >"$DEFAULT_FILE" <<'EOF'
PUBLIC_BASE_URL=https://aibak.site
# 只监听通过 CNB 质量门禁晋级的批准发布分支。
RELEASE_BRANCH=deploy/production
BUILD_MODE=registry
REGISTRY=docker.cnb.cool
IMAGE_REPOSITORY=docker.cnb.cool/aibak.site/ai-agent-platform
PRODUCTION_ENV_FILE=/etc/aibak/server.env
REGISTRY_AUTH_FILE=/etc/aibak/registry.env
STATE_FILE=/opt/aibak-release.env
MAX_ATTEMPTS=3
RETRY_DELAY_SECONDS=30
VERIFY_TIMEOUT_SECONDS=180
REMOTE_CHECK_ATTEMPTS=3
REMOTE_CHECK_RETRY_SECONDS=10
FAILED_RETRY_COOLDOWN_SECONDS=900
REQUIRE_DEPLOY_ALERTS=true
DEPLOY_ALERT_FORMAT=wecom
# 必须配置真实企业微信或兼容 Webhook；未配置时 watcher 会阻止新版本部署。
# DEPLOY_ALERT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...
EOF
  chmod 0600 "$DEFAULT_FILE"
fi

# 迁移历史 main/local 配置，但保留告警、重试和凭据路径等运维设置。
upsert_default RELEASE_BRANCH deploy/production
upsert_default BUILD_MODE registry

if [ ! -f "$REGISTRY_AUTH_FILE" ]; then
  cat >"$REGISTRY_AUTH_FILE" <<'EOF'
# CNB 私有镜像拉取凭据。不要提交到仓库，不要在聊天中发送。
# REGISTRY_USERNAME=cnb
# REGISTRY_PASSWORD=replace-through-secure-channel
EOF
  chmod 0600 "$REGISTRY_AUTH_FILE"
fi

if [ ! -f "$PRODUCTION_ENV_FILE" ]; then
  echo "❌ 缺少生产环境配置: $PRODUCTION_ENV_FILE"
  echo "请通过安全渠道写入真实托管 MongoDB/Redis、远程 Sandbox、AI、微信和加密配置后重试。"
  exit 1
fi
chmod 0600 "$PRODUCTION_ENV_FILE" "$REGISTRY_AUTH_FILE" "$DEFAULT_FILE"

[ -f /opt/certs/fullchain.pem ] || { echo "❌ 缺少 TLS 证书 /opt/certs/fullchain.pem"; exit 1; }
[ -f /opt/certs/privkey.pem ] || { echo "❌ 缺少 TLS 私钥 /opt/certs/privkey.pem"; exit 1; }
install -d -m 0755 /opt/certs-webroot

systemctl daemon-reload
if [ "$ACTIVATE_WATCHER" = 'true' ]; then
  systemctl enable --now cnb-watcher.timer
  if ! systemctl start cnb-watcher.service; then
    echo "⚠️ watcher 首次执行未通过；请检查批准分支、Registry、告警和生产配置。timer 将继续按周期检查。"
  fi
  systemctl is-enabled cnb-watcher.timer
  systemctl is-active cnb-watcher.timer
  systemctl list-timers cnb-watcher.timer --no-pager
  systemctl status cnb-watcher.service --no-pager || true
  echo "✅ CNB watcher 已安装并按显式批准激活。"
else
  systemctl disable --now cnb-watcher.timer >/dev/null 2>&1 || true
  echo "✅ CNB watcher 已安装但保持停用；完成 Registry 凭据与生产验收准备后，使用 ACTIVATE_WATCHER=true 重新执行安装器。"
fi
