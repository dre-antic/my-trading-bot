# Development

## Layout

```
engine/aivideostudio/   production engine + FastAPI + UI files
resources/              models.json, templates, icon
desktop/                optional Tauri wrapper
packaging/macos/        .app template and launcher
tests/                  unit, integration, failure, e2e
scripts/                launch / setup / macOS build
```

## Run

```bash
source .venv/bin/activate
pip install -e ".[dev]"
./scripts/launch.sh --no-window
# UI: http://127.0.0.1:8745
pytest -q
```

Set `AIVS_DATA_DIR` to keep test databases off your real library folder.

## Adding a provider

1. Implement the interface in `providers.py` (or a sibling module).
2. Add a `resources/models.json` record with **repository** and **weights** licenses.
3. Wire fallbacks. Never hard-code a single vendor in the orchestrator.
4. If status is `NON_COMMERCIAL`, `UNKNOWN`, `REVIEW_REQUIRED`, or `BLOCKED`, commercial projects must refuse it unless the user overrides on the license screen.

## Do not

- Commit `.venv`, `*.sqlite`, API keys, or generated MP4s except the documented e2e artifact if you choose to keep it.
- Log secrets (the redacting logger is required).
- Call a model the registry marks unsafe for the project’s usage mode.
- Regenerate unrelated scenes when a user only changes voice or captions.

## Style

Keep user-facing strings in plain English. Technical detail belongs under a disclosure, a log file, or DEVELOPMENT.md — not the main buttons.
