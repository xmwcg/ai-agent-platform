#!/bin/bash
# =============================================
# NexMind Platform — 一键初始化自动部署
# 复制整段到生产服务器执行一次，之后全自动
# =============================================
set -e
echo "=== NexMind Auto-Deploy Setup ==="

# 1. 添加部署公钥
echo "[1/5] 配置 SSH 部署密钥..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMeS4RMq2wVulMLDWphoR+UxH9jwDXYIkJqpSJslP0uN nexmind-deploy@aibak.site
" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
echo "  公钥已添加"

# 2. 确保 git 可用并拉取最新代码
echo "[2/5] 更新代码..."
if [ -d /app/.git ]; then
  cd /app && git remote set-url origin https://cnb.cool/aibak.site/ai-agent-platform.git
  git fetch origin && git reset --hard origin/main
else
  git clone https://cnb.cool/aibak.site/ai-agent-platform.git /app
fi
echo "  代码已更新"

# 3. 构建
echo "[3/5] 构建前端..."
cd /app/client && npm ci && npm run build
echo "[4/5] 构建后端..."
cd /app/server && npm ci && npx tsc

# 4. 重启
echo "[5/5] 重启服务..."
pm2 restart nexmind-platform || pm2 start /app/server/dist/index.js --name nexmind-platform -i 2
pm2 save

# 5. 验证
sleep 5
curl -s https://aibak.site/api/slide/styles | head -c 100
echo ""
echo "=== 初始化完成！之后每次 git push 自动部署 ==="
