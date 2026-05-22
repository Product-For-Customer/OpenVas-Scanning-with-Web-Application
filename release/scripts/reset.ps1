$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$ComposeFile = Join-Path $Root "docker-compose.release.yml"
$EnvFile     = Join-Path $Root ".env"

Write-Host ""
Write-Host "======================================" -ForegroundColor Red
Write-Host "       Reset All Data & Restart       " -ForegroundColor Red
Write-Host "======================================" -ForegroundColor Red
Write-Host ""
Write-Host "WARNING: This will remove ALL data including database volumes." -ForegroundColor Yellow
$confirm = Read-Host "Type YES to confirm"

if ($confirm -ne "YES") {
    Write-Host "Cancelled." -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "Stopping and removing all containers and volumes..." -ForegroundColor Cyan
docker compose -f $ComposeFile --env-file $EnvFile down -v --remove-orphans

Write-Host "Done. Run install.ps1 to reinstall." -ForegroundColor Green
Write-Host ""
