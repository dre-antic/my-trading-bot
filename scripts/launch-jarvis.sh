#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f .venv/bin/activate ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
if command -v python3.11 >/dev/null 2>&1; then
  exec python3.11 -m jarvis.launch "$@"
fi
exec python3 -m jarvis.launch "$@"
