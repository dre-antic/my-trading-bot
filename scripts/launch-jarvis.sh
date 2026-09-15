#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"

pick_python() {
  if [[ -x "$ROOT/.venv/bin/python" ]]; then
    ver="$("$ROOT/.venv/bin/python" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    if [[ "$ver" == "3.11" ]]; then
      echo "$ROOT/.venv/bin/python"
      return
    fi
  fi
  if [[ -x /usr/local/bin/python3.11 ]]; then
    echo /usr/local/bin/python3.11
    return
  fi
  if command -v python3.11 >/dev/null 2>&1; then
    command -v python3.11
    return
  fi
  if [[ -x "$ROOT/.venv/bin/python" ]]; then
    ver="$("$ROOT/.venv/bin/python" -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
    if [[ "$ver" == "3.12" || "$ver" == "3.13" ]]; then
      echo "$ROOT/.venv/bin/python"
      return
    fi
  fi
  return 1
}

PY="$(pick_python || true)"
if [[ -z "$PY" ]]; then
  echo "Python 3.11 is required. Do not use Homebrew Python 3.14." >&2
  exit 1
fi
exec "$PY" -m jarvis.launch "$@"
