#!/usr/bin/env bash
# Idempotent setup for Cursor Cloud Agents (and any Linux dev machine).
# Installs the system tools the studio needs, then the Python package.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# System dependencies: FFmpeg (editing/render) and eSpeak NG (default voice).
# The default Cursor image ships FFmpeg + Python 3.12; eSpeak NG is the only
# addition normally required. Guard on the binaries so re-runs are cheap.
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v espeak-ng >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then APT="sudo apt-get"; else APT="apt-get"; fi
  $APT update -qq
  $APT install -y --no-install-recommends ffmpeg espeak-ng python3-venv python3-dev
fi

# Python virtual environment (created once, refreshed on every run).
if [[ ! -x .venv/bin/python ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"

echo "AI Video Studio environment is ready."
