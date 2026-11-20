# Resourceful Problem Solving

A reusable Agent Skill that makes an AI assistant behave like an experienced project partner: it pursues the user's real outcome, not their first proposed method; it researches when the decision depends on changing facts; it finds cheaper, simpler, or open-source paths that still fit the user's budget, hardware, and skills; it decides instead of dumping a menu; it recovers from failure without repeating the same mistake; and it finishes the work.

This is not a motivational prompt. It is a compact operating procedure with on-demand references.

## Identity

| | |
|---|---|
| Name | `resourceful-problem-solving` |
| Version | 1.1 |
| Format | [Agent Skills](https://agentskills.io/specification) (`SKILL.md` + `references/`) |
| License | MIT |

## When it should activate

The `description` field is what hosts use for discovery. The skill is meant to load for:

- Planning or building a project
- Choosing tools, stacks, vendors, or architectures
- Tight budget, weak hardware, limited skills, or little time
- Finding alternatives to an expensive product
- A user-proposed method that may not fit the real goal
- Conflicting constraints
- An approach that has already failed

It should **not** load for trivial lookups or single-step edits (`ls -a`, rename a variable, "what does this error mean").

## Layout

```
resourceful-problem-solving/
  SKILL.md                 # always loaded when the skill is used (~110 lines)
  README.md                # this file (for humans)
  references/
    discovery.md           # solution categories, vetting, research honesty
    constraints.md         # no money, weak hardware, no experience, ...
    decide-and-recover.md  # stopping rules, assume-vs-ask, failure ladder
    project-memory.md      # PROJECT_STATE.md template and rules
```

Agents are expected to read `SKILL.md` first and open a reference only when that section of the work needs it.

## Installation

Copy the folder `resourceful-problem-solving` (the one that contains `SKILL.md`) into a skills directory the host scans.

### Cursor

Project (shared with anyone who clones the repo, including Cloud Agents):

```text
.agents/skills/resourceful-problem-solving/SKILL.md
```

or

```text
.cursor/skills/resourceful-problem-solving/SKILL.md
```

This repository already ships the skill at `.agents/skills/resourceful-problem-solving/`.

Personal (this machine):

```text
~/.cursor/skills/resourceful-problem-solving/
```

Personal `~/.cursor/skills/` syncs to Cloud Agents only if **Settings → Agents → Sync Skills for Cloud Agents** is on. Automations do not load personal skills; put the folder in the repo for those.

### Claude Code / Claude Desktop

```text
~/.claude/skills/resourceful-problem-solving/
```

or, in a repo, `.claude/skills/resourceful-problem-solving/`.

### Codex / ChatGPT desktop (Agent Skills)

```text
~/.agents/skills/resourceful-problem-solving/
```

or `$REPO/.agents/skills/resourceful-problem-solving/`.

Restart the host if a newly copied skill does not appear.

## Activation

- **Automatic:** ask for a project, a tool choice, a cheap alternative, or help under constraints. The host should attach this skill from the description.
- **Explicit, Cursor:** type `/resourceful-problem-solving` in Agent chat. To keep it on for the whole session, use it as a Custom Mode (Option+Enter / Alt+Enter).
- **Explicit, Claude Code:** mention the skill or start from a project prompt.
- **Explicit, Codex:** `$resourceful-problem-solving` or `/skills`.

You should not have to paste `SKILL.md` into the chat.

## Usage

Give the agent the outcome and the real constraints. Example:

> I want searchable notes from 40 hours of lecture MP3s. 2013 ThinkPad, 4 GB RAM, no GPU, Windows 10, not very technical. How should I do this?

A good run looks like: one recommended path, why it fits *you*, the main downside, a backup, and a next step — not a comparison matrix.

For multi-session projects, let it keep a short `PROJECT_STATE.md` in the workspace (see `references/project-memory.md`).

## Platform compatibility

| Host | Skill format | This copy evaluated |
|------|----------------|---------------------|
| Cursor (project `.agents/skills`) | Yes | Spec-validated; used as the instruction set in 19 scored evals on this repo |
| Cursor Cloud Agents | Yes, when the skill is in the repo | Same (this environment) |
| Claude Code | Agent Skills standard | Spec-validated only; not run live in Claude Code here |
| Codex / ChatGPT desktop | Agent Skills standard | Spec-validated only; not run live in Codex here |
| Generic chat with no skill loader | No automatic load | Paste `SKILL.md` only as a last resort |

`scripts/validate_skill.py` (in `skills-dev/resourceful-problem-solving/`) checks the Agent Skills spec: `name` matches the folder, description length, no nested reference chains, no broken links.

## What this is not

- Not a guarantee the agent will find every obscure repository.
- Not a license to skip security, privacy, or the law in the name of "resourcefulness."
- Not a reason to over-process a one-line question.
