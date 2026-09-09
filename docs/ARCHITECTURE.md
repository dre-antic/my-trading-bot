# Architecture

Aether is a **Video Director** (orchestrator) plus replaceable agents and provider adapters. Agents are TypeScript modules, not separate servers.

```
UI (Vite + React)
    → Fastify API  → Video Director (state machine + SQLite jobs)
                         → Agents (research, facts, script, scenes, visuals, voice, music, captions, assembly, QC, reviewer, packaging)
                         → Provider Registry (score + failover)
                         → FFmpeg / filesystem / optional cloud
```

## Why this stack

| Choice | Reason |
|--------|--------|
| Vite + React, not Next.js | Lower RAM on a 2013 Mac; UI is a dashboard, not an SSR content site |
| Fastify + TypeScript | One process, typed, low overhead |
| SQLite (`better-sqlite3`) | Zero ops; schema allows Postgres later |
| In-process job runner | No Redis. Jobs persist in SQLite + `projects/<id>/manifest.json` |
| FFmpeg renderer | Streams files, works on Intel CPUs, LGPL. Remotion needs Chromium (~1 GB+) and has a company automator license — optional adapter only |
| eSpeak NG | Real narration on 8 GB RAM. Kokoro-82M is optional |
| Wikipedia / Wikimedia APIs | Research + stills with **no API key**. HTML scraping is forbidden |
| Groq / OpenRouter / Gemini / CF Workers AI | Free-tier LLM adapters behind one OpenAI-compatible interface |
| Heuristic LLM | Last-resort / DEMO_MODE writer that **will not invent citations** |

## OpenReels evaluation

[tsensei/OpenReels](https://github.com/tsensei/OpenReels) (MIT) is a topic→Shorts pipeline (Remotion, Redis, paid AI video). We **did not vendor it**. It is short-form only, assumes paid generation (~$0.68/video in their writeup), and is too heavy for the target Mac. Its director/critic loop informed our QC + reviewer stages.

## Director

`src/director/index.ts`

- Creates jobs, persists stage after every agent
- Retries QC up to `QC_MAX_RETRIES` then continues with warnings (no infinite loops)
- Failover is inside each provider family
- Approval modes: `full_automatic` · `approve_before_render` · `approve_final` (default) · `approve_expensive`
- On process start, `resumeIncomplete()` re-queues `queued`/`running` jobs
- Never logs secrets (`redact()`)

## Project layout on disk

```
projects/<project-id>/
  research/ sources/ script/ storyboard/ assets/
  audio/ music/ captions/ renders/ thumbnail/ metadata/ logs/
  manifest.json
```

The manifest is the resume checkpoint.

## Agents

| Agent | Module | Role |
|-------|--------|------|
| Research | `agents/research.ts` | Questions, Wikipedia/Wikidata, source tiers |
| Fact checker | same | Certainty labels; no silent invention |
| Script / story | `agents/script.ts` | Concept→outline→draft→final; format templates |
| Scene planner | `planScenes` | Duration, keywords, motion, overlays |
| Visual search + quality | `agents/visuals.ts` | User/stock/PD/graphic priority; relevance scoring; retry |
| Copyright | `copyrightReport` | Records license + attribution per asset |
| Voice | `agents/audio.ts` | TTS adapter chain |
| Music | same | Bundled original beds + metadata DB |
| Captions | same | Script-aligned SRT/VTT |
| Assembly / render | `agents/assembly.ts` | FFmpeg scene clips + concat + ducking |
| QC | `runQc` | Technical probes + scores 0–100 |
| Reviewer | `runReviewer` | Producer questions; may reject |
| Packaging | `runPackaging` | YouTube package + thumbnail |
| Cost optimizer | Budget manager + free-first registry | Cheapest acceptable path |
| Improvement | SQLite `improvement` rows | Rankings/config only — never self-modifies code |

## Quality control loop

After assembly, QC scores factual / audio / visual / pacing / captions. If overall \< `QC_SCORE_THRESHOLD` (default 85), auto-fixable issues are repaired and the video is re-assembled, up to `QC_MAX_RETRIES` (default 2).

## Caching

SHA-256 keys in SQLite for LLM, search, media metadata, downloads, TTS. Pixabay results use a 24h TTL (API requirement).
