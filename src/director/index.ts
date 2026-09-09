import { db, nowIso } from "../db/index.js";
import { config } from "../config/index.js";
import { classifyError, logJob, makeEvent, redact } from "../observability/logger.js";
import { budget } from "../budget/manager.js";
import { ensureProject, readManifest, writeManifest, appendLog, newIds, setStage } from "../projects/store.js";
import { runFactCheck, runResearch } from "../agents/research.js";
import { planScenes, runScript } from "../agents/script.js";
import { runVisuals } from "../agents/visuals.js";
import { runCaptions, runMusic, runVoice } from "../agents/audio.js";
import { runAssembly, runPackaging, runQc, runRender, runReviewer } from "../agents/assembly.js";
import type { CreateJobRequest, ProjectManifest, Stage } from "../types/index.js";
import { STAGES } from "../types/index.js";

export type JobStatus = "queued" | "running" | "paused" | "awaiting_approval" | "complete" | "failed" | "cancelled";

const PIPELINE: Stage[] = [
  "intake",
  "research",
  "fact_check",
  "concept",
  "outline",
  "script",
  "storyboard",
  "assets",
  "voice",
  "music",
  "captions",
  "assembly",
  "qc",
  "render",
  "packaging",
  "final_review",
  "awaiting_approval",
];

