# Troubleshooting

## I was using Terminal before (`python -m jarvis.launch`)

That only starts the local server. It is not the Dock app. Run `./scripts/install-jarvis-macos.sh` once, then open **JARVIS** from Applications as in INSTALLATION.md.

## I pressed Stop now and nothing happens

Press **Resume** in the top bar, or type `continue`. Stop and Pause block new work on purpose. That is not a crash.

## The window does not open

Wait a few seconds. Then try Chrome or Safari: http://127.0.0.1:8787

On this Intel Mac, JARVIS needs **Python 3.11** at `/usr/local/bin/python3.11`.

```bash
brew install python@3.11
cd ~/Projects/jarvis-app
./scripts/install-jarvis-macos.sh
```

Do **not** use Homebrew Python 3.14. It can hang while compiling `cryptography` if extra packages are installed. JARVIS itself does not need that package. A leftover 3.14 `.venv` is also a problem — the installer replaces it.

Check `~/Library/Logs/JARVIS.log` if double-click does nothing. A dialog should appear if JARVIS cannot find Python 3.11 or the project folder.

Dock double-click has **not** been verified from the Linux builder. If the icon bounces and quits, the log is the next thing to open.

## macOS says the app is damaged or unidentified

This build is not signed. Right-click **JARVIS** → **Open**. You only do this once.

If that still fails, in Terminal:

```bash
xattr -cr ~/Applications/JARVIS.app
```

Then right-click Open again.

## Cursor never starts

Expected until you install Cursor CLI and run `agent login`. Local building still works.

## It asked me about money

Good. Automatic spending is $0.

## Cloud / internet is down

That is fine for local work: Projects files, missions, memory, Stop/Pause, System Doctor, and the local task-list builder. Research that needs the public web will say it could not reach sources. Paid cloud models stay off.

## Docker

JARVIS does not use Docker. You do not need it.

## A mission is stuck

Press **Pause safely** or **Stop now**. Progress is saved on this Mac, not in the cloud.
