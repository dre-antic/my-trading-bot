#!/usr/bin/env bash
# Build an unsigned JARVIS.app wrapper that launches the LOCAL runtime.
# Does not copy the whole repo (saves RAM/disk on an 8 GB Intel Mac).
# This build is NOT signed and NOT notarized.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$HOME/Applications/JARVIS.app}"
CONTENTS="$DEST/Contents"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"
cp "$ROOT/packaging/macos/JARVIS.app/Contents/Info.plist" "$CONTENTS/Info.plist"
cp "$ROOT/packaging/macos/JARVIS.app/Contents/MacOS/JARVIS" "$CONTENTS/MacOS/JARVIS"
chmod +x "$CONTENTS/MacOS/JARVIS"
if [[ -f "$ROOT/packaging/macos/JARVIS.app/Contents/PkgInfo" ]]; then
  cp "$ROOT/packaging/macos/JARVIS.app/Contents/PkgInfo" "$CONTENTS/PkgInfo"
fi
printf '%s\n' "$ROOT" > "$CONTENTS/Resources/jarvis-root.txt"
echo "Unsigned JARVIS.app written to $DEST"
echo "It starts the local runtime in $ROOT using python3.11 when possible."
echo "NOT signed. NOT notarized. NOT a cloud app."
