# Troubleshooting

## The window does not open

Open a browser to http://127.0.0.1:8787 while JARVIS is running.

On a Mac, Python 3 must be installed (it usually is). If double-clicking does
nothing, install Python from python.org or Xcode Command Line Tools, then try
again.

Use **Python 3.11 or newer, with official wheels** (3.11–3.13 is the safe
range). Homebrew Python 3.14 may compile `cryptography` from source and appear
to hang. Prefer `python3.11` / `python3.12` / `python3.13` when creating the
venv.

## macOS says the app is damaged or unidentified

This build is not signed. Right-click **JARVIS** → **Open**. You only do this
once.

## Cursor never starts

That is expected until you install Cursor CLI and run `agent login`. JARVIS
should say it is disconnected and may still build simple apps locally. If it
claims Cursor succeeded without the CLI, that would be a bug — please report it.

## It asked me about money

Good. Automatic spending is $0. If you did not mean to pay, choose Reject.

## It will not read a password file

Good. Those paths are protected. You would have to approve that exact file on
purpose.

## A mission is stuck

Press **Pause safely** or **Stop now**. Open **Missions**. You can resume later;
progress is saved in a local file, not in the cloud.

## System Doctor

Open **System**. It lists what is missing and how to fix the easy things (for
example, creating the Projects folder).

## Voice does not hear me

Typing always works. Speech-to-text is not connected unless a free local engine
is added later. JARVIS will not call a paid voice API on its own.
