$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

docker compose -f docker-compose.release.yml up -d