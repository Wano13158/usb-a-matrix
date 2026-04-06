#!/usr/bin/env bash
set -euo pipefail

ARCH="$(uname -m)"

case "${ARCH}" in
  x86_64|amd64)
    TARGET="x86_64-unknown-linux-gnu"
    ;;
  aarch64|arm64)
    TARGET="aarch64-unknown-linux-gnu"
    ;;
  *)
    echo "Неподдерживаемая архитектура: ${ARCH}" >&2
    echo "Используйте Docker Compose (он мультиарх) или установите Tuwunel вручную." >&2
    exit 1
    ;;
esac

URL="https://github.com/matrix-construct/tuwunel/releases/latest/download/tuwunel-${TARGET}"

echo "Скачиваю Tuwunel для ${ARCH} (${TARGET})..."
curl -fsSL "${URL}" -o tuwunel
chmod +x tuwunel
sudo mv tuwunel /usr/local/bin/tuwunel

echo "Готово: /usr/local/bin/tuwunel"
