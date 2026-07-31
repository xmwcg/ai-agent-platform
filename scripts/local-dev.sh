#!/usr/bin/env bash
# local-dev.sh — 一键启动本地开发环境
# 用法：bash scripts/local-dev.sh
# 停止：docker compose -f docker-compose.dev.yml down

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 AIbak 本地开发环境启动中..."
echo ""

# 1. 检查 Docker
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker 未运行，请先启动 Docker Desktop"
  exit 1
fi
echo "✅ Docker 运行中"

# 2. 启动 MongoDB + Redis
echo "📦 启动 MongoDB + Redis..."
docker compose -f docker-compose.dev.yml up -d
echo "✅ 数据库就绪（MongoDB localhost:27017 / Redis localhost:6379）"

# 3. 检查 server/.env
if [ ! -f server/.env ]; then
  echo "⚠️  server/.env 不存在，从模板创建..."
  cp server/.env.local.example server/.env
  echo "✅ 已创建 server/.env"
  echo ""
  echo "🔐 请编辑 server/.env 填入以下必填项后重新运行："
  echo "   - JWT_SECRET（运行: openssl rand -hex 32）"
  echo "   - ENCRYPTION_KEY（运行: openssl rand -hex 32）"
  echo "   - DEEPSEEK_API_KEY（或其他 AI Key）"
  echo "   - 微信支付 6 项凭据（如需测试支付）"
  echo ""
  echo "   或保持 ENABLE_MOCK_MODE=true 快速预览（无需任何 Key）"
  exit 0
fi
echo "✅ server/.env 已存在"

# 4. 安装依赖
if [ ! -d node_modules ]; then
  echo "📥 安装根依赖..."
  npm install
fi
if [ ! -d server/node_modules ]; then
  echo "📥 安装 server 依赖..."
  cd server && npm install && cd ..
fi
if [ ! -d client/node_modules ]; then
  echo "📥 安装 client 依赖..."
  cd client && npm install && cd ..
fi
echo "✅ 依赖就绪"

# 5. 启动开发服务器
echo ""
echo "🎉 启动开发服务器..."
echo "   前端: http://localhost:5173"
echo "   后端: http://localhost:3000"
echo "   健康检查: http://localhost:3000/api/health"
echo ""
echo "   按 Ctrl+C 停止。数据库保持运行，下次启动更快。"
echo ""

npm run dev
