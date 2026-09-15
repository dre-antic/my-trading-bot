# Development

This is for someone changing JARVIS. Everyday use is in the README.

## Layout

```
jarvis/                 # the product
  web/                  # the window
  cursor_ctrl.py        # ACP + CLI adapter
  orchestrator.py       # manager
packaging/macos/JARVIS.app
scripts/launch-jarvis.sh
scripts/build-jarvis-macos.sh
tests/jarvis/
engine/aivideostudio/   # older video studio project, not part of the JARVIS window
```

## Run tests

```bash
python3.11 -m venv .venv   # 3.11–3.13; wheels available. Avoid Homebrew 3.14.
source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/jarvis -q
```

Video Studio tests (separate product) still live under `tests/unit`,
`tests/integration`, and `tests/e2e`.

## Environment variables

- `JARVIS_HOME` — where the SQLite file and logs go (default `~/.jarvis`)
- `JARVIS_WORKSPACE` — project sandbox (default `~/Projects`)
- `JARVIS_PORT` — local port (default 8787)

Never commit `.env` files or real keys.

## Packaging

On a Mac:

```bash
./scripts/build-jarvis-macos.sh
```

The result is **unsigned**. This environment cannot notarize with Apple.

## Code style

- Do not add Kubernetes, Redis, or Postgres
- Do not add large local models
- Prefer stdlib
- If a paid API is missing, keep the adapter and show disconnected
