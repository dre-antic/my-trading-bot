# Tools used

- Read `/agent/repos/my-trading-bot/.agents/skills/resourceful-problem-solving/SKILL.md`.
- Read `references/constraints.md`, `references/decide-and-recover.md`, and `references/discovery.md` in that skill folder.
- GetDynamicTools for Bright Data `search_engine`. Four `search_engine` calls failed: Bright Data rejected the credentials (`Auth method is not supported`).
- GetDynamicTools for Cursor `WebSearch` and `WebFetch`.
- WebSearch: Llama 3.1 405B memory requirements; local models for 12 GB VRAM; ChatGPT free-plan limits; Ollama model sizes; LM Studio download and docs.
- WebFetch: OpenAI free-tier FAQ, OpenAI file-upload help, `https://ollama.com/library/llama3.1`, `https://ollama.com/library`, `https://ollama.com/library/gemma4`, `https://ollama.com/library/qwen3`, LM Studio system requirements. LM Studio getting-started, download-model, and document-chat pages came back via search-result page text.
- Grep on the saved Ollama library fetch to confirm current model names (`gemma4`, `qwen3`, `llama3.1`).
- Shell: `mkdir -p /tmp/evals/v1/A05`.
