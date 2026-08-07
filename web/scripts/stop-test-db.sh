#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="rentapp-test-db"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  echo "Test database stopped."
else
  echo "No test database running."
fi
