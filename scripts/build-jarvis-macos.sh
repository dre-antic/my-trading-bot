#!/usr/bin/env bash
# Build an unsigned JARVIS.app on a Mac. This does not notarize or sign.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/dist/JARVIS.app}"
CONTENTS="$DEST/Contents"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"
cp "$ROOT/packaging/macos/JARVIS.app/Contents/Info.plist" "$CONTENTS/Info.plist"
cp "$ROOT/packaging/macos/JARVIS.app/Contents/MacOS/JARVIS" "$CONTENTS/MacOS/JARVIS"
chmod +x "$CONTENTS/MacOS/JARVIS"
# Copy the project into the bundle so double-click works without Terminal.
rsync -a --exclude .git --exclude .venv --exclude dist --exclude __pycache__ "$ROOT/" "$CONTENTS/Resources/app/"
echo "Unsigned app written to $DEST"
echo "On first open, right-click the app and choose Open if macOS Gatekeeper warns."
echo "This build is NOT signed and NOT notarized."
