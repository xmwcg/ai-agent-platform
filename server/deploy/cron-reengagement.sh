#!/bin/bash
# ──────────────────────────────────────────────────────────
# AIbak 运营自动化 Cron 安装脚本
# 用途：在服务器上注册定时任务，每天凌晨 3:00 执行用户召回与到期提醒
# 使用：bash deploy/cron-reengagement.sh
# ──────────────────────────────────────────────────────────

set -euo pipefail

CRON_JOB='0 3 * * * cd /opt/ai-agent-platform/server && npx ts-node src/scripts/cron-engagement.ts >> /var/log/aibak-cron.log 2>&1'
CRON_MARKER="# AIbak engagement cron"

echo ">>> 检查已有 cron 任务..."
if crontab -l 2>/dev/null | grep -qF "cron-engagement.ts"; then
    echo "⚠️  已存在 AIbak cron 任务，跳过安装。"
    echo "    如需重新安装，请先执行：crontab -l | grep -v 'cron-engagement.ts' | crontab -"
    exit 0
fi

echo ">>> 安装 cron 任务..."
(crontab -l 2>/dev/null; echo "$CRON_MARKER"; echo "$CRON_JOB") | crontab -

echo ">>> 验证安装..."
crontab -l | grep -A1 "$CRON_MARKER"

echo ""
echo "✅ Cron 任务已安装！每天凌晨 3:00 执行。"
echo "   日志文件：/var/log/aibak-cron.log"
echo ""
echo "   管理命令："
echo "   - 查看任务：crontab -l"
echo "   - 删除任务：crontab -l | grep -v 'cron-engagement.ts' | crontab -"
echo "   - 手动执行：cd /opt/ai-agent-platform/server && npx ts-node src/scripts/cron-engagement.ts"