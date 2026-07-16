#!/bin/bash
# ============================================================
# deploy-from-cnb.sh — CNB Webhook 触发的自动部署脚本
# 调用方：cnb-webhook.service（CNB push → POST /deploy → 本脚本）
# 作用：从 cnb.cool 拉取最新代码、重建 Docker、镜像到 GitHub、标记部署状态。
#
# 与 cnb-watcher.sh（cron 每分钟轮询）共用同一把锁 /opt/.cnb-deploy.lock
# 与同一个状态文件 /opt/.cnb-deploy-sha，确保两条路径不会并发/重复部署，
# 且「仅在健康检查通过后」才写 STATE_FILE（避免假成功标记）。
# ============================================================
set -euo pipefail

PROJECT_DIR="/opt/ai-agent-platform"
LOG_FILE="/var/log/cnb-deploy.log"
LOCK_FILE="/opt/.cnb-deploy.lock"
STATE_FILE="/opt/.cnb-deploy-sha"
FAIL_FILE="/opt/.cnb-deploy-failed"
# 部署密钥由 systemd 单元以环境变量注入，禁止写死默认值（避免泄露到公开仓库）
DEPLOY_SECRET="${DEPLOY_SECRET:?DEPLOY_SECRET 未设置（请在 systemd 单元 Environment 中注入）}"

# 单实例锁：与 cnb-watcher.sh 共用，避免与 cron 轮询并发踩踏
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date): ⏭️ 另一部署进行中（锁被占用），跳过本次" | tee -a "$LOG_FILE"
  exit 0
fi

echo "$(date): 🚀 开始部署..." | tee -a "$LOG_FILE"
cd "$PROJECT_DIR"

# 1. 备份生产环境变量（server/.env 不入库）
cp server/.env /tmp/.env.backup 2>/dev/null || true

# 2. 配置 git credential，从 cnb.cool 拉取（密钥来自环境变量）
echo "https://cnb:${DEPLOY_SECRET}@cnb.cool" > ~/.git-credentials
chmod 600 ~/.git-credentials
git config --global credential.helper store
git config --global --add safe.directory "$PROJECT_DIR"

# 3. 拉取最新代码
echo "$(date): 🔄 拉取 CNB 最新代码..." | tee -a "$LOG_FILE"
git fetch cnb main 2>&1 | tee -a "$LOG_FILE"
git reset --hard cnb/main 2>&1 | tee -a "$LOG_FILE"

# 4. 恢复环境变量
mv /tmp/.env.backup server/.env 2>/dev/null || true

# 5. GitHub 镜像同步（非阻塞，失败仅记录，不阻断上线）
echo "$(date): 🔄 同步到 GitHub 镜像..." | tee -a "$LOG_FILE"
git push github main 2>&1 | tee -a "$LOG_FILE" || echo "GitHub 同步失败（可能网络问题，不影响上线）"

# 6. 重建并启动容器
echo "$(date): 🚀 重建 Docker 容器..." | tee -a "$LOG_FILE"
docker-compose down 2>&1 | tee -a "$LOG_FILE"
docker-compose up -d --build 2>&1 | tee -a "$LOG_FILE"

# 7. 健康检查门禁：接口必须真正可用才算上线
echo "$(date): 💊 检查服务健康..." | tee -a "$LOG_FILE"
OK=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 && \
     curl -fsS http://127.0.0.1:3000/api/sandbox/status >/dev/null 2>&1; then
    OK=1; break
  fi
  sleep 2
done

if [ "$OK" -eq 1 ]; then
  git rev-parse HEAD > "$STATE_FILE"   # 仅成功才写，与 cnb-watcher.sh 共用同一状态
  rm -f "$FAIL_FILE"
  echo "$(date): ✅ 部署成功！服务健康，已记录 $(cat "$STATE_FILE")" | tee -a "$LOG_FILE"
  exit 0
else
  touch "$FAIL_FILE"
  echo "$(date): ❌ 健康检查未通过，标记为失败以便 cron 重试" | tee -a "$LOG_FILE"
  exit 1
fi
