#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="${1:-matrix.local}"
REPORT_STATS="${2:-no}"

mkdir -p synapse-data

echo "[1/3] Генерируем конфиг Synapse для ${SERVER_NAME}..."
docker compose run --rm \
  -e SYNAPSE_SERVER_NAME="${SERVER_NAME}" \
  -e SYNAPSE_REPORT_STATS="${REPORT_STATS}" \
  synapse generate

echo "[2/3] Проверяем файл synapse-data/homeserver.yaml..."
if [[ ! -f synapse-data/homeserver.yaml ]]; then
  echo "homeserver.yaml не найден. Генерация не удалась." >&2
  exit 1
fi

echo "[3/3] Готово. Запускайте стек: docker compose up -d"
