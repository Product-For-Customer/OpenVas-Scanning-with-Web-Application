#!/usr/bin/env bash
set -uo pipefail

COMPOSE_DIR="${OPENVAS_COMPOSE_WORKDIR:-/workspace}"
FORCE_UPDATE="${FEED_FORCE_UPDATE:-false}"

echo "=================================================="
echo "[$(date -Iseconds)] START feed update automation"
echo "Using compose dir: ${COMPOSE_DIR}"
echo "Force update: ${FORCE_UPDATE}"

# เช็ก compose file
if [ ! -f "${COMPOSE_DIR}/docker-compose.yml" ] && [ ! -f "${COMPOSE_DIR}/compose.yml" ]; then
  echo "ERROR: docker-compose.yml or compose.yml not found in ${COMPOSE_DIR}"
  echo "UPDATED=false"
  echo "RESULT_TYPE=failed"
  exit 1
fi

if [ -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
  COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
else
  COMPOSE_FILE="${COMPOSE_DIR}/compose.yml"
fi

echo "Resolved compose file: ${COMPOSE_FILE}"

# เช็ก docker daemon
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: docker daemon is not available"
  echo "UPDATED=false"
  echo "RESULT_TYPE=failed"
  exit 1
fi

# เช็ก compose syntax
if ! docker compose -f "${COMPOSE_FILE}" config >/dev/null 2>&1; then
  echo "ERROR: docker compose config is invalid"
  echo "UPDATED=false"
  echo "RESULT_TYPE=failed"
  exit 1
fi

FEED_SERVICES=(
  vulnerability-tests
  notus-data
  scap-data
  cert-bund-data
  dfn-cert-data
  report-formats
  data-objects
  gpg-data
)

# map image แบบชัดเจน เลิก parse YAML ด้วย awk
declare -A SERVICE_IMAGE=(
  [vulnerability-tests]="registry.community.greenbone.net/community/vulnerability-tests"
  [notus-data]="registry.community.greenbone.net/community/notus-data"
  [scap-data]="registry.community.greenbone.net/community/scap-data"
  [cert-bund-data]="registry.community.greenbone.net/community/cert-bund-data"
  [dfn-cert-data]="registry.community.greenbone.net/community/dfn-cert-data"
  [report-formats]="registry.community.greenbone.net/community/report-formats"
  [data-objects]="registry.community.greenbone.net/community/data-objects"
  [gpg-data]="registry.community.greenbone.net/community/gpg-data"
)

declare -A IMAGE_ID_BEFORE
declare -A IMAGE_ID_AFTER

UPDATED=false
PULL_FAILED=false
CHANGED_SERVICES=()

retry_pull() {
  local image_ref="$1"
  local max_attempts=3
  local attempt=1
  local rc=0

  while [ $attempt -le $max_attempts ]; do
    echo "Pull attempt ${attempt}/${max_attempts} for ${image_ref}"
    docker pull "${image_ref}"
    rc=$?

    if [ $rc -eq 0 ]; then
      return 0
    fi

    if [ $attempt -lt $max_attempts ]; then
      echo "WARN: pull failed for ${image_ref}, retrying in 15s..."
      sleep 15
    fi

    attempt=$((attempt + 1))
  done

  return $rc
}

echo "Feed services: ${FEED_SERVICES[*]}"
echo "Checking feed images one by one..."

for svc in "${FEED_SERVICES[@]}"; do
  img_ref="${SERVICE_IMAGE[$svc]}"

  if [ -z "${img_ref}" ]; then
    echo "ERROR: image ref is empty for service '${svc}'"
    PULL_FAILED=true
    continue
  fi

  before_id="$(docker image inspect "${img_ref}" --format '{{.Id}}' 2>/dev/null || echo 'none')"
  IMAGE_ID_BEFORE["$svc"]="${before_id}"

  echo "--------------------------------------------------"
  echo "Service: ${svc}"
  echo "Image:   ${img_ref}"
  echo "Before:  ${before_id}"

  if ! retry_pull "${img_ref}"; then
    echo "ERROR: failed to pull image for service '${svc}' (${img_ref}) after retries"
    PULL_FAILED=true
    continue
  fi

  after_id="$(docker image inspect "${img_ref}" --format '{{.Id}}' 2>/dev/null || echo 'none')"
  IMAGE_ID_AFTER["$svc"]="${after_id}"

  echo "After:   ${after_id}"

  if [ "${before_id}" != "${after_id}" ]; then
    UPDATED=true
    CHANGED_SERVICES+=("${svc}")
    echo "Detected update for service '${svc}'"
  else
    echo "No image change for service '${svc}'"
  fi
done

if [ "${PULL_FAILED}" = true ]; then
  echo "ERROR: one or more image pulls failed"
  echo "UPDATED=false"
  echo "RESULT_TYPE=failed"
  echo "[$(date -Iseconds)] FEED UPDATE FAILED"
  echo "=================================================="
  exit 1
fi

if [ "${UPDATED}" = false ] && [ "${FORCE_UPDATE}" != "true" ]; then
  echo "No new feed updates found."
  echo "UPDATED=false"
  echo "RESULT_TYPE=no_update"
  echo "[$(date -Iseconds)] FEED CHECK DONE (NO UPDATE)"
  echo "=================================================="
  exit 0
fi

echo "Refreshing feed/data services..."

if [ "${#CHANGED_SERVICES[@]}" -gt 0 ]; then
  echo "Changed services: ${CHANGED_SERVICES[*]}"
else
  echo "No image ID changes detected, but refresh will run because force=true"
fi

echo "Running: docker compose -f ${COMPOSE_FILE} up -d ${FEED_SERVICES[*]}"
UP_OUTPUT="$(docker compose -f "${COMPOSE_FILE}" up -d "${FEED_SERVICES[@]}" 2>&1)"
UP_EXIT=$?

echo "----- BEGIN docker compose up output -----"
echo "${UP_OUTPUT}"
echo "----- END docker compose up output -----"

if [ $UP_EXIT -ne 0 ]; then
  echo "ERROR: docker compose up failed"
  echo "UPDATED=false"
  echo "RESULT_TYPE=failed"
  echo "[$(date -Iseconds)] FEED UPDATE FAILED"
  echo "=================================================="
  exit 1
fi

echo "Restarting dependent services to load refreshed feed..."
docker compose -f "${COMPOSE_FILE}" restart gvmd ospd-openvas openvasd openvas || true

echo "UPDATED=true"
echo "RESULT_TYPE=updated"
echo "[$(date -Iseconds)] FEED UPDATE AUTOMATION DONE"
echo "=================================================="
exit 0