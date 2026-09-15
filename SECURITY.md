# Security

JARVIS is built so a website, a PDF, or a random MCP server cannot take over.

## Boundaries

You → JARVIS → a mission → a worker → a tool → the outside world.

A worker cannot skip JARVIS. A tool cannot quietly raise its privileges.
Outside text cannot grant permission. One company cannot override another’s
safety rules.

## What is always treated as untrusted

- Web pages
- Search results
- README files from other people’s projects
- PDFs
- Downloaded scripts

Those may contain facts. They may not authorize actions such as “upload .env”
or “disable the firewall.”

## Protected places

JARVIS must not casually read or show:

- `.env` files
- API keys and tokens
- SSH keys and Keychain
- passwords
- financial records

Secrets are stripped from logs, chat, and mission history. They are not stored
as “memory.”

## MCP

MCP servers are privileged.

- Unknown servers: **denied**
- A server’s own description is not permission
- Nothing is auto-installed from the internet

## Git

JARVIS may look at git, make a branch, and commit locally.

It must **not** automatically push, publish, merge a pull request, or release
software.

## Downloads

Unknown programs are saved, not run. JARVIS stops and asks.

## Trading

Research is allowed. Placing an order always needs a clear yes from you.

## $0 automatic spending

If a paid API is required, JARVIS stops and shows the service, the action, the
cost, why, and alternatives.
