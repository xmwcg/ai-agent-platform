#!/usr/bin/env bash
# 在全新的轻量应用服务器（Ubuntu 22.04 / 24.04）上以 root 运行一次。
# 作用：安装 Docker 引擎与 compose 插件，并启动 docker 服务。
set -euo pipefail

echo "==> [1/3] 安装 Docker 引擎"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
else
  echo "    Docker 已存在：$(docker --version)"
fi

echo "==> [2/3] 确保 compose 插件可用"
if ! docker compose version >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker-compose-plugin
fi

echo "==> [3/3] 启用并启动 docker"
systemctl enable --now docker

echo ""
echo "✅ Docker 就绪："
docker --version
docker compose version

echo ""
echo "下一步："
echo "  1) 将本项目传到服务器：git clone <你的仓库> /opt/ai-agent-platform"
echo "     或 scp -r ai-agent-platform 用户@服务器IP:/opt/"
echo "  2) cd /opt/ai-agent-platform && cp server/.env.production.example server/.env"
echo "     并 vi server/.env 填入真实微信商户号与模型 Key"
echo "  3) 运行 ./deploy/deploy.sh 完成构建与启动"
