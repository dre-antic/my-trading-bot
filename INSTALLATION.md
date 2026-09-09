# Installation

## Everyday Mac install (no Terminal)

1. Copy `AI Video Studio.app` from `packaging/macos/` (after a Mac build) into **Applications**.
2. Open it once. macOS may ask you to allow it (System Settings → Privacy & Security) if it is unsigned.
3. Complete the in-app setup wizard.

The app starts its own local engine. You do not install Python yourself when using a bundled build.

## Developer install

You only need this if you are changing the software.

### macOS

```bash
xcode-select --install   # if Apple build tools are missing
brew install ffmpeg python@3.12 espeak-ng
git clone <this-repo>
cd <this-repo>
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch.sh
```

### Linux (tested on Ubuntu 24.04)

```bash
sudo apt-get install -y ffmpeg espeak-ng python3-venv python3-dev
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch.sh --no-window   # then open http://127.0.0.1:8745
```

FFmpeg must be on your PATH. The System Status screen reports if it is missing.

## Optional components

| Component | Why | How |
|---|---|---|
| Ollama | Better local writing | Install Ollama, pull a model, leave it running. The studio detects `127.0.0.1:11434`. |
| Piper / Kokoro | More natural voices | Install the binary; the studio uses it when found. |
| ComfyUI | Neural images/video | Run ComfyUI yourself, paste its URL in Settings. GPL-3.0 server, not bundled. |
| OpenAI-compatible API | Cloud LLM / images | Paste a key in Settings. Budget is enforced. |
| Docker | Isolated AI servers | Optional. The app never deletes volumes. |
| Tauri wrapper | Slimmer Mac window | See `desktop/README.md`. Requires a Mac to compile `.app`. |

## Models

The base studio **does not download multi-gigabyte video models**. That is intentional: most Macs cannot run them. Approved optional models are listed in `resources/models.json` and the in-app license screen.

## Building a Mac .app

On a Mac:

```bash
./scripts/build-macos-app.sh
```

This stages `packaging/macos/AI Video Studio.app` with the launcher, icon, and engine. A full PyInstaller bundle is used when `pyinstaller` is installed; otherwise the launcher uses the developer venv.

Linux CI cannot produce a signed Apple binary. The application is still fully runnable via `./scripts/launch.sh`.
