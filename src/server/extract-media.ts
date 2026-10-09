import { classifyFilename, mimeFor, type MediaKind } from "@/core/media";
import { loadConfig } from "./config";
import { transcribeAudio } from "./providers/whisper";

export interface ExtractedMedia {
  text: string;
  kind: MediaKind;
  warnings: string[];
  transcriptionModel?: string;
}

export async function extractMedia(buffer: Buffer, filename: string): Promise<ExtractedMedia> {
  const kind = classifyFilename(filename);
  const warnings: string[] = [];
  if (kind === "txt" || kind === "md" || kind === "json" || kind === "unknown") {
    return { text: buffer.toString("utf8"), kind: kind === "unknown" ? "txt" : kind, warnings };
  }
  if (kind === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default as (buf: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      return { text: parsed.text ?? "", kind, warnings };
    } catch (error) {
      warnings.push(`PDF parse failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return { text: "", kind, warnings };
    }
  }
  if (kind === "docx") {
    try {
      const mammoth = await import("mammoth");
      const parsed = await mammoth.extractRawText({ buffer });
      return { text: parsed.value ?? "", kind, warnings };
    } catch (error) {
      warnings.push(`DOCX parse failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return { text: "", kind, warnings };
    }
  }
  if (kind === "audio" || kind === "video") {
    const whisper = await transcribeAudio(buffer, filename, mimeFor(filename)).catch((error: unknown) => {
      warnings.push(`Whisper failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return null;
    });
    if (whisper?.text) {
      return { text: whisper.text, kind, warnings, transcriptionModel: whisper.model };
    }
    const gemini = kind === "video" ? await describeVideoWithGemini(buffer, filename, mimeFor(filename)).catch((error: unknown) => {
      warnings.push(`Gemini failed: ${error instanceof Error ? error.message : "unknown error"}`);
      return null;
    }) : null;
    if (gemini?.text) {
      return { text: gemini.text, kind, warnings, transcriptionModel: gemini.model };
    }
    warnings.push(
      kind === "audio"
        ? "Audio transcription needs OPENAI_API_KEY (Whisper). Heuristic compile has no source text."
        : "Video understanding needs OPENAI_API_KEY (Whisper on soundtrack) or GEMINI_API_KEY.",
    );
    return { text: "", kind, warnings };
  }
  return { text: "", kind, warnings: ["Unsupported file type."] };
}

async function describeVideoWithGemini(buffer: Buffer, filename: string, mime: string): Promise<{ text: string; model: string } | null> {
  const key = loadConfig().geminiKey;
  if (!key) return null;
  const b64 = buffer.toString("base64");
  if (b64.length > 18_000_000) return null;
  const model = "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mime, data: b64 } },
              {
                text: `Extract mechanical trading rules from this video. Quote evidence. List symbols, timeframe, entry, exit, stop, and take-profit. Filename: ${filename}. Do not invent missing numbers.`,
              },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const body = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  return { text, model };
}
