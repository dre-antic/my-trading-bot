# Security

## Secrets

- Never hard-coded. Use `.env` and/or Settings → `data/secrets.json` (mode 0600, gitignored).
- `.env.example` has empty values only.
- API keys are used **server-side only**. The Vite app talks to `/api/*`.
- GET `/api/settings` returns `configured` + a mask with last four characters. Full secrets are never returned after save.
- Logs run through `redact()` (Authorization, bearer, `sk-`, `api_key`).
- Do not commit `data/`, `projects/` (except `example-project/`), or `.env`.

## Trust boundaries

- The browser is untrusted. It cannot call Pexels/Pixabay/Groq directly.
- `/media/*` only serves files under `projects/` or `data/`.
- Paid calls require `ALLOW_PAID_PROVIDERS` plus Budget Manager checks (`MAX_DAILY_SPEND`, `MAX_MONTHLY_SPEND`, job budget, `REQUIRE_APPROVAL_ABOVE_COST`).

## Content policy

The pipeline must not:

- scrape behind paywalls or ignore robots where we are not using a documented API
- strip watermarks
- download known all-rights-reserved stock
- publish without the configured human approval
- present `UNCERTAIN` claims as verified

## Local encryption

`AETHER_MASTER_KEY` is reserved for future at-rest wrapping of `secrets.json`. On a single-user Mac the file permissions plus gitignore are the baseline.
