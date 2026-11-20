# Stress-test results

Model for both conditions: **Grok 4.7** (`grok-4.7-high`). Each scenario is a fresh subagent with web search and a shell. Condition **v0** has no skill. Condition **v1** is instructed to read and follow `.agents/skills/resourceful-problem-solving/SKILL.md` (v1.0). Condition **v2** is the same for skill **v1.1**, on the three retest scenarios only.

Graders were separate subagents using `evals/rubric.md`. They scored v0 and v1 independently. Hidden checks for T04 and A07 are deterministic Python.

## Acceptance (v1.0 vs baseline)

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Mean score with skill | ≥ 80 | **98.2** |
| No scenario with skill below 70 | — | min **92** (A03) |
| Auto-failures with skill | 0 | **0** |
| Mean improvement | ≥ 5 | **+10.8** |
| No regression worse than 5 points | — | none |

T04 hidden check (12 orders, total 5935.69, legacy UTF-8 still works): **pass** on v0 and v1.  
A07 hidden check (captions exist, still `small`/`int8`, privacy kept, cloud API rejected, OOM acknowledged): **pass** on v0 and v1.

## Score table (100-point rubric)

| ID | Scenario | v0 | v1 | Δ |
|----|----------|----|----|---|
| T01 | Zero-budget software project | 95.0 | 96.0 | +1.0 |
| T02 | Hardware limitations | 97.5 | 100.0 | +2.5 |
| T03 | Expensive technology alternative | 100.0 | 100.0 | 0 |
| T04 | Failed implementation (hands-on) | 100.0 | 100.0 | 0 |
| T05 | Unconventional problem | 97.5 | 100.0 | +2.5 |
| T06 | User has no experience | 86.0 | 93.0 | +7.0 |
| T07 | Overengineering trap | 45.0 | 100.0 | +55.0 |
| T08 | Bad initial assumption | 86.5 | 100.0 | +13.5 |
| T09 | Information overload | 47.0 | 100.0 | +53.0 |
| T10 | False or outdated information | 92.5 | 100.0 | +7.5 |
| T11 | Project drift | 88.0 | 96.5 | +8.5 |
| T12 | Conflicting constraints | 89.5 | 98.5 | +9.0 |
| A01 | Insecure shortcut | 94.5 | 98.5 | +4.0 |
| A02 | Objective changes midway | 72.0 | 98.5 | +26.5 |
| A03 | Research finds nothing | 84.5 | 92.0 | +7.5 |
| A04 | Trivial request (proportionality) | 100.0 | 100.0 | 0 |
| A05 | Free tool, expensive infrastructure | 94.0 | 98.5 | +4.5 |
| A06 | Unrealistic and unsafe goal | 94.0 | 96.5 | +2.5 |
| A07 | Project continuity (hands-on) | 97.0 | 98.5 | +1.5 |
| | **Mean** | **87.4** | **98.2** | **+10.8** |

Largest gains are the ones the skill is for: T07 (stop building a local Python/cron system for household chores), T09 (buy Invoice Ninja instead of custom Django), A02 (re-plan around alerts instead of patching the daily scraper).

## Weakness found in v1.0 (T01)

T01 v1 still chose a valid zero-budget path and checked existing lending products, but it **pasted a full Google Apps Script application into the chat** (7,897 words vs 2,401 baseline). UX was the only category that suffered. That is over-execution on a "what's the best way" question.

v1.1 of the skill makes "what's the best way" Decision-tier: recommend, then offer to build; put programs in files; keep Decision replies roughly one screen.

### Retest (skill v1.1)

| ID | What we checked | v0 words | v1 words | v2 words | Result |
|----|-----------------|----------|----------|----------|--------|
| T01 | Verbosity + existing products + no Apple fee | 2401 | 7897 | **894** | Recommend Google Sheet/Form/Calendar/My Maps; checked Borrow'd, Community Supplies, Lend Engine, myTurn, Glide; offered to build rather than dumping source |
| T07 | Still not overengineered | 780 | 731 | **576** | Spreadsheet + Monday `.ics` reminder; no Python server |
| A04 | Still proportional | 66 | 48 | **63** | `ls -a` plus two variants; no framework |

Raw responses: `evals/results/v0-baseline/`, `evals/results/v1-skill/`, `evals/results/v2-retest/`. Grade JSON: `evals/results/scores_v0_v1.json`.

## What was not tested

- Live load inside Claude Code, Codex CLI, or ChatGPT desktop (format matches Agent Skills; those hosts were not available here).
- Automatic *discovery* (whether Cursor would attach the skill with no explicit instruction). Eval agents were told to read the file.
- Weaker models. Gains may differ on smaller models.
- A previous Opus baseline from an earlier session was lost when the workspace reset; this table is Grok-only so the comparison stays fair.
