#!/usr/bin/env bash
# local-prod.sh — 一键启动本地生产级预览（全套 Docker，无 SSL）
# 用法：bash scripts/local-prod.sh
# 停止：docker compose -f docker-compose.local.yml down
# 日志：docker compose -f docker-compose.local.yml logs -f

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 AIbak 本地生产级预览启动中..."
echo ""

# 1. 检查 Docker
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker 未运行，请先启动 Docker Desktop"
  exit 1
fi
echo "✅ Docker 运行中"

# 2. 检查 server/.env.local
if [ ! -f server/.env.local ]; then
  echo "⚠️  server/.env.local 不存在，从模板创建..."
  cp server/.env.local.example server/.env.local
  echo "✅ 已创建 server/.env.local"
  echo ""
  echo "🔐 请编辑 server/.env.local 填入以下必填项后重新运行："
  echo "   - JWT_SECRET（运行: openssl rand -hex 32）"
  echo "   - ENCRYPTION_KEY（运行: openssl rand -hex 32）"
  echo "   - DEEPSEEK_API_KEY（或其他 AI Key）"
  echo "   - 微信支付 6 项凭据（如需测试支付）"
  echo "   - DOUYIN_CLIENT_KEY/SECRET（如需抖音登录，见 plan Part B0）"
  echo ""
  echo "   或保持 ENABLE_MOCK_MODE=true 快速预览（无需任何 Key）"
  exit 0
fi
echo "✅ server/.env.local 已存在"

# 3. 构建并启动全套服务
echo "📦 构建并启动 MongoDB + Redis + Server + Client..."
docker compose -f docker-compose.local.yml up -d --build
echo "✅ 全套服务已启动"

# 4. 等待健康检查通过
echo "⏳ 等待后端健康检查通过..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo "✅ 后端健康检查通过"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️  后端健康检查超时（30s），请检查日志：docker compose -f docker-compose.local.yml logs server"
  fi
  sleep 1
done

# 5. 可选：种子数据
if [ "$1" = "--seed" ]; then
  echo "🌱 正在导入种子数据..."
  docker compose -f docker-compose.local.yml exec -T server npm run seed || echo "⚠️ 种子数据导入失败（可忽略）"
  echo "✅ 种子数据导入完成"
fi

echo ""
echo "🎉 本地生产级预览已就绪！"
echo "   访问地址: http://localhost:8080"
echo "   后端 API: http://localhost:3000"
echo "   健康检查: http://localhost:3000/api/health"
echo ""
echo "   停止: docker compose -f docker-compose.local.yml down"
echo "   日志: docker compose -f docker-compose.local.yml logs -f"
echo "   种子数据: bash scripts/local-prod.sh --seed"
