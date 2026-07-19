# local-prod.ps1 — 一键启动本地生产级预览（PowerShell 版）
# 用法：powershell -ExecutionPolicy Bypass -File scripts\local-prod.ps1
# 停止：docker compose -f docker-compose.local.yml down

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host "AIbak 本地生产级预览启动中..." -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Docker
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host "Docker 运行中" -ForegroundColor Green

# 2. 检查 server/.env.local
if (-not (Test-Path "server\.env.local")) {
    Write-Host "server\.env.local 不存在，从模板创建..." -ForegroundColor Yellow
    Copy-Item "server\.env.local.example" "server\.env.local"
    Write-Host "已创建 server\.env.local" -ForegroundColor Green
    Write-Host ""
    Write-Host "请编辑 server\.env.local 填入以下必填项后重新运行：" -ForegroundColor Cyan
    Write-Host "   - JWT_SECRET（运行: openssl rand -hex 32）"
    Write-Host "   - ENCRYPTION_KEY（运行: openssl rand -hex 32）"
    Write-Host "   - DEEPSEEK_API_KEY（或其他 AI Key）"
    Write-Host "   - 微信支付 6 项凭据（如需测试支付）"
    Write-Host "   - DOUYIN_CLIENT_KEY/SECRET（如需抖音登录）"
    Write-Host ""
    Write-Host "   或保持 ENABLE_MOCK_MODE=true 快速预览（无需任何 Key）"
    exit 0
}
Write-Host "server\.env.local 已存在" -ForegroundColor Green

# 3. 构建并启动全套服务
Write-Host "构建并启动 MongoDB + Redis + Server + Client..." -ForegroundColor Yellow
docker compose -f docker-compose.local.yml up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "启动失败" -ForegroundColor Red; exit 1 }
Write-Host "全套服务已启动" -ForegroundColor Green

# 4. 等待健康检查通过
Write-Host "等待后端健康检查通过..." -ForegroundColor Yellow
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "后端健康检查通过" -ForegroundColor Green
            break
        }
    } catch {
        if ($i -eq 30) {
            Write-Host "后端健康检查超时（30s），请检查日志" -ForegroundColor Yellow
        }
        Start-Sleep -Seconds 1
    }
}

# 5. 可选：种子数据
if ($args[0] -eq "--seed") {
    Write-Host "正在导入种子数据..." -ForegroundColor Yellow
    docker compose -f docker-compose.local.yml exec -T server npm run seed
    Write-Host "种子数据导入完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "本地生产级预览已就绪！" -ForegroundColor Cyan
Write-Host "   访问地址: http://localhost:8080"
Write-Host "   后端 API: http://localhost:3000"
Write-Host "   健康检查: http://localhost:3000/api/health"
Write-Host ""
Write-Host "   停止: docker compose -f docker-compose.local.yml down"
Write-Host "   日志: docker compose -f docker-compose.local.yml logs -f"
Write-Host "   种子数据: powershell -File scripts\local-prod.ps1 --seed"
