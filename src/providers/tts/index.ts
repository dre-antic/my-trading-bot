import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, secret } from "../../config/index.js";
import { cache, cacheKey } from "../../cache/index.js";
import { ProviderError } from "../errors.js";

export interface TtsResult {
  path: string;
  durationSec: number;
  provider: string;
  voice: string;
}

function runCapture(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

export async function probeDuration(file: string): Promise<number> {
  const r = await runCapture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  const n = parseFloat(r.stdout.trim());
  return Number.isFinite(n) ? n : 0;
}

function voiceFor(pref: string): { espeak: string; openai: string } {
  const p = pref.toLowerCase();
  if (p.includes("female")) return { espeak: "en-us+f3", openai: "nova" };
  if (p.includes("neutral")) return { espeak: "en-us", openai: "alloy" };
  return { espeak: "en-us+m3", openai: "onyx" };
}

export async function synthesizeEspeak(text: string, outWav: string, voicePref: string, speed = 1): Promise<TtsResult> {
  fs.mkdirSync(path.dirname(outWav), { recursive: true });
  const voice = voiceFor(voicePref).espeak;
  const wpm = Math.round(165 * speed);
  const r = await runCapture("espeak-ng", ["-v", voice, "-s", String(wpm), "-w", outWav, "--", text]);
  if (r.code !== 0 || !fs.existsSync(outWav)) {
    throw new ProviderError(`espeak-ng failed: ${r.stderr}`, "espeak", "PROVIDER_FAILURE", false);
  }
  const durationSec = await probeDuration(outWav);
  return { path: outWav, durationSec, provider: "espeak", voice };
}

export async function synthesizeFfmpegTone(text: string, outWav: string): Promise<TtsResult> {
  // Last-resort audible placeholder: short tones between pauses so timing still works offline without TTS.
  const words = Math.max(1, text.split(/\s+/).length);
  const duration = Math.max(1.5, words / 2.4);
  fs.mkdirSync(path.dirname(outWav), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=180:duration=${duration},afade=t=in:st=0:d=0.05,afade=t=out:st=${Math.max(0.1, duration - 0.08)}:d=0.08`,
      outWav,
    ]);
    child.on("close", (c) => (c === 0 ? resolve() : reject(new Error("tone tts failed"))));
  });
  return { path: outWav, durationSec: duration, provider: "tone", voice: "tone" };
}

export async function synthesizeOpenAiCompat(text: string, outPath: string, voicePref: string): Promise<TtsResult> {
  const openaiKey = secret("OPENAI_API_KEY");
  if (!openaiKey || !config.allowPaidProviders) {
    throw new ProviderError("OpenAI TTS not authorized", "openai-tts", "AUTHENTICATION", false);
  }
  const voice = voiceFor(voicePref).openai;
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${openaiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "tts-1", input: text.slice(0, 4000), voice, response_format: "wav" }),
  });
  if (!res.ok) throw new ProviderError(`openai tts ${res.status}`, "openai-tts", "PROVIDER_FAILURE", true);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return { path: outPath, durationSec: await probeDuration(outPath), provider: "openai-tts", voice };
}

export async function synthesize(text: string, outWav: string, voicePref: string, speed = 1): Promise<TtsResult> {
  const key = cacheKey(["tts", text, voicePref, speed]);
  const cached = cache.getPath(key);
  if (cached) {
    const dest = outWav;
    fs.copyFileSync(cached, dest);
    return { path: dest, durationSec: await probeDuration(dest), provider: "cache", voice: voicePref };
  }
  let result: TtsResult | undefined;
  try {
    result = await synthesizeEspeak(text, outWav, voicePref, speed);
  } catch {
    try {
      result = await synthesizeOpenAiCompat(text, outWav, voicePref);
    } catch {
      result = await synthesizeFfmpegTone(text, outWav);
    }
  }
  const cachePath = path.join(cache.fileDir("tts"), `${key}.wav`);
  fs.copyFileSync(result.path, cachePath);
  cache.set(key, "tts", { voice: result.voice, provider: result.provider }, 30 * 24 * 60 * 60 * 1000, cachePath);
  return result;
}

export function estimateSpeechSec(text: string, wpm = 150): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, (words / wpm) * 60);
}
