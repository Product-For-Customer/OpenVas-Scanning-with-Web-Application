$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".\.env")) {
    if (Test-Path ".\.env.example") {
        Copy-Item ".\.env.example" ".\.env"
        Write-Host "Created .env from .env.example" -ForegroundColor Yellow
        Write-Host "Please edit .env first, then run install.ps1 again." -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "ERROR: .env and .env.example not found." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Loading backend image..."
docker load -i .\images\myscanner-backend-1.0.0.tar

Write-Host "Loading frontend image..."
docker load -i .\images\myscanner-frontend-1.0.0.tar

Write-Host "Starting services..."
docker compose -f docker-compose.release.yml up -d

Write-Host "Done." -ForegroundColor Green