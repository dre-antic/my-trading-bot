# Architecture

JARVIS is a **local Mac application**. Cloud is optional inference, not the product.

```
You
  → JARVIS.app (Dock)
    → Local runtime / control plane on this Mac (127.0.0.1)
      ├── files in ~/Projects
      ├── Applications, browser, Cursor CLI, Git, Homebrew
      ├── Keychain, microphone/speaker when the Mac allows it
      ├── missions, memory, permissions (SQLite on disk)
      ↓
    Intelligence router
      ├── local_mac — default, works with cloud AI down
      ├── cloud_ai — paid models, off until you approve spend ($0 auto)
      ├── remote_agent — Cursor ACP/CLI on this Mac
      └── external_api — public HTTP research (untrusted data)
```

The window talks only to the local process. It is not a frontend for a cloud JARVIS.

## Pieces

| Piece | Job |
| --- | --- |
| JARVIS.app | Dock launcher. Starts Python 3.11 local runtime. Unsigned. |
| Local runtime | Control plane on this computer |
| GUI | Calm window on 127.0.0.1: Chat, Missions, Projects, History, Activity, System, Memory, Permissions, Providers, Settings |
| Task router + intelligence router | What you asked, which plane, which worker |
| Mission engine | Saved in local SQLite |
| Provider registry | Local builder, optional Cursor, paid APIs disconnected by default |
| Permission / security | Green / yellow / red. Web is untrusted. Unknown MCP denied |
| Local coding worker | Real files and tests without cloud AI |
| Cursor ACP | Optional `agent acp` on this Mac |
| Cost manager | Automatic spend $0 |
| SQLite | The only database. No Redis, Postgres, Kubernetes, Docker |

## Why this stack

Target: **2013 Intel MacBook Pro, ~8 GB RAM, macOS Sequoia via OCLP**.

- Python **3.11** at `/usr/local/bin/python3.11` (Homebrew Intel). Avoid 3.14.
- No Docker. No large local models.
- JARVIS.app is a wrapper around the checkout at `~/Projects/jarvis-app`, not a copy of the whole disk.

## Cursor integration (researched 2026-09-15)

Official docs: https://cursor.com/docs/cli/acp — `agent acp` JSON-RPC over stdio.

## Hardware

Cloud CI cannot click the Dock on the user's Mac. Mac-specific `open -a`, Keychain, and Gatekeeper are **implemented, not verified on that machine from here**.
