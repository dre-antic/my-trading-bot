# Permissions

Every action has a color.

## Green — JARVIS may do this on its own

Examples: public web research, reading files inside Projects, running safe
tests, taking a screenshot you asked for, inspecting code, creating project
files.

## Yellow — JARVIS should ask, except in Jarvis mode

Examples: installing unfamiliar software, changing system settings, going
outside the Projects folder, uploads, account changes, cloud services.

In **Jarvis mode**, yellow engineering work may continue so you are not asked
about every small step. Spending money and secrets stay red.

## Red — always ask, in every mode

Examples: spending money, trades, deleting important data or databases, Docker
volume deletion, firewall/SSH changes, publishing, exposing credentials.

When JARVIS asks, the card shows:

- Action
- Target
- Why
- Data involved
- Cost
- Risk
- Whether it can be undone

You get **Approve**, **Reject**, and details.

## Modes

- **Jarvis** — more autonomy, still stops for red lines
- **Assist** — asks before significant yellow actions
- **Safe** — look and explain, no consequential actions
- **Observe** — watch the screen with a visible banner; no silent recording

## Stop

**Stop now** cancels work in progress.

**Pause safely** finishes the current small step and saves the mission.
