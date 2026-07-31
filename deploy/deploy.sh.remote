#!/usr/bin/env bash
# 在服务器上、项目根目录运行：./deploy/deploy.sh
# 作用：构建镜像、后台启动全栈、做健康检查验收。
set -euo pipefail

cd "$(dirname "$0")/.."
echo "==> 工作目录：$(pwd)"

echo "==> [1/4] 校验生产环境变量"
if [ ! -f server/.env ]; then
  echo "❌ 未找到 server/.env，请先：cp server/.env.production.example server/.env 并填写"
  exit 1
fi
# 弱 JWT_SECRET 启动拦截由应用自身完成，这里仅做非空提示
if grep -q "请替换" server/.env; then
  echo "⚠️  检测到 JWT_SECRET 仍为占位符，生产启动会失败，请先替换为强随机值"
  exit 1
fi

echo "==> [2/4] 构建镜像（启用层缓存，仅源码层重编，提速一键部署）"
docker compose build

echo "==> [3/4] 后台启动全栈"
# --force-recreate 确保环境变量（如 APP_COMMIT_SHA）变更后一定生效，
# 避免 docker compose up -d 复用旧容器导致 /api/health 的 revision 仍为 unknown。
docker compose up -d --force-recreate

echo "==> [4/4] 等待后端健康检查通过"
OK=0
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✅ 后端健康检查通过（/api/health）"
    OK=1
    break
  fi
  sleep 2
done
[ "$OK" -eq 1 ] || { echo "❌ 后端健康检查超时，请查看：docker compose logs server"; exit 1; }

echo ""
echo "✅ 部署完成。验收："
echo "   前端： http://服务器IP        （阶段2 改为 https://域名）"
echo "   后端： http://服务器IP:3000/api/health"
echo "   容器： docker compose ps"
echo "   日志： docker compose logs -f --tail=100"
