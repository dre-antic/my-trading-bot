# Deciding, stopping, recovering

## Contents
- Comparing candidates
- Stopping rules (when to stop researching and act)
- Assume or ask
- Assumption challenge
- Failure recovery ladder
- Pivoting
- Opportunity triage

## Comparing candidates

Only compare the serious two or three. Use the criteria that matter for this user, typically: likelihood of success, total cost (upfront, recurring, hidden), effort and skill required, time to first result, reliability and maintenance, risk (security, legal, vendor), and long-term fit (scaling, lock-in, exit).

A short table is fine *for yourself*. For the user, give the winner, why, its main downside, the backup, and the trigger that would switch to the backup.

When candidates are close:
- If the choice is reversible, pick the one with the fastest path to a real result, and decide again with evidence.
- If it's irreversible or expensive, run a small test or prototype on the riskiest assumption before committing.

## Stopping rules

Stop researching or planning and act when any of these is true:
- The last two findings didn't change the ranking.
- The remaining uncertainty is cheaper to resolve by trying than by reading (a 10-minute test beats an hour of reviews).
- Further information wouldn't change the first action.
- The cost of delay is greater than the value of more certainty.

Keep going only if a plausible finding would change the recommendation, cost or risk materially.

Anti-patterns:
- Comparing everything.
- Re-opening the decision on every new article.
- Switching tools without a failure or new evidence.
- Planning documents instead of a first working piece.

## Assume or ask

| Situation | Do |
|-----------|----|
| Discoverable by research, files or tools | Find out yourself |
| Reasonable default exists and is reversible | Assume it, state it, proceed |
| Changes the plan, can't be discovered, cheap to ask | Ask, with your default |
| Irreversible, costly, destructive, security-sensitive, or externally visible action | Get explicit approval first |
| Personal preference with no "right" answer and little impact | Choose a sensible default and say it's changeable |

## Assumption challenge

For important decisions, spend a minute on:
- **Real problem**: if this works perfectly, is the user's outcome achieved?
- **Simplest**: what's the least complex thing that passes the success test?
- **Expert's eye**: what would someone experienced in this field check first?
- **Remove the tool**: if our chosen tool vanished, what would we use? Is that alternative actually better?
- **Zero budget**: what would we do with no money? Does that beat the current plan?
- **Failure tomorrow**: if it broke tomorrow, what would the cause most likely be? Mitigate that now.
- **Strongest unexplored alternative**: name it; check it quickly if it could win.
- **Own bias**: am I recommending this because it's familiar, popular or what I already built?

Fix what the challenge exposes, then commit. Don't loop.

## Failure recovery ladder

1. **Capture**: what was attempted, the exact error or wrong output, and the environment details.
2. **Diagnose**: reproduce, then inspect real inputs and state (file bytes, configs, versions, logs). State a root-cause hypothesis and the evidence for it.
3. **Classify**:
   - Wrong assumption: update the assumption and re-plan the affected part.
   - Configuration or environment problem: fix the setup; don't change the code to hide it.
   - Missing dependency: install it or replace it.
   - Bug: fix it and add a check or test that would have caught it.
   - Approach can't work (hardware, platform limit, policy): change the component or the approach.
4. **Fix at the lowest sufficient level**: detail, then component, then architecture, then strategy.
5. **Thresholds**:
   - The same hypothesis has failed twice: the hypothesis is probably wrong. Gather new evidence.
   - Three fixes at one level have failed: escalate a level.
   - A cumulative effort budget (set one for the task) is exhausted: step back, report to the user with options, or switch to the backup path.
6. **Verify the outcome**, not the absence of errors: run the success test end to end, check counts and totals, and confirm existing behavior still works.
7. **Record** the failure and its lesson (in `PROJECT_STATE.md` for multi-session work) so nobody repeats it.

Never do these:
- Retry the identical action hoping for a different result.
- Suppress errors to make it green.
- Claim it's fixed without running the success test.

## Pivoting

Change approach when the evidence shows the current one can't meet the success test within the constraints, not merely because it's hard. When you pivot:
- Keep the outcome. Say what's changing and why, in a sentence or two.
- Salvage the parts of prior work that still fit.
- Update the plan and the project state.

## Opportunity triage

When you discover something useful off the main path:

| Class | Test | Action |
|-------|------|--------|
| Essential | Blocks or endangers the core outcome (security hole, broken core function, a legal issue) | Handle it now and tell the user |
| High value | Materially cuts cost or effort, or improves quality, and fits the current scope | Mention it briefly with a recommendation |
| Later | Nice, but not needed for the current goal | Add it to the backlog or next steps |
| Distraction | Unrelated or speculative | Drop it |
