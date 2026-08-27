#!/bin/sh
# Installs db-web into ./db-web (or $DB_WEB_DIR) and starts it with Docker Compose.
#   curl -fsSL https://raw.githubusercontent.com/hassan-mehedi/db-web/dev/install.sh | sh
# Env: DB_WEB_DIR, DB_WEB_REF (branch or tag, default dev), BIND_IP, ADMIN_PORT,
# POSTGRES_PORT, DB_WEB_URL, DB_WEB_IMAGE, DB_WEB_SOURCE (local checkout instead of download).
set -eu

REF="${DB_WEB_REF:-dev}"
DIR="${DB_WEB_DIR:-./db-web}"
RAW="https://raw.githubusercontent.com/hassan-mehedi/db-web/${REF}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 1; }; }
need docker
docker compose version >/dev/null 2>&1 || { echo "missing: docker compose plugin" >&2; exit 1; }

fetch() {
  if [ -n "${DB_WEB_SOURCE:-}" ]; then cp "${DB_WEB_SOURCE}/$1" "$2"
  else need curl; curl -fsSL "${RAW}/$1" -o "$2"; fi
}

secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 24
  else head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

mkdir -p "${DIR}/init"
fetch compose.yml "${DIR}/compose.yml"
fetch infra/sql/01-app-admin.sh "${DIR}/init/01-app-admin.sh"
chmod +x "${DIR}/init/01-app-admin.sh"

if [ ! -f "${DIR}/.env" ]; then
  BIND="${BIND_IP:-127.0.0.1}"
  PORT="${ADMIN_PORT:-3100}"
  cat > "${DIR}/.env" <<ENV
BIND_IP=${BIND}
ADMIN_PORT=${PORT}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
DB_WEB_URL=${DB_WEB_URL:-http://${BIND}:${PORT}}
DB_WEB_IMAGE=${DB_WEB_IMAGE:-ghcr.io/hassan-mehedi/db-web-admin:latest}
POSTGRES_SUPERUSER_PASSWORD=$(secret)
APP_ADMIN_PASSWORD=$(secret)
BETTER_AUTH_SECRET=$(secret)
ENV
  chmod 600 "${DIR}/.env"
  echo "wrote ${DIR}/.env"
else
  echo "keeping existing ${DIR}/.env"
fi

cd "${DIR}"
docker compose pull --quiet 2>/dev/null || true
docker compose up -d
. ./.env
echo
echo "db-web is starting at ${DB_WEB_URL}"
echo "Open it in a browser to create the admin user. Upgrade later with:"
echo "  cd ${DIR} && docker compose pull && docker compose up -d"
