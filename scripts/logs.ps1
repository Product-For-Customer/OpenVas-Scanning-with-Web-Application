$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ComposeFile = Join-Path $Root "docker-compose.release.yml"
$EnvFile     = Join-Path $Root ".env"

docker compose -f $ComposeFile --env-file $EnvFile logs -f backend
