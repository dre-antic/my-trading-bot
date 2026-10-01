#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
HOST="${TRADINGBOT_HOST:-127.0.0.1}"
PORT="${TRADINGBOT_PORT:-8765}"
echo "Trading desk: http://${HOST}:${PORT}"
exec python -m tradingbot.cli serve --host "$HOST" --port "$PORT"
