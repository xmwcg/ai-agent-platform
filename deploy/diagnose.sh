#!/bin/bash
# ============================================================
# AIbak ??????? ? ?????????
# ??: bash <(curl -s https://cnb.cool/aibak.site/ai-agent-platform/-/raw/main/deploy/diagnose.sh)
# ============================================================
set -e
echo "=== AIbak ????? $(date) ==="

echo ""
echo "--- 1. ???? ---"
echo "??:"; df -h / | tail -1
echo "??:"; free -m | grep Mem
echo "CPU:"; top -bn1 | grep "Cpu(s)" | head -1

echo ""
echo "--- 2. Docker ???? ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker ???"
echo ""
echo "???? (??20?):"
CONTAINER=$(docker ps --filter "name=server" --format "{{.Names}}" | grep -v sandbox | head -1)
if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker ps --format "{{.Names}}" | grep -E "platform|nexmind|agent" | head -1)
fi
if [ -n "$CONTAINER" ]; then
  echo "??: $CONTAINER"
  docker logs --tail 20 $CONTAINER 2>&1
else
  echo "????????????"
fi

echo ""
echo "--- 3. PM2 ?? ---"
if command -v pm2 &> /dev/null; then
  pm2 list 2>/dev/null || echo "PM2 ?????"
else
  echo "PM2 ???"
fi

echo ""
echo "--- 4. MongoDB ???? ---"
MONGO_URI=${MONGODB_URI:-"mongodb://localhost:27017/ai-agent-platform"}
echo "????: $MONGO_URI"
docker exec $CONTAINER node -e "
const mongoose = require('mongoose');
mongoose.connect('$MONGO_URI', { serverSelectionTimeoutMS: 5000 })
  .then(() => { console.log('MongoDB: ????'); process.exit(0); })
  .catch(e => { console.log('MongoDB: ???? -', e.message); process.exit(1); });
" 2>&1 || echo "MongoDB ???????????????"

echo ""
echo "--- 5. Redis ???? ---"
REDIS_URL=${REDIS_URL:-"redis://localhost:6379"}
docker exec $CONTAINER node -e "
const Redis = require('ioredis');
const r = new Redis('$REDIS_URL', { connectTimeout: 3000, maxRetriesPerRequest: 1 });
r.ping().then(v => { console.log('Redis:', v); r.disconnect(); process.exit(0); })
 .catch(e => { console.log('Redis: ???? -', e.message); r.disconnect(); process.exit(1); });
" 2>&1 || echo "Redis ??????"

echo ""
echo "--- 6. API ???? ---"
netstat -tlnp 2>/dev/null | grep -E "3000|3001|80|443" || ss -tlnp | grep -E "3000|3001|80|443"

echo ""
echo "--- 7. ?? API ?? ---"
curl -s --connect-timeout 5 http://localhost:3001/api/health 2>/dev/null || \
curl -s --connect-timeout 5 http://localhost:3000/api/health 2>/dev/null || \
curl -s --connect-timeout 5 http://localhost/health 2>/dev/null || \
echo "?? API ???"

echo ""
echo "--- 8. Git ?? ---"
if [ -d /opt/ai-agent-platform ]; then
  cd /opt/ai-agent-platform
  echo "????/??:"
  git log --oneline -3 2>/dev/null || echo "Git ???"
  echo ""
  echo "?????:"
  git status --short 2>/dev/null || true
else
  echo "/opt/ai-agent-platform ???"
fi

echo ""
echo "=== ???? ==="
