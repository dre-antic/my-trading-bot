# AI agent guide

Fifteen desk roles are defined in `src/core/ai.ts`.

Default provider for every agent is `none` (deterministic engines in `research-desk.ts`). That is intentional: paid services stay off.

Optional providers (`OpenAiProvider`, `AnthropicProvider`, `OpenAiCompatibleProvider`) are selected only when a key or compatible base URL is present. `askDesk` still answers deterministically first and calls an LLM only when a provider exists **and** `AI_DAILY_LIMIT_USD` or `AI_MONTHLY_LIMIT_USD` is greater than zero. Prompts are sanitized; secrets are refused. Cost ledger rows are written to `ai_runs`.

When a provider key is added later, each agent still:

- has an allowlisted tool set
- has token/cost/timeout limits
- cannot execute orders
- cannot edit the Constitution
- writes an `ai_runs` row

The Trade Committee emits a proposal, never a broker call.
