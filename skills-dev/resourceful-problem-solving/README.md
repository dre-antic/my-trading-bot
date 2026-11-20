# Resourceful problem-solving — skill package extras

The installable skill lives at:

```text
.agents/skills/resourceful-problem-solving/
```

Start there: `README.md` (install, activation, usage, compatibility) and `SKILL.md` (what the agent follows).

This folder is the development and evaluation kit:

| Path | What it is |
|------|------------|
| `evals/scenarios.json` | 19 stress tests (T01–T12, A01–A07) |
| `evals/rubric.md` | 100-point rubric and auto-fail rules |
| `evals/fixtures/` | Hands-on T04 (broken CSV importer) and A07 (clipcaps continuity) |
| `evals/TEST_RESULTS.md` | Scores, retest, what was not tested |
| `evals/results/` | Raw v0/v1/v2 responses and grade JSON |
| `scripts/validate_skill.py` | Agent Skills spec check |
| `IMPROVEMENTS.md` | What changed after testing |
| `KNOWN_LIMITATIONS.md` | Honest limits |
| `EXAMPLE.md` | One real prompt, with vs without the skill |

```bash
python3 scripts/validate_skill.py ../../.agents/skills/resourceful-problem-solving
python3 -m unittest scripts.test_validate_skill evals.test_fixtures
```
