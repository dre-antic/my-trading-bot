import type { CaptionCue } from "../../types/index.js";
import { secret } from "../../config/index.js";
import { ProviderError } from "../errors.js";

export function alignScript(text: string, durationSec: number): CaptionCue[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const totalChars = words.reduce((a, w) => a + w.length, 0) || 1;
  let t = 0;
  const wordTimings: { word: string; startSec: number; endSec: number }[] = [];
  for (const w of words) {
    const dur = Math.max(0.12, (w.length / totalChars) * durationSec);
    wordTimings.push({ word: w, startSec: t, endSec: t + dur });
    t += dur;
  }
  const cues: CaptionCue[] = [];
  const chunk = 8;
  for (let i = 0; i < wordTimings.length; i += chunk) {
    const slice = wordTimings.slice(i, i + chunk);
    cues.push({
      startSec: slice[0].startSec,
      endSec: slice[slice.length - 1].endSec,
      text: slice.map((w) => w.word).join(" "),
      words: slice,
    });
  }
  return cues;
}

export function toSrt(cues: CaptionCue[], offsetSec = 0): string {
  return cues
    .map((c, i) => {
      const a = fmt(c.startSec + offsetSec);
      const b = fmt(c.endSec + offsetSec);
      return `${i + 1}\n${a} --> ${b}\n${c.text}\n`;
    })
    .join("\n");
}

export function toVtt(cues: CaptionCue[], offsetSec = 0): string {
  return "WEBVTT\n\n" + toSrt(cues, offsetSec).replace(/,/g, ".");
}

function fmt(sec: number): string {
  const s = Math.max(0, sec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${pad(hh)}:${pad(mm)}:${pad(ss)},${String(ms).padStart(3, "0")}`;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Optional Groq Whisper — used when the user wants transcription of mixed audio rather than script alignment. */
export async function groqTranscribe(_filePath: string): Promise<CaptionCue[] | null> {
  const key = secret("GROQ_API_KEY");
  if (!key) return null;
  throw new ProviderError("Direct audio upload transcription is optional; default is script-aligned captions.", "groq-whisper", "INVALID_REQUEST", false);
}
