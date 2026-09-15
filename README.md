# JARVIS

JARVIS is a personal helper for your Mac.

You open one app, say what you want in ordinary language, and JARVIS figures out
how to do it. You do not need to know programming, terminals, APIs, or agents.

## What you can ask

- “Research this company.”
- “What happened today?”
- “Build me a simple task-list application.”
- “Explain this project to me.”
- “Take over and finish this.”
- “Stop.”

JARVIS turns a goal into a **mission**. It plans, does the work, checks the
result, and shows you proof. If something needs your say-so — spending money,
deleting important files, publishing, trading — it stops and asks.

## Open the app (normal use)

**On a Mac**

1. Put **JARVIS** in your Applications folder (see Installation below).
2. Double-click it, or open it from the Dock.
3. Type what you want. Press Send.

You should not need Terminal for everyday use.

This copy is **not signed** by Apple. The first time macOS may say the app is
from an unidentified developer. Right-click the app and choose **Open**.

**On this Linux computer (development)**

```bash
python3.11 -m venv .venv   # 3.11–3.13 with wheels. Homebrew 3.14 may hang.
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch-jarvis.sh
```

Then open http://127.0.0.1:8787 if a window does not appear.

## How it spends money

It doesn’t, unless you approve a specific paid action.

Automatic spending is **$0**. JARVIS will not silently switch to a paid AI
company to “make it work.”

## Where your files live

Work happens in a **Projects** folder (`~/Projects` on a Mac). JARVIS is not
supposed to wander through passwords, SSH keys, or `.env` files.

## Cursor

If Cursor’s official command-line tool (`agent`) is installed and signed in,
JARVIS talks to it with the **Agent Client Protocol** (`agent acp`) — not by
clicking the Cursor window. If Cursor is missing, JARVIS says so and can still
build simple projects with its local builder. It will not pretend Cursor ran.

## AI Video Studio and trading

Older video-studio and trading-bot files in this repository are **projects
JARVIS can manage**. They are not baked into JARVIS. JARVIS never places a
trade by itself.

## Learn more

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit
- [SECURITY.md](SECURITY.md) — what is protected
- [PERMISSIONS.md](PERMISSIONS.md) — when it asks you
- [PROVIDERS.md](PROVIDERS.md) — Cursor, local tools, paid APIs
- [DEVELOPMENT.md](DEVELOPMENT.md) — for people changing the code
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — when something is stuck
- [JARVIS_PROJECT_BRAIN.md](JARVIS_PROJECT_BRAIN.md) — how JARVIS remembers a project

Video Studio’s own guide is saved under [docs/ai-video-studio/](docs/ai-video-studio/).
