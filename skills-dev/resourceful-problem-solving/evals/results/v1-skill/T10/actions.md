Tools actually used:

- Read `/agent/repos/my-trading-bot/.agents/skills/resourceful-problem-solving/SKILL.md`
- Read `references/discovery.md`, `references/constraints.md`, and `references/decide-and-recover.md` in that skill folder
- Read the Bright Data citation-standards rule file
- GetDynamicTools for Bright Data `search_engine`, then cursor `WebSearch` and `WebFetch`
- Bright Data `search_engine` (three queries: Heroku free tier, Create React App, Coqui TTS). All three failed: Bright Data rejected the credentials ("Auth method is not supported")
- cursor WebSearch: Heroku free tier and pricing; Create React App deprecation; Coqui TTS maintenance and the Idiap fork; Coqui install/RAM requirements; free Python hosts in 2026 (Render, Railway, Fly.io, PythonAnywhere); XTTS-v2 CPML license; GitHub Pages, Cloudflare Pages, and MDN SpeechSynthesis; Vite Node requirement and Cloudflare Pages Vite build settings
- cursor WebFetch: `https://coqui-tts.readthedocs.io/en/latest/installation.html` and `https://developers.cloudflare.com/pages/get-started/git-integration/`. Two earlier WebFetch calls failed because the URL argument was not passed through
- Shell: `mkdir -p /tmp/evals/v1/T10` and listed that directory

No other directories were explored. No code was run beyond creating the output directory.
