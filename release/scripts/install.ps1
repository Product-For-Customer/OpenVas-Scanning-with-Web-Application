$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$ComposeFile = Join-Path $Root "docker-compose.release.yml"
$EnvFile     = Join-Path $Root ".env"
$ImagesDir   = Join-Path $Root "images"
$ReportsDir  = Join-Path $Root "reports"

function New-RandomSecret {
    param([int]$Bytes = 32)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return ([BitConverter]::ToString($buf) -replace '-', '').ToLower()
}

function Get-EnvValue {
    param([string]$FilePath, [string]$Key)
    if (-not (Test-Path $FilePath)) { return "" }
    $line = Get-Content $FilePath | Where-Object { $_ -match "^\s*$Key\s*=" } | Select-Object -First 1
    if (-not $line) { return "" }
    return ($line -replace "^\s*$Key\s*=", "").Trim()
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "      MySCanner  Installation         " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker not found. Please install Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker daemon is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

foreach ($required in @($ComposeFile, $ImagesDir)) {
    if (-not (Test-Path $required)) {
        Write-Host "ERROR: Required file/folder not found: $required" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[1/5] Prerequisites OK" -ForegroundColor Green

if (Test-Path $EnvFile) {
    Write-Host "[2/5] Found existing .env - using it as-is" -ForegroundColor Green
    $ServerIP = Get-EnvValue -FilePath $EnvFile -Key "VITE_BACKEND_URL"
    $ServerIP = $ServerIP -replace '^http://', '' -replace ':\d+$', ''
} else {
    Write-Host ""
    Write-Host "Enter this server's IP address (e.g. 192.168.1.100):" -ForegroundColor Yellow
    $ServerIP = Read-Host "  Server IP"

    if (-not $ServerIP -or $ServerIP -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
        Write-Host "ERROR: Invalid IP address format." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Enter the public API URL for LINE PDF links." -ForegroundColor Yellow
    Write-Host "  (Press Enter to use default: http://${ServerIP}:9000)" -ForegroundColor DarkGray
    Write-Host "  Example: https://your-tunnel.trycloudflare.com" -ForegroundColor DarkGray
    $PathApiUrl = Read-Host "  Public API URL"

    if (-not $PathApiUrl) {
        $PathApiUrl = "http://${ServerIP}:9000"
    }

    $JwtSecret       = New-RandomSecret -Bytes 32
    $AutomationToken = New-RandomSecret -Bytes 24
    $DbPassword      = New-RandomSecret -Bytes 16

    $envContent = @"
DATABASE_URL=host=pg-gvm port=5432 user=pbi password=$DbPassword dbname=gvmd sslmode=disable
DB_PASSWORD=$DbPassword
PORT=9000
AUTOMATION_TOKEN=$AutomationToken
JWT_SECRET=$JwtSecret
PATH_API_URL=$PathApiUrl
CORS_ALLOWED_ORIGINS=http://${ServerIP}:5173,http://frontend
VITE_BACKEND_URL=http://${ServerIP}:9000
VITE_OPENVAS_URL=http://${ServerIP}:9392
"@
    [System.IO.File]::WriteAllText($EnvFile, $envContent, [System.Text.Encoding]::UTF8)
    Write-Host "[2/5] .env created and secrets generated" -ForegroundColor Green
}

if (-not (Test-Path $ReportsDir)) {
    New-Item -ItemType Directory -Path $ReportsDir | Out-Null
}

Write-Host "[3/5] Directories ready" -ForegroundColor Green

Write-Host ""
Write-Host "[4/5] Loading Docker images..." -ForegroundColor Cyan

$images = @(
    "myscanner-backend-1.0.0.tar",
    "myscanner-frontend-1.0.0.tar",
    "myscanner-dbinit-1.0.0.tar"
)

foreach ($imgFile in $images) {
    $imgPath = Join-Path $ImagesDir $imgFile
    if (-not (Test-Path $imgPath)) {
        Write-Host "ERROR: Image not found: $imgPath" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Loading $imgFile..."
    docker load -i $imgPath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to load image: $imgFile" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[4/5] Images loaded" -ForegroundColor Green

Write-Host ""
Write-Host "[5/5] Starting services..." -ForegroundColor Cyan
docker compose -f $ComposeFile --env-file $EnvFile up -d --force-recreate --remove-orphans
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose failed." -ForegroundColor Red
    exit 1
}

Write-Host "[5/5] Services started" -ForegroundColor Green

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "       Installation Complete!         " -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend : http://${ServerIP}:5173" -ForegroundColor Cyan
Write-Host "  Backend  : http://${ServerIP}:9000" -ForegroundColor Cyan
Write-Host "  OpenVAS  : http://${ServerIP}:9392" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NOTE: First startup may take 20-30 minutes" -ForegroundColor Yellow
Write-Host "  (Greenbone feeds downloading in background)" -ForegroundColor Yellow
Write-Host ""
