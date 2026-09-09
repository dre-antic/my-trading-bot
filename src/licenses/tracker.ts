import { db } from "../db/index.js";

export interface LicenseRecord {
  id: string;
  component: string;
  license: string;
  commercial: string;
  attribution?: string;
  notes?: string;
  flagged: boolean;
}

export const THIRD_PARTY: LicenseRecord[] = [
  {
    id: "ffmpeg",
    component: "FFmpeg (system binary)",
    license: "LGPL 2.1+ / GPL if --enable-gpl",
    commercial: "Allowed (LGPL build). GPL builds require corresponding source offer.",
    attribution: "This product uses FFmpeg (https://ffmpeg.org)",
    notes: "Primary renderer. Stream/process files; never assume nonfree codecs.",
    flagged: false,
  },
  {
    id: "remotion",
    component: "Remotion (optional renderer adapter)",
    license: "Remotion License (source-available, not OSI open source)",
    commercial:
      "Free for individuals, non-profits, and for-profit orgs with up to 3 employees. Companies of 4+ need a Company License. Automated video pipelines at company scale may require Remotion for Automators ($0.01/render, $100/mo minimum).",
    notes: "NOT the default renderer because Chromium is too heavy for 8GB Intel Macs. Adapter is provided; FFmpeg is default. Human review required before enabling in a commercial SaaS.",
    flagged: true,
  },
  {
    id: "openreels",
    component: "OpenReels (architecture reference only, not vendored)",
    license: "MIT",
    commercial: "Allowed",
    notes: "Evaluated as a short-form pipeline (Remotion + paid AI video). Not integrated as a dependency because it targets vertical shorts, assumes paid generation, and is too heavy for the target hardware. Ideas (director score, critic loop) informed our design.",
    flagged: false,
  },
  {
    id: "espeak-ng",
    component: "eSpeak NG",
    license: "GPL-3.0",
    commercial: "Allowed if GPL obligations for the binary itself are met; generated audio is user content.",
    attribution: "Speech synthesized with eSpeak NG",
    notes: "Default local TTS. Lightweight enough for 2013/8GB Macs.",
    flagged: false,
  },
  {
    id: "kokoro",
    component: "Kokoro-82M TTS (optional)",
    license: "Apache-2.0",
    commercial: "Allowed",
    notes: "High quality local TTS. 82M params can strain 8GB RAM alongside browser+ffmpeg; optional.",
    flagged: false,
  },
  {
    id: "whisper",
    component: "OpenAI Whisper / Groq Whisper / whisper.cpp (optional)",
    license: "MIT",
    commercial: "Allowed",
    notes: "Default captions are script-aligned from TTS timings to avoid large local models. Whisper is optional.",
    flagged: false,
  },
  {
    id: "pexels",
    component: "Pexels API",
    license: "Pexels License + API terms",
    commercial: "Allowed for most uses; do not resell unaltered stock; API requires attribution to Pexels when showing search results.",
    attribution: "Videos/photos provided by Pexels — credit photographers when possible.",
    notes: "200 req/hour default. Cache results. Server-side key only.",
    flagged: false,
  },
  {
    id: "pixabay",
    component: "Pixabay API",
    license: "Pixabay Content License + API terms",
    commercial: "Allowed with restrictions (no unaltered resale as stock).",
    attribution: "Show users that media is from Pixabay when displaying API search results. Cache 24h (API requirement).",
    notes: "100 req/60s. Mandatory 24h cache. No mass download.",
    flagged: false,
  },
  {
    id: "wikimedia",
    component: "Wikipedia / Wikimedia Commons / Wikidata APIs",
    license: "CC BY-SA 4.0 (Wikipedia text); Commons files vary (CC, public domain)",
    commercial: "Allowed with attribution and share-alike for SA works. Per-file license must be recorded.",
    attribution: "Required. Store creator + license URL per asset.",
    notes: "No API key. Must send a proper User-Agent. Do not scrape HTML; use APIs.",
    flagged: false,
  },
  {
    id: "groq",
    component: "Groq Cloud LLM / Whisper",
    license: "API terms; model weights vary (Llama, etc.)",
    commercial: "Free tier is rate-limited; paid usage billed by Groq. Model licenses (Llama) have their own acceptable use.",
    notes: "Preferred free-tier LLM. Never log API keys.",
    flagged: false,
  },
  {
    id: "better-sqlite3",
    component: "better-sqlite3",
    license: "MIT",
    commercial: "Allowed",
    flagged: false,
  },
  {
    id: "fastify",
    component: "Fastify",
    license: "MIT",
    commercial: "Allowed",
    flagged: false,
  },
  {
    id: "react",
    component: "React / Vite",
    license: "MIT",
    commercial: "Allowed",
    flagged: false,
  },
  {
    id: "zod",
    component: "Zod",
    license: "MIT",
    commercial: "Allowed",
    flagged: false,
  },
];

export function seedLicenses(): void {
  const stmt = db.prepare(
    `INSERT INTO licenses (id, component, license, commercial, attribution, notes, flagged)
     VALUES (@id, @component, @license, @commercial, @attribution, @notes, @flagged)
     ON CONFLICT(id) DO UPDATE SET license=excluded.license, commercial=excluded.commercial, notes=excluded.notes, flagged=excluded.flagged`,
  );
  for (const rec of THIRD_PARTY) {
    stmt.run({
      ...rec,
      attribution: rec.attribution ?? null,
      notes: rec.notes ?? null,
      flagged: rec.flagged ? 1 : 0,
    });
  }
}

export function listLicenses(): LicenseRecord[] {
  return db
    .prepare("SELECT id, component, license, commercial, attribution, notes, flagged FROM licenses")
    .all() as LicenseRecord[];
}

seedLicenses();
