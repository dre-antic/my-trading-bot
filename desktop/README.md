# Optional Tauri wrapper

Tauri 2 is the preferred lightweight native shell on macOS (Apache-2.0 OR MIT, verified 2026-09-09).

This folder is intentionally small: the product already runs as a native window via pywebview wrapping the local FastAPI UI. Compile Tauri on a Mac when you want a slimmer `.app` that still talks to the same engine.

```bash
# on macOS with Rust + Xcode
npm create tauri-app@latest . -- --template vanilla
# set the window URL to http://127.0.0.1:8745 after spawning `python -m aivideostudio.launch --no-window`
```

Do not duplicate production logic here. The engine remains the source of truth.
