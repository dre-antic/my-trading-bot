#!/usr/bin/env bash
# Build a double-clickable Mac app folder. Run this ON macOS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/packaging/macos/AI Video Studio.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$ROOT/resources/icons/app-icon.png" "$APP/Contents/Resources/app-icon.png"
chmod +x "$APP/Contents/MacOS/AIVideoStudio"
echo "Staged: $APP"
echo "Drag this into /Applications. On first open, macOS may ask you to allow it."
if command -v pyinstaller >/dev/null 2>&1; then
  pyinstaller --noconfirm --windowed --name "AI Video Studio" \
    --icon "$ROOT/resources/icons/app-icon.png" \
    --add-data "$ROOT/engine/aivideostudio/web:aivideostudio/web" \
    --add-data "$ROOT/resources:resources" \
    "$ROOT/engine/aivideostudio/launch.py"
fi
