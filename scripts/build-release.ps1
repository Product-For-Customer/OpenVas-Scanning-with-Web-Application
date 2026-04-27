$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".\images")) {
    New-Item -ItemType Directory -Path ".\images" | Out-Null
}

Write-Host "Building backend image..."
docker build -t myscanner-backend:1.0.0 ./backend

Write-Host "Building frontend image..."
docker build -t myscanner-frontend:1.0.0 ./frontend

Write-Host "Saving backend image..."
docker save -o .\images\myscanner-backend-1.0.0.tar myscanner-backend:1.0.0

Write-Host "Saving frontend image..."
docker save -o .\images\myscanner-frontend-1.0.0.tar myscanner-frontend:1.0.0

Write-Host "Build release completed." -ForegroundColor Green