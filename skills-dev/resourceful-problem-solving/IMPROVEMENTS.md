# Improvements made during testing

## Architecture (before the first eval)

A single `SKILL.md` is enough for most skills. This one is a *reasoning* skill, so one file would either be too long to load every time or too thin to change behavior. Split:

- `SKILL.md` — always-on: size the task, outcome vs method, simplest-path ladder, research honesty, decide, act, recover, safety, communication.
- Four references loaded only when needed: discovery, constraints, decide-and-recover, project-memory.

Rejected: a dozen micro-modules, a self-modifying skill, a runtime "engine" process. Those add tokens and maintenance without changing decisions.

Also rejected: putting the skill only in `.cursor/skills/` (Cursor-only). `.agents/skills/` is the portable Agent Skills location Cursor also scans.

## After reading a strong baseline (no skill)

Grok without the skill already researched, challenged blockchains, and refused to put API keys in the browser. The skill had to win on failure modes that baseline still hit:

1. **Overengineering (T07).** Baseline built a Python app, tests, cron, and a local server for four people and five chores.
2. **Build-by-default (T09).** Baseline picked Django instead of asking whether invoicing software already exists.
3. **Invented specifics (A03).** Baseline was honest that Orvane K7 was not found, but a weaker agent would invent a register map. The skill forbids filling research gaps with plausible product-specific integrations.
4. **Operability.** Candidates must be something *this* user can run day to day.

Those rules went into v1.0 before the paired eval.

## After the paired eval (v1.0 → v1.1)

Measured v1.0 vs baseline: mean **+10.8** points, no auto-fails, no regressions. Remaining defect:

- **T01 verbosity.** 7,897-word reply that inlined a whole Apps Script app on a Decision-tier question.

Changes in v1.1:

- Decision vs Project: "what's the best way / how should I" is Decision. Recommend, then offer to build.
- Act: put programs in files; paste at most a short snippet.
- Communicate: Decision replies ~400–800 words; if the draft is becoming a source dump, stop.

Retest: T01 **894** words, still zero-budget, still checks existing products. T07 and A04 did not regress.

No further modules were added. The fix was three short rules, not a new file.
