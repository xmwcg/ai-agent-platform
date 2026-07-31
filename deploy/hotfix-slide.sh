#!/bin/bash
# NexMind Slide - Docker 容器热更新部署
set -e
echo "=== NexMind Slide Docker Deploy ==="

cd /opt/ai-agent-platform

# 1. 拉取最新代码
git pull cnb main 2>/dev/null
git checkout server/src/index.ts 2>/dev/null  # 丢弃本地修改

# 2. 确保 slide 路由在 index.ts 中
if ! grep -q "slide.routes" server/src/index.ts; then
  sed -i "/^import aiRoutes/a import slideRoutes from \"./routes/slide.routes\";" server/src/index.ts
  sed -i "/app.use.*aiRoutes/a app.use(\"/api/slide\", slideRoutes);" server/src/index.ts
fi

# 3. 构建前端
cd client && npm ci --silent 2>/dev/null && npm run build 2>&1 | tail -2
cd ..

# 4. 找到运行中的 server 容器
CONTAINER=$(docker ps --filter "name=server" --format "{{.Names}}" | grep -v sandbox | head -1)
if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "platform|nexmind|agent.*server" | head -1)
fi
echo "容器: $CONTAINER"

if [ -n "$CONTAINER" ]; then
  # 5. 在容器内编译
  docker exec $CONTAINER sh -c "cd /app/server && npm run build 2>/dev/null || npx tsc 2>/dev/null || true"
  
  # 6. 重启容器
  docker restart $CONTAINER
  sleep 8
  
  # 7. 验证
  curl -s http://localhost:3001/api/slide/styles 2>/dev/null | head -c 200 || \
  curl -s http://localhost:3000/api/slide/styles 2>/dev/null | head -c 200 || \
  echo "请手动验证: https://aibak.site/api/slide/styles"
else
  echo "没有找到运行中的服务器容器，用本地 node 启动"
  cd server && npm install --silent 2>/dev/null
  npx tsc 2>/dev/null
  export MONGODB_URI="mongodb://mongodb:27017/ai-agent-platform"
  export REDIS_URL="redis://redis:6379"
  nohup node dist/index.js > /tmp/slide-deploy.log 2>&1 &
  sleep 8
  curl -s http://localhost:3001/api/slide/styles | head -c 200
fi

echo ""
echo "=== Done ==="
