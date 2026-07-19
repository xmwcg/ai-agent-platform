# local-dev.ps1 — 一键启动本地开发环境（PowerShell 版）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\local-dev.ps1
# 停止：docker compose -f docker-compose.dev.yml down

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "AIbak 本地开发环境启动中..." -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Docker
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host "Docker 运行中" -ForegroundColor Green

# 2. 启动 MongoDB + Redis
Write-Host "启动 MongoDB + Redis..." -ForegroundColor Yellow
docker compose -f docker-compose.dev.yml up -d
if ($LASTEXITCODE -ne 0) { Write-Host "数据库启动失败" -ForegroundColor Red; exit 1 }
Write-Host "数据库就绪（MongoDB localhost:27017 / Redis localhost:6379）" -ForegroundColor Green

# 3. 检查 server/.env
if (-not (Test-Path "server\.env")) {
    Write-Host "server\.env 不存在，从模板创建..." -ForegroundColor Yellow
    Copy-Item "server\.env.local.example" "server\.env"
    Write-Host "已创建 server\.env" -ForegroundColor Green
    Write-Host ""
    Write-Host "请编辑 server\.env 填入以下必填项后重新运行：" -ForegroundColor Cyan
    Write-Host "   - JWT_SECRET（运行: openssl rand -hex 32）"
    Write-Host "   - ENCRYPTION_KEY（运行: openssl rand -hex 32）"
    Write-Host "   - DEEPSEEK_API_KEY（或其他 AI Key）"
    Write-Host "   - 微信支付 6 项凭据（如需测试支付）"
    Write-Host ""
    Write-Host "   或保持 ENABLE_MOCK_MODE=true 快速预览（无需任何 Key）"
    exit 0
}
Write-Host "server\.env 已存在" -ForegroundColor Green

# 4. 安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "安装根依赖..." -ForegroundColor Yellow
    npm install
}
if (-not (Test-Path "server\node_modules")) {
    Write-Host "安装 server 依赖..." -ForegroundColor Yellow
    Push-Location server; npm install; Pop-Location
}
if (-not (Test-Path "client\node_modules")) {
    Write-Host "安装 client 依赖..." -ForegroundColor Yellow
    Push-Location client; npm install; Pop-Location
}
Write-Host "依赖就绪" -ForegroundColor Green

# 5. 启动开发服务器
Write-Host ""
Write-Host "启动开发服务器..." -ForegroundColor Cyan
Write-Host "   前端: http://localhost:5173"
Write-Host "   后端: http://localhost:3000"
Write-Host "   健康检查: http://localhost:3000/api/health"
Write-Host ""
Write-Host "   按 Ctrl+C 停止。数据库保持运行，下次启动更快。" -ForegroundColor Gray
Write-Host ""

npm run dev
