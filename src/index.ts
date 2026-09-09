import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import { z } from "zod";
import { config, ensureDirs, secretsPath, loadRuntimeSecrets } from "./config/index.js";
import { budget } from "./budget/manager.js";
import { listLicenses } from "./licenses/tracker.js";
import { getStats } from "./providers/registry.js";
import { llmProviders } from "./providers/llm/index.js";
import { remotionAdapter } from "./providers/render/index.js";
import {
  approveJob,
  cancelJob,
  getJob,
  listJobs,
  pauseJob,
  queueAndRun,
  resumeIncomplete,
  runJob,
  subscribe,
} from "./director/index.js";
import { readManifest } from "./projects/store.js";
import { logger, redact } from "./observability/logger.js";

const CreateSchema = z.object({
  topic: z.string().min(3).max(400),
  format: z.enum([
    "youtube_long",
    "youtube_shorts",
    "tiktok",
    "instagram_reels",
    "documentary",
    "educational",
    "storytelling",
    "news_explainer",
    "list",
    "historical",
    "faceless",
  ] as const),
  durationSec: z.number().min(8).max(3600),
  audience: z.string().default("General YouTube audience"),
  tone: z.string().default("Cinematic documentary"),
  language: z.string().default("en"),
  voice: z.string().default("Natural male"),
  visualStyle: z.string().default("Archival cinematic"),
  musicStyle: z.string().default("documentary"),
  qualityLevel: z.enum(["draft", "standard", "high"]).default("standard"),
  budgetUsd: z.number().min(0).default(0),
  approvalMode: z.enum(["full_automatic", "approve_before_render", "approve_final", "approve_expensive"]).default("approve_final"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  demo: z.boolean().optional(),
});

const KEY_FIELDS = [
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "PEXELS_API_KEY",
  "PIXABAY_API_KEY",
  "BRAVE_API_KEY",
  "TAVILY_API_KEY",
  "ELEVENLABS_API_KEY",
];

function mask(v: string): string {
  if (!v) return "";
  if (v.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
}

export async function buildServer() {
  ensureDirs();
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const webDist = path.resolve("web/dist");
  if (fs.existsSync(webDist)) {
    await app.register(staticPlugin, { root: webDist, prefix: "/", decorateReply: false });
  }

  app.get("/api/health", async () => ({
    ok: true,
    demoMode: config.demoMode,
    offlineMode: config.offlineMode,
    allowPaid: config.allowPaidProviders,
    remotion: remotionAdapter,
  }));

  app.get("/api/jobs", async () => ({ jobs: listJobs() }));

  app.post("/api/jobs", async (req, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const m = queueAndRun(parsed.data);
    return { jobId: m.jobId, projectId: m.projectId, stage: m.stage };
  });

  app.get("/api/jobs/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const j = getJob(id);
    if (!j) return reply.code(404).send({ error: "not found" });
    return {
      status: j.status,
      manifest: j.manifest,
      spendUsd: budget.jobSpend(id),
    };
  });

  app.post("/api/jobs/:id/pause", async (req) => {
    pauseJob((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/jobs/:id/resume", async (req) => {
    const id = (req.params as { id: string }).id;
    void runJob(id);
    return { ok: true };
  });
  app.post("/api/jobs/:id/cancel", async (req) => {
    cancelJob((req.params as { id: string }).id);
    return { ok: true };
  });
  app.post("/api/jobs/:id/approve", async (req) => {
    approveJob((req.params as { id: string }).id);
    return { ok: true };
  });

  app.get("/api/projects/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const m = readManifest(id);
    if (!m) return reply.code(404).send({ error: "not found" });
    return m;
  });

  app.get("/api/settings", async () => {
    const stored = loadRuntimeSecrets();
    const keys: Record<string, { configured: boolean; masked: string; freeTier: boolean }> = {};
    for (const k of KEY_FIELDS) {
      const v = stored[k] || process.env[k] || "";
      keys[k] = {
        configured: Boolean(v),
        masked: mask(v),
        freeTier: !["OPENAI_API_KEY", "ELEVENLABS_API_KEY"].includes(k),
      };
    }
    return {
      demoMode: config.demoMode,
      allowPaidProviders: config.allowPaidProviders,
      maxDailySpend: config.maxDailySpend,
      maxMonthlySpend: config.maxMonthlySpend,
      approvalMode: config.approvalMode,
      spentToday: budget.spentToday(),
      spentMonth: budget.spentThisMonth(),
      keys,
      llm: llmProviders().map((p) => ({ id: p.id, configured: p.configured, free: p.free, paid: p.paid, stats: getStats(p.id, "llm") })),
    };
  });

  app.post("/api/settings", async (req) => {
    const body = (req.body ?? {}) as Record<string, string>;
    const current = loadRuntimeSecrets();
    for (const k of KEY_FIELDS) {
      if (typeof body[k] === "string" && body[k] && !body[k].includes("•")) {
        current[k] = body[k].trim();
      }
    }
    fs.mkdirSync(path.dirname(secretsPath()), { recursive: true });
    fs.writeFileSync(secretsPath(), JSON.stringify(current, null, 2), { mode: 0o600 });
    return { ok: true };
  });

  app.get("/api/licenses", async () => ({ licenses: listLicenses() }));

  app.get("/api/budget", async () => ({
    spentToday: budget.spentToday(),
    spentMonth: budget.spentThisMonth(),
    maxDaily: config.maxDailySpend,
    maxMonthly: config.maxMonthlySpend,
    allowPaid: config.allowPaidProviders,
  }));

  app.get("/events", async (req, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const un = subscribe((payload) => {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
    req.raw.on("close", un);
  });

  app.get("/api/jobs/:id/media/:kind", async (req, reply) => {
    const { id, kind } = req.params as { id: string; kind: string };
    const j = getJob(id);
    if (!j) return reply.code(404).send({ error: "not found" });
    const file =
      kind === "thumb"
        ? j.manifest.youtube?.thumbnailPath
        : kind === "preview"
          ? j.manifest.previewPath
          : j.manifest.renderPath || j.manifest.previewPath;
    if (!file || !fs.existsSync(file)) return reply.code(404).send({ error: "not found" });
    const allowed =
      path.resolve(file).startsWith(path.resolve(config.projectsDir)) ||
      path.resolve(file).startsWith(path.resolve(config.dataDir));
    if (!allowed) return reply.code(403).send({ error: "forbidden" });
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".mp4" ? "video/mp4" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
    return reply.type(type).send(fs.createReadStream(file));
  });

  app.get("/media/*", async (req, reply) => {
    const rel = decodeURIComponent((req.params as { "*": string })["*"] ?? "");
    const candidate = path.isAbsolute("/" + rel.replace(/^\/+/, "")) && rel.includes("projects")
      ? path.resolve("/" + rel.replace(/^\/+/, ""))
      : path.resolve(rel.startsWith("/") ? rel : path.join(config.projectsDir, rel));
    const full = path.resolve(candidate);
    const allowed = full.startsWith(path.resolve(config.projectsDir)) || full.startsWith(path.resolve(config.dataDir));
    if (!allowed || !fs.existsSync(full)) return reply.code(404).send({ error: "not found" });
    const ext = path.extname(full).toLowerCase();
    const type = ext === ".mp4" ? "video/mp4" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
    return reply.type(type).send(fs.createReadStream(full));
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/events") || req.url.startsWith("/media")) {
      return reply.code(404).send({ error: "not found" });
    }
    const index = path.join(webDist, "index.html");
    if (fs.existsSync(index)) return reply.type("text/html").send(fs.readFileSync(index));
    return reply.code(404).send({ error: "ui not built" });
  });

  return app;
}

export async function startServer(): Promise<void> {
  const app = await buildServer();
  const resumed = resumeIncomplete();
  if (resumed.length) logger.info({ resumed }, "resuming incomplete jobs");
  await app.listen({ port: config.port, host: config.host });
  logger.info(`Aether Studio http://${config.host}:${config.port}`);
}

const isMain = /src\/index\.ts|dist\/index\.js/.test(process.argv[1] ?? "");
if (isMain) {
  void startServer().catch((e) => {
    logger.error(redact(String(e)));
    process.exit(1);
  });
}
