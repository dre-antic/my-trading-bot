# Installation (Mac)

These steps are for the 2013 Intel MacBook Pro. You only need Terminal **once**. After that, JARVIS is a normal Dock app.

Use **Python 3.11** (`/usr/local/bin/python3.11`). Do not use Homebrew Python 3.14 — it can freeze while building extra packages.

## First launch (from ~/Projects/jarvis-app)

1. Open **Terminal**.
2. Type this and press Return (if you are already in the JARVIS folder you can skip `cd`):

```bash
cd ~/Projects/jarvis-app
chmod +x scripts/install-jarvis-macos.sh scripts/build-jarvis-macos.sh packaging/macos/JARVIS.app/Contents/MacOS/JARVIS
./scripts/install-jarvis-macos.sh
```

3. If Python 3.11 is missing, Terminal will say so. Install it once:

```bash
brew install python@3.11
```

Then run the installer again.

4. Open **Finder**.
5. Go to your **home folder** (the house with your name), then **Applications**.
   (That is `~/Applications`, not the system Applications folder. Either is fine if you copy it later.)
6. **Right-click JARVIS** → **Open**.
7. If macOS says the developer cannot be verified, click **Open**. This build is not signed. That is expected.
8. Drag **JARVIS** to the **Dock** if you want it there.

After that, click JARVIS in the Dock like any other app. You should not need Terminal.

The window is the local JARVIS on this Mac. Cloud AI is off unless you later approve a paid provider. Files, missions, memory, and the local builder still work if the internet or cloud AI is down.

If the window is empty for a few seconds, wait. Or open Safari to http://127.0.0.1:8787 while JARVIS is running.

## What this installer does not do

- It does not sign or notarize the app.
- It does not install Docker.
- It does not download a local AI model.
- It does not spend money.

## Linux / development machine

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch-jarvis.sh --no-window
```
