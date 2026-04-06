#!/usr/bin/env bash
set -euo pipefail

echo "Скрипт init-synapse.sh устарел. Используйте scripts/init-tuwunel.sh"
exec "$(dirname "$0")/init-tuwunel.sh" "$@"
