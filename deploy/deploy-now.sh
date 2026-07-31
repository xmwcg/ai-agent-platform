#!/bin/bash
# ============================================================
# AIbak ?????? ? ?????????
# ??: bash <(curl -s https://cnb.cool/aibak.site/ai-agent-platform/-/raw/main/deploy/deploy-now.sh)
# ============================================================
set -e
echo "========================================"
echo "  AIbak ???? $(date)"
echo "========================================"

APP_DIR=${APP_DIR:-/opt/ai-agent-platform}
BRANCH=${BRANCH:-main}

# --- Step 0: ?????? ---
echo ""
echo "[0/5] ??????..."
CONTAINER=$(docker ps --filter "name=server" --format "{{.Names}}" | grep -v sandbox | head -1)
if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "platform|nexmind|agent.*server" | head -1)
fi
echo "??: ${CONTAINER:-???}"

# --- Step 1: ?????? ---
echo ""
echo "[1/5] ??????..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch origin $BRANCH 2>/dev/null
  git reset --hard origin/$BRANCH 2>/dev/null
  echo "????: $(git log --oneline -1)"
else
  echo "?? $APP_DIR ????????..."
  git clone https://cnb.cool/aibak.site/ai-agent-platform.git "$APP_DIR" 2>/dev/null
  cd "$APP_DIR"
fi

# --- Step 2: ???? ---
echo ""
echo "[2/5] ????..."
cd "$APP_DIR/client"
npm ci --no-audit --no-fund 2>&1 | tail -3
npm run build 2>&1 | tail -5
echo "??????"

# --- Step 3: ???? ---
echo ""
echo "[3/5] ???? (TypeScript)..."
cd "$APP_DIR/server"
npm ci --no-audit --no-fund 2>&1 | tail -3
npx tsc 2>&1
if [ $? -ne 0 ]; then
  echo "? TypeScript ???????????"
  exit 1
fi
echo "? TypeScript ????"

# --- Step 4: ????? ---
echo ""
echo "[4/5] ?????..."

if [ -n "$CONTAINER" ]; then
  # Docker ??
  echo "?? Docker ??: $CONTAINER"
  
  # ?????????
  docker cp "$APP_DIR/client/dist/." "$CONTAINER:/app/client/dist/" 2>/dev/null || true
  docker cp "$APP_DIR/server/dist/." "$CONTAINER:/app/server/dist/" 2>/dev/null || true
  docker cp "$APP_DIR/server/package.json" "$CONTAINER:/app/server/" 2>/dev/null || true
  
  # ????????
  docker exec "$CONTAINER" sh -c "cd /app/server && npm ci --omit=dev 2>/dev/null || true" 2>&1 | tail -3
  
  # ????
  echo "????..."
  docker restart "$CONTAINER"
  
  # ????
  echo "?????? (12?)..."
  sleep 12
else
  # PM2 ??
  echo "?? PM2 ??"
  cd "$APP_DIR/server"
  npm ci --omit=dev 2>&1 | tail -3
  pm2 restart nexmind-platform 2>/dev/null || pm2 start dist/index.js --name nexmind-platform
  sleep 8
fi

# --- Step 5: ???? ---
echo ""
echo "[5/5] ????..."

check_endpoint() {
  local url=$1
  local label=$2
  local resp=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$url" 2>/dev/null)
  if [ "$resp" = "200" ]; then
    echo "  ? $label: HTTP $resp"
  elif [ "$resp" = "000" ]; then
    echo "  ? $label: ??????????????"
  else
    echo "  ??  $label: HTTP $resp"
  fi
}

BASE_URL=${BASE_URL:-http://localhost:3001}
check_endpoint "$BASE_URL/health" "????"
check_endpoint "$BASE_URL/api/studio/scenes" "Studio ????"
check_endpoint "$BASE_URL/api/courses" "????"
check_endpoint "$BASE_URL/api/billing/plans" "????"
check_endpoint "$BASE_URL/api/ai/models" "AI ??"

echo ""
echo "========================================"
echo "  ?????????:"
echo "  https://aibak.site/api/studio/scenes"
echo "  https://aibak.site/api/courses"
echo "========================================"
