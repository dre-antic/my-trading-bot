# License tracking

Seeded at runtime from `src/licenses/tracker.ts` and shown in the UI.

## Decision: Remotion vs FFmpeg

Remotion’s own license (2026) is free for individuals, non-profits, and for-profit organizations with **up to 3 employees**. Larger companies need a Company License. **Remotion for Automators** (usage-based, $100/mo minimum) is aimed at automated video products. Using Remotion as the engine of a prompt-to-video SaaS at company scale is a **human review** item.

Independently of licensing, Remotion renders via Chromium, which is a poor default on an 8 GB 2013 Mac.

**Aether therefore ships FFmpeg as the renderer** and keeps a Remotion adapter stub that explains how to opt in.

## OpenReels

MIT. Evaluated, not copied. Short-form + Remotion + paid AI video — wrong default for this product.

## Runtime

| Component | License | Commercial | Notes |
|-----------|---------|------------|-------|
| FFmpeg | LGPL 2.1+ (GPL if so built) | Yes with LGPL obligations | System binary |
| eSpeak NG | GPL-3.0 | Binary GPL; output is user content | Default TTS |
| Kokoro-82M | Apache-2.0 | Yes | Optional |
| Whisper | MIT | Yes | Optional |
| Pexels API | Pexels License + API ToS | Yes with API attribution rules | Optional key |
| Pixabay API | Content License + 24h cache | Yes with restrictions | Optional key |
| Wikipedia text | CC BY-SA 4.0 | Yes with attribution/share-alike | Default research |
| Commons files | Varies | Recorded per file | Default stills fallback |
| Groq | API ToS + model licenses | Free tier then paid | Optional |
| React, Fastify, Zod, better-sqlite3, Vite | MIT | Yes | |

Flagged for human review: **Remotion**.
