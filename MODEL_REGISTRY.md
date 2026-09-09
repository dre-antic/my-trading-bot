# Model registry

Machine-readable source of truth: [`resources/models.json`](resources/models.json)

Verified date: **2026-09-09**

This file is loaded at runtime. License decisions in code go through `aivideostudio.licenses`, not scattered string compares.

## Currently connected in the base studio (no extra install)

| Role | Implementation | Where it runs |
|---|---|---|
| LLM / script writer | Studio research-grounded writer; Ollama or OpenAI-compatible if present | Local; optional cloud |
| Research | Wikipedia REST + DuckDuckGo (`ddgs`) | Local network |
| Image | Studio motion-graphics illustrator; Wikimedia Commons when licensed | Local |
| Video | FFmpeg Ken Burns / shot assembly; optional ComfyUI/Wan/LTX remote | Local CPU + optional remote GPU |
| TTS | eSpeak NG; Piper/Kokoro if installed | Local |
| Music / SFX | Studio procedural composer | Local |
| Captions | Script-timed SRT/VTT/ASS; optional Whisper | Local |
| Review | Rule + research critics + executive producer; LLM polish if configured | Local |

## Optional / remote

FLUX.1 schnell (Apache-2.0), ComfyUI (GPL-3.0 server), Wan 2.1, LTX-Video, CogVideoX, ACE-Step, GPT Researcher, Whisper, Ollama models.

## Blocked or review-required on commercial projects

- FLUX.1 **dev** — non-commercial weights license
- HunyuanVideo — GitHub SPDX `NOASSERTION` / Tencent community license
- Any component with status UNKNOWN, REVIEW_REQUIRED, NON_COMMERCIAL, or BLOCKED

## Fallback policy

Primary fails → secondary provider → local studio path. Exponential backoff, max 3 attempts, no infinite loops. Cloud spend requires budget headroom.
