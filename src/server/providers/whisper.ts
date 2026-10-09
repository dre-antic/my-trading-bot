import { loadConfig } from "../config";

export async function transcribeAudio(buffer: Buffer, filename: string, mime: string): Promise<{ text: string; model: string } | null> {
  const key = loadConfig().openaiKey;
  if (!key) return null;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  form.append("model", "whisper-1");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Whisper HTTP ${res.status}`);
    const body = (await res.json()) as { text?: string };
    return { text: body.text ?? "", model: "whisper-1" };
  } finally {
    clearTimeout(timer);
  }
}
