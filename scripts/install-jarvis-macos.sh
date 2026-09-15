#!/usr/bin/env bash
# First-time install on the 2013 Intel MacBook Pro.
# Makes a Dock-launchable JARVIS.app that runs on THIS Mac.
# Does not talk to a cloud JARVIS. Does not use Docker. Does not use Python 3.14.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing JARVIS as a local Mac app (not a cloud dashboard)."
echo "Project folder: $ROOT"

PY=""
if [[ -x /usr/local/bin/python3.11 ]]; then
  PY=/usr/local/bin/python3.11
elif command -v python3.11 >/dev/null 2>&1; then
  PY="$(command -v python3.11)"
else
  echo "Python 3.11 is required."
  echo "Install it once with Homebrew:"
  echo "  brew install python@3.11"
  echo "Do not use Homebrew python 3.14 — it can freeze while compiling extra packages."
  exit 1
fi

PY_MM="$("$PY" -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
if [[ "$PY_MM" == "3.14" ]]; then
  echo "Refusing Python $PY_MM at $PY"
  echo "JARVIS must use Python 3.11 on this Intel Mac."
  exit 1
fi

echo "Using $PY ($PY_MM)"
chmod +x "$ROOT/scripts/build-jarvis-macos.sh" "$ROOT/packaging/macos/JARVIS.app/Contents/MacOS/JARVIS" || true
# --clear replaces a leftover Homebrew 3.14 venv so Dock does not inherit it.
"$PY" -m venv --clear "$ROOT/.venv"
# shellcheck disable=SC1091
source "$ROOT/.venv/bin/activate"
VENV_MM="$(python -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
if [[ "$VENV_MM" == "3.14" ]]; then
  echo "The venv is still Python 3.14. Stop and use /usr/local/bin/python3.11."
  exit 1
fi
python -m pip install -U pip
# Core JARVIS is the standard library. No cryptography / numpy / Docker.
python -m pip install -e "$ROOT"

mkdir -p "$HOME/Applications"
"$ROOT/scripts/build-jarvis-macos.sh" "$HOME/Applications/JARVIS.app"

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$HOME/Applications/JARVIS.app" 2>/dev/null || true
fi

echo
echo "Done. JARVIS.app is in your Applications folder (the one in your home folder)."
echo
echo "First open:"
echo "  1. Open Finder."
echo "  2. Go to your home folder → Applications."
echo "  3. Right-click JARVIS → Open. Click Open again if macOS warns (it is unsigned)."
echo "  4. Drag JARVIS to the Dock if you want it there."
echo
echo "After that, click it like any other Mac app. You should not need Terminal."
echo "If the window is blank, wait a few seconds. Local address: http://127.0.0.1:8787"
echo "If double-click does nothing, open ~/Library/Logs/JARVIS.log"
