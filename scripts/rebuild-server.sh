#!/bin/bash
# 一键重建服务器 Docker 镜像并重启
set -e
cd /opt/ai-agent-platform

echo "[1/4] 停止旧容器..."
docker stop ai-platform-server 2>/dev/null || true
docker rm ai-platform-server 2>/dev/null || true

echo "[2/4] 编译 TypeScript..."
cd server
npx tsc 2>&1
echo "tsc: OK"

echo "[3/4] 构建 Docker 镜像..."
docker build --no-cache -t ai-agent-platform-server -f Dockerfile . 2>&1
echo "docker build: OK"

echo "[4/4] 启动容器..."
docker run -d --name ai-platform-server \
  --network=ai-agent-platform_default \
  --restart=always \
  -p 3000:3000 \
  --env-file .env \
  ai-agent-platform-server

echo "DONE! Server should be running."
