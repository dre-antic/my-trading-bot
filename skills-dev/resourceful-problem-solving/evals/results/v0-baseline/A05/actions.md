Tools used:

- GetDynamicTools (cursor / WebSearch) to read the WebSearch schema.
- WebSearch: "Llama 3.1 405B VRAM RAM requirements quantized local 2026". Used the Hugging Face Llama 3.1 memory table and the Ollama/calculator size figures.
- WebSearch: "best local LLM for 12GB VRAM 32GB RAM email writing summarization Ollama 2026". Used this to find candidate 12 GB models (Qwen3.5 9B, Gemma 4 12B).
- GetDynamicTools (cursor / WebFetch) to read the WebFetch schema.
- WebFetch: https://ollama.com/library/gemma4 — confirmed `gemma4:12b` is 7.7–8.0 GB with a 256K advertised context.
- WebFetch: https://ollama.com/library/qwen3.5 — confirmed `qwen3.5:9b` is 6.6–7.6 GB and `qwen3.5:4b` is 3.3–4.0 GB.
- WebSearch: "site:ollama.com/library gemma4 qwen3.5 llama3.1" — corroborated the Ollama tags, and noted Llama 4 Scout is a 67 GB download.
- WebFetch: https://ollama.com/library/llama3.1 — confirmed `llama3.1:405b` is 243 GB, `llama3.1:70b` is 43 GB, and `llama3.1:8b` is 4.9 GB.

No shell commands were run. No local files outside /tmp/evals/v0/A05 were read.
