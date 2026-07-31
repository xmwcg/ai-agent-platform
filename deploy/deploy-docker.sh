#!/bin/bash
# ============================================================
# AIbak Docker 本地构建部署脚本
# 用途：在服务器上本地构建 Docker 镜像并部署（无需 CI Registry）
# 用法：在服务器上执行
#   bash <(curl -s https://cnb.cool/aibak.site/ai-agent-platform/-/raw/main/deploy/deploy-docker.sh)
# ============================================================
set -e

echo "========================================"
echo "  AIbak Docker 本地构建部署 $(date)"
echo "========================================"

REPO_DIR=${REPO_DIR:-/opt/ai-agent-platform}
BRANCH=${BRANCH:-deploy/production}
COMPOSE_FILE=${COMPOSE_FILE:-/opt/ai-agent-platform/deploy/docker-compose.production.yml}
ENV_FILE=${ENV_FILE:-/etc/aibak/server.env}

# --- Step 0: 检查环境 ---
echo ""
echo "[0/6] 检查环境..."
command -v docker >/dev/null 2>&1 || { echo "❌ Docker 未安装"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git 未安装"; exit 1; }
echo "✅ Docker $(docker --version | head -1)"
echo "✅ Git $(git --version | head -1)"

# --- Step 1: 拉取最新代码 ---
echo ""
echo "[1/6] 拉取最新代码..."
if [ -d "$REPO_DIR" ]; then
  cd "$REPO_DIR"
  git fetch origin "$BRANCH" 2>/dev/null || true
  git reset --hard "origin/$BRANCH" 2>/dev/null || git checkout "$BRANCH"
  echo "📦 当前提交: $(git log --oneline -1)"
else
  echo "❌ $REPO_DIR 不存在，请先 clone"
  exit 1
fi

# --- Step 2: 构建 Server 镜像 ---
echo ""
echo "[2/6] 构建 Server Docker 镜像..."
SHA=$(git rev-parse --short HEAD)
SERVER_IMAGE="aibak-platform/server:${SHA}"

cd "$REPO_DIR/server"
docker build \
  --build-arg APP_COMMIT_SHA="$(git rev-parse HEAD)" \
  -t "$SERVER_IMAGE" \
  -t "aibak-platform/server:latest" \
  -f Dockerfile \
  .

echo "✅ Server 镜像: $SERVER_IMAGE"

# --- Step 3: 构建 Client 镜像 ---
echo ""
echo "[3/6] 构建 Client Docker 镜像..."
CLIENT_IMAGE="aibak-platform/client:${SHA}"

cd "$REPO_DIR/client"
docker build \
  --build-arg APP_COMMIT_SHA="$(git rev-parse HEAD)" \
  -t "$CLIENT_IMAGE" \
  -t "aibak-platform/client:latest" \
  -f Dockerfile \
  .

echo "✅ Client 镜像: $CLIENT_IMAGE"

# --- Step 4: 生成部署环境 ---
echo ""
echo "[4/6] 准备部署环境..."
cd "$REPO_DIR/deploy"

export SERVER_IMAGE="$SERVER_IMAGE"
export CLIENT_IMAGE="$CLIENT_IMAGE"
export APP_COMMIT_SHA="$(cd "$REPO_DIR" && git rev-parse HEAD)"
export SERVER_IMAGE_DIGEST="local-${SHA}"
export CLIENT_IMAGE_DIGEST="local-${SHA}"
export PRODUCTION_ENV_FILE="$ENV_FILE"
export NGINX_RUNTIME_CONFIG="$REPO_DIR/deploy/nginx-runtime.conf"

# --- Step 5: 停止旧容器并启动新容器 ---
echo ""
echo "[5/6] 重启服务..."
cd "$REPO_DIR/deploy"

docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

echo "✅ 容器已启动"

# --- Step 6: 等待并验证 ---
echo ""
echo "[6/6] 等待服务就绪 (15秒)..."
sleep 15

# 健康检查
check_endpoint() {
  local url=$1
  local label=$2
  local resp=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null)
  if [ "$resp" = "200" ]; then
    echo "  ✅ $label: HTTP $resp"
  elif [ "$resp" = "000" ]; then
    echo "  ❌ $label: 连接失败"
  else
    echo "  ⚠️  $label: HTTP $resp"
  fi
}

echo ""
echo "=== 验证结果 ==="
check_endpoint "http://localhost:3000/api/health" "健康检查"
check_endpoint "http://localhost:3000/api/studio/scenes" "Studio 场景"
check_endpoint "http://localhost:3000/api/ai/models" "AI 模型"
check_endpoint "http://localhost:3000/api/courses" "课程"

echo ""

# --- Step 7: 金网通 API 验证 ---
echo ""
echo "[7/7] 验证金网通 API..."
check_endpoint "http://localhost:3000/api/jinwangtong/editions" "金网通版本"
check_endpoint "http://localhost:3000/api/jinwangtong/downloads/latest" "最新下载"
check_endpoint "http://localhost:3000/api/auth/login" "登录接口"
check_endpoint "http://localhost:3000/api/billing/private-license-packages" "License套餐"

echo "========================================"
echo "  部署完成！"
echo "  https://aibak.site/api/studio/scenes"
echo "========================================"
