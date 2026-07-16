#!/usr/bin/env bash
# 兼容入口：旧 webhook/systemd 配置若仍调用本文件，也只能触发安全 watcher。
# watcher 只监听通过 CNB 门禁晋级的 deploy/production，不直接部署 main。
set -Eeuo pipefail

PROJECT_ROOT=${PROJECT_ROOT:-/opt/ai-agent-platform}
WATCHER_BIN=${WATCHER_BIN:-/usr/local/sbin/aibak-cnb-watcher}

if [ -x "$WATCHER_BIN" ]; then
  exec "$WATCHER_BIN"
fi

exec bash "$PROJECT_ROOT/deploy/cnb-watcher.sh"
