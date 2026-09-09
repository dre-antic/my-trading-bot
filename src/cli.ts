#!/usr/bin/env node
export {};
if (process.argv.includes("--demo")) process.env.DEMO_MODE = "true";
if (process.argv.includes("--offline")) process.env.OFFLINE_MODE = "true";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return fallback;
}

const topic = arg("topic");
if (!topic) {
  console.error('Usage: npm run produce -- --topic "..." [--duration 25] [--format documentary] [--demo]');
  process.exit(1);
}

const { queueAndRun, getJob } = await import("./director/index.js");

const m = queueAndRun({
  topic,
  format: (arg("format", "documentary") as "documentary") ?? "documentary",
  durationSec: Number(arg("duration", "25")),
  audience: arg("audience", "General YouTube audience")!,
  tone: arg("tone", "Cinematic documentary")!,
  language: arg("language", "en")!,
  voice: arg("voice", "Natural male")!,
  visualStyle: arg("visual", "Archival cinematic")!,
  musicStyle: arg("music", "documentary")!,
  qualityLevel: "draft",
  budgetUsd: 0,
  approvalMode: "full_automatic",
  aspectRatio: "16:9",
  demo: true,
});
console.log(`Job ${m.jobId} project ${m.projectId}`);

const t0 = Date.now();
while (Date.now() - t0 < 15 * 60 * 1000) {
  const j = getJob(m.jobId);
  if (!j) break;
  process.stdout.write(`\r${j.status} ${j.manifest.stage}          `);
  if (["complete", "failed", "awaiting_approval"].includes(j.status)) {
    console.log("\n", j.status, j.manifest.renderPath || j.manifest.previewPath);
    console.log("QC", JSON.stringify(j.manifest.qc, null, 2));
    process.exit(j.status === "failed" ? 1 : 0);
  }
  await new Promise((r) => setTimeout(r, 400));
}
console.error("timeout");
process.exit(1);
