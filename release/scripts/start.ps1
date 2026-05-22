$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$ComposeFile = Join-Path $Root "docker-compose.release.yml"
$EnvFile = Join-Path $Root ".env"

if (-not (Test-Path $ComposeFile)) {
    Write-Host "ERROR: docker-compose.release.yml not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Write-Host "ERROR: .env not found." -ForegroundColor Red
    exit 1
}

docker compose -f $ComposeFile --env-file $EnvFile up -d --force-recreate --remove-orphans