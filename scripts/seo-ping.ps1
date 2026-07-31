<#
.SYNOPSIS  AIbak.site SEO Ping 脚本（PowerShell版）
#>
param([string]$BaiduToken, [string]$BingApiKey)

$sitemapUrl = "https://aibak.site/sitemap.xml"
$domain = "aibak.site"

Write-Host "=== AIbak.site SEO Ping ===" -ForegroundColor Cyan
Write-Host "时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# ─── Google Ping ───
try {
  Write-Host "[Google] Ping sitemap..." -ForegroundColor Yellow
  $resp = Invoke-WebRequest -Uri "https://www.google.com/ping?sitemap=$sitemapUrl" -Method GET -TimeoutSec 10 -UseBasicParsing
  Write-Host "[Google] $($resp.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "[Google] ERR: $_" -ForegroundColor Red
}

# ─── Bing IndexNow ───
try {
  Write-Host "[Bing/IndexNow] 提交..." -ForegroundColor Yellow
  $body = @{
    host = $domain
    key = "indexnow-key-aibak"
    keyLocation = "https://$domain/indexnow-key-aibak.txt"
    urlList = @(
      "https://$domain/jinwangtong",
      "https://$domain/jinwangtong-demo",
      "https://$domain/project-grade",
      "https://$domain/project-grade/demo",
      "https://$domain/pricing",
      "https://$domain/landing/saas"
    )
  } | ConvertTo-Json
  $resp = Invoke-WebRequest -Uri "https://api.indexnow.org/indexnow" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10 -UseBasicParsing
  Write-Host "[IndexNow] $($resp.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "[IndexNow] ERR: $_" -ForegroundColor Red
}

# ─── 百度主动推送 ───
if ($BaiduToken) {
  try {
    Write-Host "[百度] 主动推送..." -ForegroundColor Yellow
    $urls = @(
      "https://$domain/jinwangtong",
      "https://$domain/jinwangtong-demo",
      "https://$domain/project-grade",
      "https://$domain/project-grade/demo",
      "https://$domain/pricing",
      "https://$domain/landing/saas",
      "https://$domain/landing/ecommerce",
      "https://$domain/landing/fintech"
    ) -join "`n"
    $resp = Invoke-WebRequest -Uri "https://data.zz.baidu.com/urls?site=https://$domain&token=$BaiduToken" -Method POST -Body $urls -ContentType "text/plain" -TimeoutSec 10 -UseBasicParsing
    Write-Host "[百度] 响应: $($resp.Content)" -ForegroundColor Green
  } catch {
    Write-Host "[百度] ERR: $_" -ForegroundColor Red
  }
} else {
  Write-Host "[百度] 跳过（未提供 BaiduToken）" -ForegroundColor DarkGray
  Write-Host "  提示: .\seo-ping.ps1 -BaiduToken <your_token>" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Cyan
