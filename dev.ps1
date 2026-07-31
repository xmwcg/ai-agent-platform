#!/usr/bin/env pwsh
# dev.ps1 — Smart dev launcher: probes ports, starts only what's missing
# Usage: double-click this file, or run: .\dev.ps1

$ErrorActionPreference = "Continue"
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

function Test-Port($port) {
  $l = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
  return [bool]$l
}

$backendUp = Test-Port 3000
$frontendUp = Test-Port 5173

Write-Host ""
Write-Host "  NexMind Platform - Local Dev" -ForegroundColor Cyan
Write-Host "  -----------------------------"
Write-Host ""

if ($backendUp) { Write-Host "  Backend  (3000)  running" -ForegroundColor Green }
else            { Write-Host "  Backend  (3000)  NOT running" -ForegroundColor Yellow }

if ($frontendUp) { Write-Host "  Frontend (5173)  running" -ForegroundColor Green }
else             { Write-Host "  Frontend (5173)  NOT running" -ForegroundColor Yellow }

if ($backendUp -and $frontendUp) {
  Write-Host ""
  Write-Host "  Both running. Opening http://localhost:5173" -ForegroundColor Cyan
  Start-Process "http://localhost:5173"
  exit 0
}

if (-not $backendUp) {
  Write-Host ""
  Write-Host "  Starting backend..." -ForegroundColor Yellow
  Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\server'; npm run dev" -WindowStyle Minimized
}

if (-not $frontendUp) {
  Write-Host ""
  Write-Host "  Starting frontend..." -ForegroundColor Yellow
  Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\client'; npm run dev" -WindowStyle Minimized
}

Write-Host ""
Write-Host "  Waiting for frontend to compile..." -ForegroundColor Gray
$tries = 0
while ($tries -lt 30) {
  Start-Sleep -Seconds 2
  if (Test-Port 5173) { break }
  $tries++
}

if (Test-Port 5173) {
  Write-Host ""
  Write-Host "  Frontend ready. Opening http://localhost:5173" -ForegroundColor Green
  Start-Process "http://localhost:5173"
} else {
  Write-Host ""
  Write-Host "  Still compiling. Open http://localhost:5173 manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Close backend/frontend windows to stop services." -ForegroundColor Gray
Write-Host ""
