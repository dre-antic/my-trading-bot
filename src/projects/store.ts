import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { config } from "../config/index.js";
import type { ProjectManifest, Stage } from "../types/index.js";

export function projectDir(projectId: string): string {
  return path.join(config.projectsDir, projectId);
}

export const PROJECT_SUBDIRS = [
  "research",
  "sources",
  "script",
  "storyboard",
  "assets",
  "audio",
  "music",
  "captions",
  "renders",
  "thumbnail",
  "metadata",
  "logs",
] as const;

export function ensureProject(projectId: string): string {
  const root = projectDir(projectId);
  for (const d of PROJECT_SUBDIRS) fs.mkdirSync(path.join(root, d), { recursive: true });
  return root;
}

export function manifestPath(projectId: string): string {
  return path.join(projectDir(projectId), "manifest.json");
}

export function readManifest(projectId: string): ProjectManifest | null {
  const p = manifestPath(projectId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectManifest;
}

export function writeManifest(m: ProjectManifest): void {
  m.updatedAt = new Date().toISOString();
  ensureProject(m.projectId);
  const tmp = manifestPath(m.projectId) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
  fs.renameSync(tmp, manifestPath(m.projectId));
  fs.writeFileSync(path.join(projectDir(m.projectId), "metadata", "manifest.json"), JSON.stringify(m, null, 2));
}

export function appendLog(projectId: string, line: string): void {
  const f = path.join(projectDir(projectId), "logs", "job.log");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, `[${new Date().toISOString()}] ${line}\n`);
}

export function newIds(): { jobId: string; projectId: string } {
  const projectId = `p_${nanoid(10)}`;
  return { projectId, jobId: `j_${nanoid(10)}` };
}

export function setStage(m: ProjectManifest, stage: Stage): void {
  m.stage = stage;
  writeManifest(m);
}
