#!/usr/bin/env bash
# ============================================================
# push-deploy.sh — 由 git post-receive 钩子触发的一键部署
# 流程：构建前端静态资源(dist) → 调用 deploy.sh 完成镜像构建/启动/健康检查
# 用法（服务器上由钩子自动调用，无需手动执行）：
#   bash deploy/push-deploy.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ===== push-deploy 开始 ====="

# ---------- 0. 前置检查 ----------
if [ ! -f server/.env ]; then
  echo "❌ 缺少 server/.env（密钥未配置），部署中止。请先在服务器上创建 server/.env"
  exit 1
fi

# ---------- 0.5 构建前门禁：类型检查/测试，阻止坏代码上线 ----------
echo "==> [0.5] 构建前门禁（tsc / 测试）"
cd "$PROJECT_ROOT/server"
echo "  -> server tsc --noEmit"
npx tsc --noEmit || { echo "❌ server 类型检查未通过，部署中止（坏代码不会上线）"; exit 1; }
if [ -n "${DEPLOY_RUN_TESTS:-}" ]; then
  echo "  -> server 测试"
  npm test || { echo "❌ server 测试未通过，部署中止（坏代码不会上线）"; exit 1; }
fi
cd "$PROJECT_ROOT"

# ---------- 1. 构建前端静态资源（client Dockerfile 依赖预构建的 dist）----------
echo "==> [1/2] 构建前端静态资源 (npm install + vite build)"
cd "$PROJECT_ROOT/client"
# 使用 npm install 而非 npm ci：client 的 lockfile 含跨平台可选二进制（@tauri-apps/cli-*），
# 在服务器平台执行 npm ci 会报 "Missing from lock file" 而中断构建；
# npm install 可容错并完成安装，从而让最新代码真正构建上线。
npm install --no-audit --no-fund
# 增大 Node 堆内存，避免 vite 构建时 OOM
export NODE_OPTIONS=--max-old-space-size=2048
npm run build
cd "$PROJECT_ROOT"

# ---------- 2. 调用既有 deploy.sh 完成镜像构建、启动与健康检查 ----------
echo "==> [2/2] 调用 deploy.sh 完成镜像构建与服务启动"
exec bash "$PROJECT_ROOT/deploy/deploy.sh"
