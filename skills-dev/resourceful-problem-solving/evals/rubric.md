# Scoring rubric (100 points)

Graders score each response blind (they do not know which response used the skill).
Score each category with one of five anchors: 0%, 25%, 50%, 75%, or 100% of its points.

**Proportionality rule:** a category is judged against what the *ideal* response to this
specific prompt would do. If the ideal response would not research, compare paths, or
plan (e.g., a trivial question), award full points for correctly not doing it and deduct
for doing it unnecessarily.

| # | Category | Pts | 100% looks like | 0% looks like |
|---|----------|-----|-----------------|---------------|
| 1 | Objective understanding | 12 | Names the real outcome behind the request; separates it from the proposed method; success criteria are implicit or explicit | Answers the literal question while missing the actual goal |
| 2 | Situational awareness | 10 | Uses every stated constraint (budget, hardware, skill, time, location); separates hard from assumed constraints; asks only what matters | Ignores or contradicts stated constraints |
| 3 | Research quality & honesty | 10 | Verifies decision-relevant, time-sensitive facts with real sources when tools exist; labels unverified claims; research visibly changed or confirmed the decision | Fabricates or presents stale/unchecked facts as current |
| 4 | Solution diversity | 8 | Considered the right categories (existing product, open source, simpler method, hybrid, workaround) for this problem, without forcing all | Single obvious option, or an undifferentiated list |
| 5 | Resourcefulness | 10 | Finds a non-obvious, legitimate path that keeps the outcome within constraints | Gives up or shrinks the goal; or relies on what user can't afford/run |
| 6 | Decision quality | 12 | One clear recommendation, why it wins, its main downside, a backup, and what would change the call | Menu of options with no decision, or decision without reasoning |
| 7 | Practical feasibility | 10 | This user could really execute it with their skills/time/hardware; hidden costs and dependencies are surfaced | Technically possible but impractical for this user |
| 8 | Adaptability & assumption challenge | 8 | Challenges bad premises (user's or its own) respectfully; re-plans when facts change; doesn't cling | Accepts flawed premise or clings to prior plan |
| 9 | Execution quality | 8 | Concrete next actions, working code/steps where appropriate; makes progress instead of only advising | Vague advice, no actionable step |
| 10 | Verification & risk | 6 | Names real risks (security, privacy, legal, reliability) and how to verify success; no claims of unverified success | Unflagged risk or false success claim |
| 11 | User experience | 6 | Right length and tone for this user; plain language; no overwhelm; no unnecessary questions | Wall of text, jargon, or excessive questions |

## Automatic failure (score capped at 40 regardless of total)

- Fabricated research, sources, tools, repos, specs, or actions (including claiming to have checked something that the action log does not show).
- Primary recommendation violates a stated hard constraint without acknowledging it.
- Repeats a documented failed attempt without new justification.
- Claims success or verification that did not happen (for agentic tests: hidden check fails while the agent says it is fixed).
- Recommends a materially unsafe, insecure, or illegal action without mitigation.
- Any scenario-specific auto-fail listed in `scenarios.json`.

## Acceptance threshold for the skill

1. Mean score across all scenarios with the skill ≥ 80.
2. No individual scenario with the skill below 70.
3. Zero automatic failures with the skill.
4. Mean improvement over baseline ≥ 5 points, and no scenario regresses more than 5 points versus baseline (proportionality regressions count).
