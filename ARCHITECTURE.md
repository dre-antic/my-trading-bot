# Architecture

AI Video Studio is a local control center. The Mac (or Linux) app owns projects, the timeline, review, and render. Heavy neural video models are optional remote workers.

```
Mac / Linux desktop window (pywebview or Tauri)
        │
        ▼
Local FastAPI app (127.0.0.1)
        │
        ▼
SQLite + files on disk
        │
        ▼
Production graph (checkpointed stages)
        ├── Research engine
        ├── Script engine + critic
        ├── Story / scene planner
        ├── Visual decision engine
        ├── Image / motion-graphics / optional ComfyUI
        ├── Shot-level video (Ken Burns or remote generator)
        ├── Consistency metadata (bibles)
        ├── Voice engine
        ├── Music / SFX engine
        ├── Editing (FFmpeg timeline)
        ├── Captions
        ├── Thumbnails + critic
        ├── Review AI (separate reviewers + executive producer)
        ├── Deterministic technical QC
        └── Correction loop (smallest asset)
```

## Why not LangGraph

LangGraph is MIT, actively maintained (verified 2026-09-09), and a reasonable orchestrator. It was **not** adopted.

Reasons:

1. Pause, resume, license gates, cost gates, and correction loops need to share the SQLite checkpoint already used for crash recovery.
2. Bundling the LangChain stack would add moving parts without helping FFmpeg, TTS, or render.
3. A small explicit stage graph is easier to test and to explain in the UI.

The production graph lives in `engine/aivideostudio/orchestrator.py`.

## Desktop choice

Evaluated Swift/SwiftUI, Tauri, Electron, and pywebview.

| Option | Verdict |
|---|---|
| SwiftUI | Best native feel, but this repository must also run and test on Linux CI |
| Electron | Heavy RAM, against the performance rule |
| Tauri 2 | Apache-2.0/MIT, lightweight, preferred Mac wrapper (`packaging/` + `desktop/`) |
| pywebview | Native Cocoa window on Mac, GTK on Linux, ships today |

The engine always listens on localhost. Tauri or pywebview is only a window around it.

## Default compute (no GPU required)

Consumer Macs often cannot run Wan / Hunyuan / FLUX locally. The Visual Decision Engine therefore prefers:

- Motion graphics and diagrams (original, local, approved)
- Wikimedia Commons stills when the file license is safe, with attribution
- Ken Burns / camera moves via FFmpeg (shot-level, never one giant video model call)
- Optional ComfyUI or OpenAI-compatible APIs when the user enables them

Voice defaults to eSpeak NG (always-on subprocess, GPL binary not linked). Piper and Kokoro are preferred drop-in local voices when present. Music is an original procedural composer (ACE-Step is optional).

## Data

- Metadata: SQLite (`studio.sqlite` in Application Support)
- Media: `projects/<id>/...` on disk
- Secrets: encrypted vault + macOS Keychain/libsecret via `keyring`
- Logs: redacted (API keys stripped)

## Providers

Interfaces: `LLMProvider`, research, image, video, TTS, music, SFX, captions. Each has fallbacks, bounded retries, and license checks in commercial mode.

## Crash recovery

Every finished stage writes files and a checkpoint name. Reopening the app continues from the next unfinished stage. Completed assets are not regenerated unless a change request marks them dirty.
