$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$Version = "1.0.0"
$BackendImage  = "myscanner-backend:$Version"
$FrontendImage = "myscanner-frontend:$Version"
$DbInitImage   = "myscanner-dbinit:$Version"

$ReleaseDir = Join-Path $Root "release"
$ImagesDir = Join-Path $ReleaseDir "images"
$ReleaseScriptsDir = Join-Path $ReleaseDir "scripts"

Write-Host "Cleaning release folder..." -ForegroundColor Yellow
if (Test-Path $ReleaseDir) {
    Remove-Item $ReleaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $ImagesDir -Force | Out-Null
New-Item -ItemType Directory -Path $ReleaseScriptsDir -Force | Out-Null

Write-Host "Building backend image..." -ForegroundColor Cyan
docker build -t $BackendImage ./backend

Write-Host "Building frontend image..." -ForegroundColor Cyan
docker build -t $FrontendImage ./frontend

Write-Host "Building dbinit image..." -ForegroundColor Cyan
docker build -f ./backend/Dockerfile.dbinit -t $DbInitImage ./backend

Write-Host "Saving backend image..." -ForegroundColor Cyan
docker save -o (Join-Path $ImagesDir "myscanner-backend-$Version.tar") $BackendImage

Write-Host "Saving frontend image..." -ForegroundColor Cyan
docker save -o (Join-Path $ImagesDir "myscanner-frontend-$Version.tar") $FrontendImage

Write-Host "Saving dbinit image..." -ForegroundColor Cyan
docker save -o (Join-Path $ImagesDir "myscanner-dbinit-$Version.tar") $DbInitImage

Write-Host "Copying release files..." -ForegroundColor Cyan

Copy-Item (Join-Path $Root "docker-compose.release.yml") (Join-Path $ReleaseDir "docker-compose.release.yml") -Force

Copy-Item (Join-Path $Root "scripts\install.ps1") (Join-Path $ReleaseScriptsDir "install.ps1") -Force
Copy-Item (Join-Path $Root "scripts\start.ps1") (Join-Path $ReleaseScriptsDir "start.ps1") -Force
Copy-Item (Join-Path $Root "scripts\status.ps1") (Join-Path $ReleaseScriptsDir "status.ps1") -Force
Copy-Item (Join-Path $Root "scripts\stop.ps1") (Join-Path $ReleaseScriptsDir "stop.ps1") -Force
Copy-Item (Join-Path $Root "scripts\logs.ps1") (Join-Path $ReleaseScriptsDir "logs.ps1") -Force
Copy-Item (Join-Path $Root "scripts\reset.ps1") (Join-Path $ReleaseScriptsDir "reset.ps1") -Force

Write-Host ""
Write-Host "Build release completed." -ForegroundColor Green
Write-Host "Release folder: $ReleaseDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Send only the release/ folder to customer" -ForegroundColor Yellow
Write-Host "  2. Customer runs: .\scripts\install.ps1" -ForegroundColor Yellow