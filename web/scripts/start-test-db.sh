#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="rentapp-test-db"
IMAGE="postgres:15"
PORT="54323"
DB="rentapp_test"
USER="postgres"
PASS="postgres"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
fi

docker run -d \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_USER="${USER}" \
  -e POSTGRES_PASSWORD="${PASS}" \
  -e POSTGRES_DB="${DB}" \
  -p "${PORT}:5432" \
  "${IMAGE}" \
  postgres -c fsync=off -c full_page_writes=off >/dev/null

# Wait for Postgres to be ready
for _ in $(seq 1 30); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U "${USER}" -d "${DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo "TEST_DATABASE_URL=postgresql://${USER}:${PASS}@localhost:${PORT}/${DB}"
echo "Test database ready. Use scripts/stop-test-db.sh to stop it."
