export type MediaKind = "pdf" | "docx" | "txt" | "md" | "json" | "audio" | "video" | "unknown";

const AUDIO_EXT = [".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"];
const VIDEO_EXT = [".mp4", ".mov", ".mkv", ".webm", ".avi"];

export function classifyFilename(filename: string): MediaKind {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  if (AUDIO_EXT.some((ext) => lower.endsWith(ext))) return "audio";
  if (VIDEO_EXT.some((ext) => lower.endsWith(ext))) return "video";
  return "unknown";
}

export function mimeFor(filename: string, fallback = "application/octet-stream"): string {
  const kind = classifyFilename(filename);
  const lower = filename.toLowerCase();
  if (kind === "pdf") return "application/pdf";
  if (kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (kind === "json") return "application/json";
  if (kind === "md") return "text/markdown";
  if (kind === "txt") return "text/plain";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return lower.includes("audio") ? "audio/webm" : "video/webm";
  return fallback;
}

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
