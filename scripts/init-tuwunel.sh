#!/usr/bin/env bash
set -euo pipefail

SERVER_NAME="${1:-matrix.local}"
ALLOW_REGISTRATION="${2:-true}"
REGISTRATION_TOKEN="${3:-}"

mkdir -p tuwunel-data

cat > .env.tuwunel <<EOF
TUWUNEL_SERVER_NAME=${SERVER_NAME}
TUWUNEL_ALLOW_REGISTRATION=${ALLOW_REGISTRATION}
TUWUNEL_REGISTRATION_TOKEN=${REGISTRATION_TOKEN}
EOF

echo "[1/2] Создана .env.tuwunel с параметрами Tuwunel."
echo "[2/2] Готово. Скопируйте значения в .env и запустите: docker compose up -d --build"
