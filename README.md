# AI Video Studio

A native-feeling video production studio for Mac. You describe the video you want. The application researches, writes, plans scenes, generates visuals, records narration, composes original music, edits, captions, reviews, and renders a real MP4.

You do **not** need Terminal, Python, Docker, ComfyUI, or GPU knowledge for normal use.

## What you get

- A desktop window (macOS or Linux) with a dark studio interface
- New Project → prompt, platform, duration, Simple/Advanced → **Create video**
- A full production pipeline that writes files to disk and a SQLite project database
- Playable H.264 MP4 output, captions (SRT/VTT/ASS), thumbnails, research citations, and license records
- Optional cloud / ComfyUI / Ollama providers behind Settings — never required for the base studio

## Open the app (normal use)

**On a Mac, after installing the application:**

1. Open **Applications**
2. Double-click **AI Video Studio**
   or click it in the **Dock**

That is the intended everyday launch. You should not need Terminal.

**On this computer (development / Linux):**

```bash
cd /path/to/ai-video-studio
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch.sh
```

`./scripts/launch.sh` starts the studio and opens a native window when possible. Use `./scripts/launch.sh --no-window` if you only want the local web UI at http://127.0.0.1:8745

## First-run wizard

The first launch walks through:

1. Welcome  
2. Check this computer  
3. Required components (FFmpeg, voice engine)  
4. Optional models (none required)  
5. A short test video  

If a step fails, the app explains it in plain language.

## Requirements

- macOS 12+ (Apple Silicon or Intel) or Linux for development
- FFmpeg (the setup path detects it; on Mac, the packaging script can install via Homebrew when you allow it)
- Disk space for projects (videos are stored as files, not inside the database)

No paid API key is required. Optional keys are entered in **Settings → AI providers** and stored encrypted on this computer.

## Tests

```bash
source .venv/bin/activate
pytest tests/unit tests/failure tests/integration -q
pytest tests/e2e -q
```

The end-to-end test produces a real MP4 about why the sky appears blue.

## License of this application

MIT for the studio source. Third-party tools keep their own licenses — see `LICENSES.md`, `THIRD_PARTY_NOTICES.md`, and `MODEL_REGISTRY.md`.
