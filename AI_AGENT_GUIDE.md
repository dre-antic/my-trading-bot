# AI agent guide

Fifteen desk roles are defined in `src/core/ai.ts`.

Default provider for every agent is `none` (deterministic engines in `research-desk.ts`). That is intentional: paid services stay off.

When a provider key is added later, each agent still:

- has an allowlisted tool set
- has token/cost/timeout limits
- cannot execute orders
- cannot edit the Constitution
- writes an `ai_runs` row

The Trade Committee emits a proposal, never a broker call.
