# Architecture

JARVIS is the manager. Other tools are workers that can be swapped.

```
You
  → JARVIS window (this computer only)
    → Task router
      → Mission engine (saved in a local SQLite file)
        → Permission + security checks
          → A worker (research, coding, browser, Mac control, review)
            → Verification + independent review
              → Evidence in the mission
```

## Pieces

| Piece | Job |
| --- | --- |
| GUI | Calm window: Chat, Missions, Projects, History, Activity, System, Memory, Permissions, Providers, Settings |
| Task router | Decides what you asked for and which worker should help |
| Mission engine | Keeps state: queued → … → completed / failed / paused / cancelled |
| Provider registry | Lists local builder, Cursor ACP/CLI, optional paid APIs (disconnected until you approve) |
| Tool registry | Every tool names its risk and side effects |
| Permission engine | Green / yellow / red |
| Security engine | Treats the web as untrusted data. Unknown MCP servers are denied |
| Project Brain | Durable notes about each project |
| Memory | Searchable notes. Secrets are refused |
| Cursor adapter | Real ACP JSON-RPC client for `agent acp`, plus `agent -p` |
| Local coding worker | Writes real files and tests when Cursor is not connected |
| Browser / computer | HTTP fetch now; Mac Accessibility/AppleScript when running on macOS |
| Cost manager | Automatic spend $0 |
| Audit log | Human-readable. Credentials redacted |
| Recovery | Bounded retries. No infinite loops |
| System Doctor | Explains what is wrong in plain language |
| SQLite | The only database. No Redis, Postgres, or Kubernetes |

## Why this stack

The target machine is an older **Intel MacBook Pro with about 8 GB of RAM**.

- Python 3.12 standard library for the brain and a local web window
- Optional `pywebview` native window, or a thin Electron shell if you already have it
- Heavy AI stays optional and remote. Nothing here downloads a large local model
- JARVIS.app is an unsigned Mac wrapper that starts the same program

## Cursor integration (researched 2026-09-15)

Official docs: https://cursor.com/docs/cli/acp

1. Spawn `agent acp`
2. JSON-RPC 2.0, one JSON object per line, over stdin/stdout
3. `initialize` → `authenticate` (`cursor_login`) → `session/new` or `session/load` → `session/prompt`
4. Handle `session/update` and `session/request_permission` (`allow-once` / `allow-always` / `reject-once`)
5. `session/cancel` to stop

Print mode: `agent -p --output-format json`.

JARVIS does not mouse-click the Cursor IDE when this interface exists.

## Hardware inspected in this build environment

This copy was built on **Linux x86_64**, not the user’s Intel Mac. There is no
self-hosted Mac worker attached. The app is written to run on that Mac; Mac
window control and Apple signing could not be verified here.