const listeners = new Set<(payload: unknown) => void>();
export function subscribe(fn: (payload: unknown) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(payload: unknown): void {
  for (const fn of listeners) fn(payload);
}

export function createJob(request: CreateJobRequest): ProjectManifest {
  const { jobId, projectId } = newIds();
  ensureProject(projectId);
  const m: ProjectManifest = {
    projectId,
    jobId,
    request,
    stage: "intake",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    costs: [],
    warnings: [],
    retries: 0,
    humanApprovalRequired: request.approvalMode !== "full_automatic",
  };
  writeManifest(m);
  db.prepare(
    `INSERT INTO jobs (id, project_id, status, stage, request_json, manifest_json, created_at, updated_at)
     VALUES (?, ?, 'queued', 'intake', ?, ?, ?, ?)`,
  ).run(jobId, projectId, JSON.stringify(request), JSON.stringify(m), m.createdAt, m.updatedAt);
  logJob(makeEvent(jobId, "intake", `Job created: ${request.topic}`));
  return m;
}

function persist(m: ProjectManifest, status: JobStatus): void {
  writeManifest(m);
  db.prepare("UPDATE jobs SET status=?, stage=?, manifest_json=?, updated_at=?, error=? WHERE id=?").run(
    status,
    m.stage,
    JSON.stringify(m),
    nowIso(),
    null,
    m.jobId,
  );
  emit({ type: "job", jobId: m.jobId, projectId: m.projectId, stage: m.stage, status, qc: m.qc, cost: budget.jobSpend(m.jobId) });
}

export function getJob(jobId: string): { status: JobStatus; manifest: ProjectManifest } | null {
  const row = db.prepare("SELECT status, manifest_json FROM jobs WHERE id = ?").get(jobId) as
    | { status: JobStatus; manifest_json: string }
    | undefined;
  if (!row) return null;
  return { status: row.status, manifest: JSON.parse(row.manifest_json) as ProjectManifest };
}

export function listJobs(): unknown[] {
  return db
    .prepare("SELECT id, project_id, status, stage, created_at, updated_at, request_json FROM jobs ORDER BY created_at DESC LIMIT 50")
    .all()
    .map((r: any) => ({ ...r, request: JSON.parse(r.request_json) }));
}

export function pauseJob(jobId: string): void {
  const j = getJob(jobId);
  if (!j) return;
  j.manifest.stage = "paused";
  persist(j.manifest, "paused");
}

export function cancelJob(jobId: string): void {
  const j = getJob(jobId);
  if (!j) return;
  j.manifest.stage = "cancelled";
  persist(j.manifest, "cancelled");
}

export function approveJob(jobId: string): void {
  const j = getJob(jobId);
  if (!j) return;
  j.manifest.approvedAt = nowIso();
  j.manifest.humanApprovalRequired = false;
  if (j.manifest.stage === "awaiting_approval" || j.status === "awaiting_approval") {
    j.manifest.stage = "complete";
    persist(j.manifest, "complete");
  } else {
    persist(j.manifest, j.status);
  }
}

const running = new Set<string>();

export async function runJob(jobId: string): Promise<void> {
  if (running.has(jobId)) return;
  running.add(jobId);
  const current = getJob(jobId);
  if (!current) {
    running.delete(jobId);
    return;
  }
  if (current.status === "paused" || current.status === "cancelled") {
    running.delete(jobId);
    return;
  }
  let m = current.manifest;
  persist(m, "running");
  const startIndex = Math.max(0, PIPELINE.indexOf(m.stage === "paused" || m.stage === "failed" ? "intake" : m.stage));
  try {
    for (let i = startIndex; i < PIPELINE.length; i++) {
      const again = getJob(jobId);
      if (!again || again.status === "paused" || again.status === "cancelled") return;
      const stage = PIPELINE[i];
      if (stageCompleted(m, stage) && stage !== m.stage) continue;
      const t0 = Date.now();
      setStage(m, stage);
      persist(m, "running");
      appendLog(m.projectId, `begin ${stage}`);
      logJob(makeEvent(jobId, stage, `Starting ${stage}`));
      await executeStage(m, stage);
      logJob(makeEvent(jobId, stage, `Finished ${stage}`, { durationMs: Date.now() - t0, costUsd: budget.jobSpend(jobId) }));
      appendLog(m.projectId, `end ${stage} ${Date.now() - t0}ms`);
      persist(m, "running");

      if (m.request.approvalMode === "approve_before_render" && stage === "qc") {
        m.stage = "awaiting_approval";
        persist(m, "awaiting_approval");
        return;
      }
    }
    if (m.request.approvalMode === "full_automatic") {
      m.stage = "complete";
      persist(m, "complete");
      db.prepare("INSERT INTO improvement (job_id, payload, created_at) VALUES (?, ?, ?)").run(
        jobId,
        JSON.stringify({
          qc: m.qc,
          costs: m.costs,
          retries: m.retries,
          providers: (m.voices ?? []).map((v) => v.provider),
          graphics: (m.assets ?? []).filter((a) => a.kind === "graphic").length,
        }),
        nowIso(),
      );
    } else {
      m.stage = "awaiting_approval";
      persist(m, "awaiting_approval");
    }
  } catch (err) {
    const msg = redact(err instanceof Error ? err.message : String(err));
    m.stage = "failed";
    m.warnings.push(msg);
    writeManifest(m);
    db.prepare("UPDATE jobs SET status='failed', stage='failed', error=?, manifest_json=?, updated_at=? WHERE id=?").run(
      msg,
      JSON.stringify(m),
      nowIso(),
      jobId,
    );
    logJob(makeEvent(jobId, "failed", msg, { errorClass: classifyError(err) }));
    emit({ type: "job", jobId, stage: "failed", status: "failed", error: msg });
  } finally {
    running.delete(jobId);
  }
}

function stageCompleted(m: ProjectManifest, stage: Stage): boolean {
  switch (stage) {
    case "research":
      return Boolean(m.research);
    case "script":
    case "concept":
    case "outline":
      return Boolean(m.script);
    case "storyboard":
      return Boolean(m.scenes?.length);
    case "assets":
      return Boolean(m.assets?.length);
    case "voice":
      return Boolean(m.voices?.length);
    case "music":
      return Boolean(m.musicPath);
    case "captions":
      return Boolean(m.captions?.length);
    case "assembly":
      return Boolean(m.previewPath);
    case "qc":
      return Boolean(m.qc);
    case "render":
      return Boolean(m.renderPath);
    case "packaging":
      return Boolean(m.youtube);
    default:
      return false;
  }
}

async function executeStage(m: ProjectManifest, stage: Stage): Promise<void> {
  switch (stage) {
    case "intake":
      return;
    case "research":
      await runResearch(m);
      return;
    case "fact_check":
      await runFactCheck(m);
      return;
    case "concept":
    case "outline":
    case "script":
      if (!m.script) await runScript(m);
      return;
    case "storyboard":
      planScenes(m);
      return;
    case "assets":
      await runVisuals(m);
      return;
    case "voice":
      await runVoice(m);
      return;
    case "music":
      await runMusic(m);
      return;
    case "captions":
      await runCaptions(m);
      return;
    case "assembly":
      await runAssembly(m);
      return;
    case "qc":
      await qcLoop(m);
      return;
    case "render":
      await runRender(m, false);
      return;
    case "packaging":
      await runPackaging(m);
      return;
    case "final_review": {
      const review = await runReviewer(m);
      if (review.verdict === "reject") {
        m.warnings.push(`Reviewer rejected: ${(review.changes ?? []).join("; ")}`);
      }
      return;
    }
    case "awaiting_approval":
      return;
    default:
      return;
  }
}

async function qcLoop(m: ProjectManifest): Promise<void> {
  let attempt = 0;
  while (attempt <= config.qcMaxRetries) {
    const qc = await runQc(m);
    if (qc.overall >= config.qcThreshold) return;
    attempt += 1;
    m.retries += 1;
    if (attempt > config.qcMaxRetries) {
      m.warnings.push(`QC score ${qc.overall} below ${config.qcThreshold} after ${config.qcMaxRetries} retries; continuing with warnings.`);
      return;
    }
    m.warnings.push(`QC ${qc.overall} < ${config.qcThreshold}, repair pass ${attempt}`);
    const fixable = qc.issues.filter((i) => i.autoFixable);
    if (fixable.some((i) => i.code === "missing_assets" || i.code === "all_procedural")) {
      await runVisuals(m);
    }
    if (fixable.some((i) => i.code === "no_captions")) {
      await runCaptions(m);
    }
    await runAssembly(m);
  }
}

export function resumeIncomplete(): string[] {
  const rows = db
    .prepare("SELECT id, status FROM jobs WHERE status IN ('queued','running')")
    .all() as { id: string; status: string }[];
  const ids: string[] = [];
  for (const r of rows) {
    ids.push(r.id);
    void runJob(r.id);
  }
  return ids;
}

export function queueAndRun(request: CreateJobRequest): ProjectManifest {
  const m = createJob(request);
  setImmediate(() => {
    void runJob(m.jobId);
  });
  return m;
}

export { PIPELINE, STAGES };
