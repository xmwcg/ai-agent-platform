#!/usr/bin/env bash
# ============================================================
# 自动部署一键配置脚本（macOS / Linux）
# ------------------------------------------------------------
# 在任意新电脑 clone 本项目后，运行一次即可开启「commit 自动上线」：
#     bash scripts/setup-auto-deploy.sh
#
# 它做三件事（全部幂等，可重复运行）：
#   1) 让 git 使用仓库内钩子目录 scripts/git-hooks（core.hooksPath）
#   2) 确保部署 remote 'cnb' 存在（指向 cnb.cool 部署真源）
#   3) 验证 cnb 推送凭据是否可用，并给出后续指引
# ============================================================
set -uo pipefail

CNB_URL="${CNB_URL:-https://cnb.cool/aibak.site/ai-agent-platform.git}"
REMOTE_NAME="${REMOTE_NAME:-cnb}"
BRANCH="${BRANCH:-main}"

# 定位仓库根（脚本位于 <repo>/scripts/）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
echo "== 仓库根: $REPO_ROOT"

# 0) 确认 git 仓库
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[错误] 当前目录不是 git 仓库"; exit 1
fi

# 1) 启用仓库内钩子目录 + 保证钩子可执行
git config core.hooksPath scripts/git-hooks
git config deploy.remote "$REMOTE_NAME"
git config deploy.branch "$BRANCH"
chmod +x scripts/git-hooks/* 2>/dev/null || true
echo "[1/3] 已设置 core.hooksPath = scripts/git-hooks（钩子随仓库分发）"

# 2) 确保部署 remote 存在
if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  git remote add "$REMOTE_NAME" "$CNB_URL"
  echo "[2/3] 已添加 remote '$REMOTE_NAME' -> $CNB_URL"
else
  echo "[2/3] remote '$REMOTE_NAME' 已存在，跳过"
fi

# 3) 验证凭据（ls-remote 只读）
echo "[3/3] 验证 cnb 推送凭据 ..."
if git ls-remote "$REMOTE_NAME" "$BRANCH" >/dev/null 2>&1; then
  echo "      凭据可用，配置完成！"
  echo ""
  echo ">> 从现在起：在 $BRANCH 分支 git commit 后会自动推送 $REMOTE_NAME/$BRANCH，服务器约 1 分钟内自动部署。"
else
  echo "      [提示] 尚未登录 cnb.cool 凭据。首次推送时会要求登录，或先手动执行一次："
  echo "        git push $REMOTE_NAME $BRANCH"
  echo "      按提示输入 cnb.cool 用户名 + 访问令牌(Token)，凭据会被 git credential helper 记住。"
fi
