# Providers

All providers implement a small interface and are selected by the registry:

`provider_score = quality + availability + free_quota + speed − cost`

Historical stats live in SQLite (`provider_stats`). Failover is ordered, not random.

## LLM (`src/providers/llm`)

| id | Cost | Notes |
|----|------|-------|
| groq | Free tier | Preferred hosted LLM. OpenAI-compatible. Rate limits apply at org level. |
| openrouter | Free models | `meta-llama/llama-3.1-8b-instruct:free` default |
| gemini | Free tier | Optional |
| cloudflare | Workers AI | Optional, not required |
| ollama | Local | Off unless `OLLAMA_ENABLED=true` (too heavy for 8 GB by default) |
| openai | Paid | Blocked unless `ALLOW_PAID_PROVIDERS=true` |
| heuristic / mock | $0 | DEMO_MODE and last resort. Extractive; will not mint fake sources |

## Search (`src/providers/search`)

| id | Key | Notes |
|----|-----|-------|
| wikipedia | none | REST/Action API, proper User-Agent |
| wikidata | none | Entity search |
| brave | optional | Official API only — no SERP scraping |

Random AI-content farms are not treated as Tier 1.

## Media (`src/providers/media`)

Priority: user assets → Pexels → Pixabay → Wikimedia Commons → procedural graphics → (optional) AI image/video adapters later.

| Source | Terms we honor |
|--------|----------------|
| Pexels | API key server-side. Credit photographers. ~200 req/h. Cache. |
| Pixabay | **Cache ≥ 24h**. Show source when displaying API results. 100 req/60s. No mass download. |
| Wikimedia | Per-file license recorded. Attribution stored. |
| Procedural | Original graphics; always available offline |

AI video generation is **not** used by default (cost + license + quality). Adapters can be added without changing agents.

## TTS (`src/providers/tts`)

1. eSpeak NG (default, CPU-light)  
2. Optional OpenAI-compatible cloud TTS if paid is allowed  
3. Optional Kokoro (`KOKORO_ENABLED=true`) — Apache-2.0, 82M; may strain 8 GB with UI+FFmpeg  
4. FFmpeg tone bed as last-resort timing placeholder  

## Transcription

Default: **script-aligned captions** from TTS duration (no Whisper model download). Groq Whisper / whisper.cpp remain optional adapters.

## Music

Bundled original beds generated with FFmpeg oscillators (`data/music/`). Metadata includes title, creator, license, mood, BPM. Never pull unidentified commercial tracks.

## Render

Default: FFmpeg (`src/providers/render`). Ken Burns on stills, scale/crop on video, AAC narration, music amix (ducking via low music gain), optional burned-in subtitles. Sidecar SRT/VTT always written.

**Remotion:** license allows free use for individuals and companies with ≤3 employees. Company automator pricing applies to productized pipelines at larger orgs. Chromium is inappropriate as the default on 8 GB Intel Macs. Adapter documents how to enable later (`RENDER_PROVIDER=remotion`) after a human license review.

## Storage / cloud

Local filesystem first. S3-compatible adapter is a seam (`S3_ENDPOINT`). Cloudflare Workers AI is an LLM provider, not a mandatory runtime.
