# Providers

JARVIS can use more than one helper. None of them are allowed to spend money
without you.

| Provider | What it is | Cost | Status on a fresh install |
| --- | --- | --- | --- |
| local-coding | JARVIS’s own builder (creates real files + tests) | $0 | Connected |
| cursor-acp | Cursor Agent Client Protocol (`agent acp`) | Your Cursor account. JARVIS will not bill extra APIs for you | Disconnected until Cursor CLI is installed and you run `agent login` |
| cursor-cli | `agent -p` print mode | Same | Same |
| local-research | Public web pages | $0 | Used when the network works |
| browser-local | Fetch pages | $0 | Connected for HTTP; click/type needs extra tools |
| openai / anthropic | Cloud models | Paid | **Disconnected.** Keys go in the OS keychain from Settings, never in chat. Still $0 until you approve a charge |

## Cursor on your Mac (what you approve later)

1. Install Cursor CLI from https://cursor.com/docs/cli/overview
2. Run `agent login` in Terminal once
3. Restart JARVIS

JARVIS will then drive Cursor with ACP. It will not click around the Cursor
window if that protocol is available.

Optional environment variables (you set these; JARVIS does not):

- `CURSOR_API_KEY`
- `CURSOR_AUTH_TOKEN`

Do not paste those into chat.

## Health

Open **Providers** in the app. You will see connected / disconnected /
needs sign-in — not a fake “ready” light.
