#!/usr/bin/env bash
# 在生产服务器以 root 执行：安装并启用 CNB watcher systemd timer。
set -Eeuo pipefail

PROJECT_ROOT=${PROJECT_ROOT:-/opt/ai-agent-platform}
SYSTEMD_DIR=/etc/systemd/system
DEFAULT_FILE=/etc/default/cnb-watcher
RUNTIME_DIR=/usr/local/lib/aibak-deploy
WATCHER_BIN=/usr/local/sbin/aibak-cnb-watcher

for command_name in git node curl flock docker systemctl; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "❌ 缺少运行依赖: $command_name"
    exit 1
  }
done

[ -d "$PROJECT_ROOT" ] || { echo "❌ 项目目录不存在: $PROJECT_ROOT"; exit 1; }
[ -d /opt/ai-agent-platform.git ] || { echo "❌ Git 仓库不存在: /opt/ai-agent-platform.git"; exit 1; }

install -d -m 0755 "$RUNTIME_DIR"
install -m 0755 "$PROJECT_ROOT/deploy/cnb-watcher.sh" "$WATCHER_BIN"
install -m 0755 "$PROJECT_ROOT/deploy/verify-release.mjs" "$RUNTIME_DIR/verify-release.mjs"
install -m 0644 "$PROJECT_ROOT/deploy/systemd/cnb-watcher.service" "$SYSTEMD_DIR/cnb-watcher.service"
install -m 0644 "$PROJECT_ROOT/deploy/systemd/cnb-watcher.timer" "$SYSTEMD_DIR/cnb-watcher.timer"

if [ ! -f "$DEFAULT_FILE" ]; then
  cat >"$DEFAULT_FILE" <<'EOF'
# 可选：失败告警 Webhook（企业微信/自建兼容入口）
# DEPLOY_ALERT_WEBHOOK=https://example.com/webhook
PUBLIC_BASE_URL=https://aibak.site
RELEASE_BRANCH=deploy/production
MAX_ATTEMPTS=3
RETRY_DELAY_SECONDS=30
VERIFY_TIMEOUT_SECONDS=180
FAILED_RETRY_COOLDOWN_SECONDS=900
EOF
  chmod 0600 "$DEFAULT_FILE"
fi

systemctl daemon-reload
systemctl enable --now cnb-watcher.timer
systemctl start cnb-watcher.service

systemctl is-enabled cnb-watcher.timer
systemctl is-active cnb-watcher.timer
systemctl list-timers cnb-watcher.timer --no-pager
systemctl status cnb-watcher.service --no-pager || true

echo "✅ CNB watcher timer 已安装并启用"
