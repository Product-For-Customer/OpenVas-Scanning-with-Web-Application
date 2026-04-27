#!/bin/sh
set -eu

: "${VITE_BACKEND_URL:=http://localhost:9000}"
: "${VITE_OPENVAS_URL:=http://localhost:9392}"

envsubst '${VITE_BACKEND_URL} ${VITE_OPENVAS_URL}' \
  < /usr/share/nginx/html/env-config.template.js \
  > /usr/share/nginx/html/env-config.js

exec "$@"