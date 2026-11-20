# Project memory

Agents usually have no memory between sessions. A small file in the project carries continuity: what we're doing, what we decided and why, what failed, and what's next.

## When to use it
- Create it for multi-step or multi-session projects, or when significant decisions or failures happen.
- Skip it for one-off questions and small tasks.
- If the project already has an equivalent (a README section, ADRs, an issue tracker, `NOTES.md`), use that instead of adding a new file.

## Rules
- **Read it first** when resuming work. Treat recorded decisions as settled. Reopen one only with new evidence, and say what changed.
- **Update it when something changes**: a decision made, an approach rejected, an attempt failed, a status change, or new next steps. Not after every action.
- **Keep it short**, ideally under about 80 lines. Replace stale status rather than appending forever. Move resolved detail to a short history or delete it.
- **Record reasons** for every decision and rejection. A decision without a "why" will get re-debated.
- Never store secrets, credentials or personal data in it.

## Template

```markdown
# Project state: <name>

## Goal
<The outcome in one or two sentences, plus the success test.>

## Constraints
- <Budget / hardware / skills / time / platform / legal or privacy. Mark assumed ones.>

## Decisions
- <date> <Decision>. Why: <reason>.
- <date> Rejected <option>: <reason>.

## Failed attempts
- <date> <What was tried> -> <exact result>. Lesson: <what not to repeat>.

## Status
- <What works now, and how it was verified.>

## Next
1. <Next concrete step>
2. <...>

## Later (parked ideas)
- <Idea>: <why it's parked>
```
