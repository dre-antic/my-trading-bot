import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import type { ApprovalMode } from "../types/index.js";

dotenv.config();

function bool(v: string | undefined, d = false): boolean {
  if (v === undefined) return d;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export const ROOT = process.cwd();

export const config = {
  demoMode: bool(process.env.DEMO_MODE, true),
  offlineMode: bool(process.env.OFFLINE_MODE, false),
  port: num(process.env.PORT, 8787),
  host: process.env.HOST ?? "127.0.0.1",
  logLevel: process.env.LOG_LEVEL ?? "info",
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  projectsDir: path.resolve(process.env.PROJECTS_DIR ?? "./projects"),
  videoWidth: num(process.env.VIDEO_WIDTH, 1280),
  videoHeight: num(process.env.VIDEO_HEIGHT, 720),
  fps: num(process.env.VIDEO_FPS, 24),
  ffmpegPreset: process.env.FFMPEG_PRESET ?? "veryfast",
  maxConcurrentJobs: num(process.env.MAX_CONCURRENT_JOBS, 1),
  allowPaidProviders: bool(process.env.ALLOW_PAID_PROVIDERS, false),
  maxDailySpend: num(process.env.MAX_DAILY_SPEND, 0),
  maxMonthlySpend: num(process.env.MAX_MONTHLY_SPEND, 0),
  requireApprovalAboveCost: num(process.env.REQUIRE_APPROVAL_ABOVE_COST, 0),
  jobBudgetUsd: num(process.env.JOB_BUDGET_USD, 0),
  approvalMode: (process.env.APPROVAL_MODE ?? "approve_final") as ApprovalMode,
  qcThreshold: num(process.env.QC_SCORE_THRESHOLD, 85),
  qcMaxRetries: num(process.env.QC_MAX_RETRIES, 2),
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterModel: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.1-8b-instruct:free",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  braveApiKey: process.env.BRAVE_API_KEY ?? "",
  tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
  pexelsApiKey: process.env.PEXELS_API_KEY ?? "",
  pixabayApiKey: process.env.PIXABAY_API_KEY ?? "",
  unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY ?? "",
  kokoroEnabled: bool(process.env.KOKORO_ENABLED, false),
  piperBin: process.env.PIPER_BIN ?? "",
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  renderProvider: process.env.RENDER_PROVIDER ?? "ffmpeg",
  userAgent: "AetherStudio/1.0 (https://github.com/aether-studio; research+attribution; video-production)",
  fontFile:
    process.env.FONT_FILE ||
    [
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
      "/usr/share/fonts/truetype/macos/Inter-Bold.ttf",
      "/Library/Fonts/Arial Bold.ttf",
      "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ].find((p) => fs.existsSync(p)) ||
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  fontRegular:
    process.env.FONT_REGULAR ||
    [
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      "/usr/share/fonts/truetype/macos/Inter-Regular.ttf",
    ].find((p) => fs.existsSync(p)) ||
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
};

export function ensureDirs(): void {
  for (const dir of [
    config.dataDir,
    config.projectsDir,
    path.join(config.dataDir, "cache"),
    path.join(config.dataDir, "tmp"),
    path.join(config.dataDir, "music"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function secretsPath(): string {
  return path.join(config.dataDir, "secrets.json");
}

export function loadRuntimeSecrets(): Record<string, string> {
  try {
    const p = secretsPath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function secret(name: string): string {
  const runtime = loadRuntimeSecrets();
  return runtime[name] || (process.env[name] ?? "") || ((config as Record<string, unknown>)[camel(name)] as string) || "";
}

function camel(s: string): string {
  return s.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function isPaidAllowed(): boolean {
  return config.allowPaidProviders;
}
