# ============================================================
# 自动部署一键配置脚本（Windows / PowerShell）
# ------------------------------------------------------------
# 在任意新电脑 clone 本项目后，运行一次即可开启「commit 自动上线」：
#     powershell -ExecutionPolicy Bypass -File scripts\setup-auto-deploy.ps1
#
# 它做三件事（全部幂等，可重复运行）：
#   1) 让 git 使用仓库内钩子目录 scripts/git-hooks（core.hooksPath）
#   2) 确保部署 remote 'cnb' 存在（指向 cnb.cool 部署真源）
#   3) 验证 cnb 推送凭据是否可用，并给出后续指引
# ============================================================
param(
  [string]$CnbUrl = "https://cnb.cool/aibak.site/ai-agent-platform.git",
  [string]$RemoteName = "cnb",
  [string]$Branch = "main"
)

# 注意：不要用 "Stop"，git 常把普通信息写入 stderr，会被误判为致命错误
$ErrorActionPreference = "Continue"

# 定位仓库根（脚本位于 <repo>/scripts/）
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
Write-Host "== 仓库根: $RepoRoot" -ForegroundColor Cyan

# 0) 确认这是一个 git 仓库
git rev-parse --is-inside-work-tree 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[错误] 当前目录不是 git 仓库" -ForegroundColor Red; exit 1 }

# 1) 启用仓库内钩子目录
git config core.hooksPath scripts/git-hooks
git config deploy.remote $RemoteName
git config deploy.branch $Branch
Write-Host "[1/3] 已设置 core.hooksPath = scripts/git-hooks（钩子随仓库分发）" -ForegroundColor Green

# 2) 确保部署 remote 存在
git remote get-url $RemoteName 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  git remote add $RemoteName $CnbUrl
  Write-Host "[2/3] 已添加 remote '$RemoteName' -> $CnbUrl" -ForegroundColor Green
} else {
  Write-Host "[2/3] remote '$RemoteName' 已存在，跳过" -ForegroundColor Green
}

# 3) 验证凭据（可选，只读；网络慢时可跳过，不影响已完成的配置）
Write-Host "[3/3] 核心配置已完成。可选：验证 cnb 凭据（如网络慢可 Ctrl+C 跳过，不影响配置）..." -ForegroundColor Cyan
if ($env:SKIP_VERIFY -ne "1") {
  git ls-remote $RemoteName $Branch 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "      凭据可用，全部就绪！" -ForegroundColor Green
  } else {
    Write-Host "      [提示] 尚未登录 cnb.cool 凭据。首次推送时会弹出登录，或先手动执行一次：" -ForegroundColor Yellow
    Write-Host "        git push $RemoteName $Branch" -ForegroundColor Yellow
    Write-Host "      按提示输入 cnb.cool 用户名 + 访问令牌(Token) 后，凭据会被 Windows 凭据管理器记住。" -ForegroundColor Yellow
  }
}
Write-Host ""
Write-Host "配置完成：从现在起在 $Branch 分支 git commit 后会自动推送 $RemoteName/$Branch，服务器约 1 分钟内自动部署。" -ForegroundColor Yellow
