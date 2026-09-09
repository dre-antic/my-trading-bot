import fs from "node:fs";
import path from "node:path";
import { concatClips, detectBlackFrames, dimensions, makeThumbnail, renderSceneClip, remotionAdapter } from "../providers/render/index.js";
import { probeDuration } from "../providers/tts/index.js";
import { completeLlm, parseJsonFromLlm } from "../providers/llm/index.js";
import { projectDir } from "../projects/store.js";
import { copyrightReport } from "./visuals.js";
import type { ProjectManifest, QcIssue, QcScores, YoutubePackage } from "../types/index.js";

export async function runAssembly(m: ProjectManifest): Promise<string> {
  const dim = dimensions(m.request.aspectRatio, m.request.qualityLevel);
  const spec = { width: dim.w, height: dim.h, fps: dim.fps, preset: dim.preset, burnCaptions: false };
  const clips: string[] = [];
  const renderDir = path.join(projectDir(m.projectId), "renders", "scenes");
  fs.mkdirSync(renderDir, { recursive: true });
  for (const scene of m.scenes ?? []) {
    const asset = m.assets?.find((a) => a.sceneId === scene.id);
    const voice = m.voices?.find((v) => v.sceneId === scene.id);
    if (!asset || !voice) throw new Error(`Missing asset/voice for ${scene.id}`);
    const out = path.join(renderDir, `${scene.id}.mp4`);
    await renderSceneClip({ scene, asset, voice, outPath: out, spec });
    clips.push(out);
  }
  const preview = path.join(projectDir(m.projectId), "renders", "preview.mp4");
  const srt = path.join(projectDir(m.projectId), "captions", "captions.srt");
  await concatClips(clips, m.musicPath, preview, spec, fs.existsSync(srt) ? srt : undefined);
  m.previewPath = preview;
  return preview;
}

export async function runRender(m: ProjectManifest, burnCaptions: boolean): Promise<string> {
  const dim = dimensions(m.request.aspectRatio, m.request.qualityLevel);
  const spec = { width: dim.w, height: dim.h, fps: dim.fps, preset: dim.preset, burnCaptions };
  const src = m.previewPath;
  if (!src) throw new Error("No preview to finalize");
  const finalPath = path.join(projectDir(m.projectId), "renders", "final.mp4");
  if (!burnCaptions) {
    fs.copyFileSync(src, finalPath);
  } else {
    const srt = path.join(projectDir(m.projectId), "captions", "captions.srt");
    await concatClips([src], undefined, finalPath, spec, srt);
  }
  m.renderPath = finalPath;
  return finalPath;
}

export async function runQc(m: ProjectManifest): Promise<QcScores> {
  const video = m.previewPath || m.renderPath;
  const issues: QcIssue[] = [];
  let audio = 90;
  let visual = 85;
  let pacing = 85;
  let captions = 90;
  let factual = 80;

  if (!video || !fs.existsSync(video)) {
    issues.push({ code: "missing_render", severity: "error", message: "No rendered file", autoFixable: false });
    visual = 0;
  } else {
    const dur = await probeDuration(video);
    const expected = (m.voices ?? []).reduce((a, v) => a + v.durationSec, 0);
    if (dur < 1) {
      issues.push({ code: "too_short", severity: "error", message: "Render duration under 1s", autoFixable: false });
      pacing = 20;
    }
    if (expected > 2 && Math.abs(dur - expected) / expected > 0.45) {
      issues.push({ code: "duration_mismatch", severity: "warn", message: `Duration ${dur.toFixed(1)}s vs narration ${expected.toFixed(1)}s`, autoFixable: true });
      pacing -= 8;
    }
    const blacks = await detectBlackFrames(video);
    if (blacks > 4) {
      issues.push({ code: "black_frames", severity: "warn", message: `Black-detect hits: ${blacks}`, autoFixable: true });
      visual -= 10;
    }
  }

  const missingAssets = (m.scenes ?? []).filter((s) => !m.assets?.some((a) => a.sceneId === s.id));
  if (missingAssets.length) {
    issues.push({ code: "missing_assets", severity: "error", message: `Scenes without assets: ${missingAssets.map((s) => s.id).join(",")}`, autoFixable: true });
    visual -= 20;
  }
  const graphics = (m.assets ?? []).filter((a) => a.kind === "graphic").length;
  if (graphics === (m.assets?.length ?? 0) && (m.assets?.length ?? 0) > 2) {
    issues.push({ code: "all_procedural", severity: "info", message: "All visuals are procedural graphics (no stock). Fine for $0 mode.", autoFixable: false });
    visual -= 6;
  }
  if (!(m.captions?.length)) {
    issues.push({ code: "no_captions", severity: "warn", message: "No captions generated", autoFixable: true });
    captions = 40;
  }
  const uncertain = m.research?.claims.filter((c) => c.certainty === "UNCERTAIN").length ?? 0;
  factual = Math.max(50, 96 - uncertain * 6);
  if (uncertain) issues.push({ code: "uncertain_claims", severity: "info", message: `${uncertain} uncertain claims remain flagged`, autoFixable: false });

  const cr = copyrightReport(m);
  if (!cr.ok) issues.push({ code: "license", severity: "error", message: "License flag — do not publish", autoFixable: false });

  const overall = Math.round((factual + audio + visual + pacing + captions) / 5);
  const qc: QcScores = { factual, audio, visual, pacing, captions, overall, issues };
  m.qc = qc;
  fs.writeFileSync(path.join(projectDir(m.projectId), "metadata", "qc.json"), JSON.stringify(qc, null, 2));
  return qc;
}

export async function runReviewer(m: ProjectManifest): Promise<{ verdict: string; score: number; changes: string[] }> {
  const llm = await completeLlm(
    [
      {
        role: "system",
        content:
          "You are a strict professional YouTube producer. Ask: would a real viewer keep watching? Is the opening strong? Does every scene contribute? Are visuals relevant? Is narration natural? Are facts supported? Captions readable? Does it feel cheap? Return JSON {keepWatching, openingStrong, everySceneContributes, visualsRelevant, narrationNatural, factsSupported, captionsReadable, feelsCheap, changes:string[], score:number, verdict:'approve'|'revise'|'reject'}",
      },
      {
        role: "user",
        content: JSON.stringify({
          topic: m.request.topic,
          hook: m.script?.hook,
          scenes: m.scenes?.map((s) => ({ id: s.id, narration: s.narration, visual: s.visualObjective })),
          qc: m.qc,
          warnings: m.warnings,
          sources: m.research?.sources.map((s) => s.title),
        }),
      },
    ],
    { json: true, jobId: m.jobId },
  );
  try {
    return parseJsonFromLlm(llm.text);
  } catch {
    return { verdict: (m.qc?.overall ?? 0) >= 80 ? "approve" : "revise", score: m.qc?.overall ?? 70, changes: [] };
  }
}

export async function runPackaging(m: ProjectManifest): Promise<YoutubePackage> {
  const llm = await completeLlm(
    [
      { role: "system", content: "Create a YouTube package. JSON: {titles:string[], description:string, tags:string[], thumbnailConcepts:string[], socialDescription:string, shortFormSuggestions:string[]}. Do not invent fake view counts." },
      {
        role: "user",
        content: `Topic: ${m.request.topic}\nTitle: ${m.script?.title}\nHook: ${m.script?.hook}\nSources: ${(m.research?.sources ?? []).map((s) => s.title + " " + s.url).join("; ")}`,
      },
    ],
    { json: true, jobId: m.jobId },
  );
  let pkg: YoutubePackage;
  try {
    pkg = parseJsonFromLlm(llm.text);
  } catch {
    pkg = {
      titles: [m.script?.title || m.request.topic],
      description: m.script?.concept ?? m.request.topic,
      tags: m.request.topic.toLowerCase().split(/\s+/),
      chapters: [],
      thumbnailConcepts: ["High contrast title card"],
      socialDescription: m.request.topic,
      shortFormSuggestions: ["Cut the hook + one proof point"],
    };
  }
  let t = 0;
  pkg.chapters = (m.scenes ?? []).map((s) => {
    const start = t;
    t += s.estimatedDurationSec;
    const mm = Math.floor(start / 60);
    const ss = Math.floor(start % 60);
    return { time: `${mm}:${String(ss).padStart(2, "0")}`, title: s.id };
  });
  const dim = dimensions(m.request.aspectRatio, m.request.qualityLevel);
  const thumb = path.join(projectDir(m.projectId), "thumbnail", "thumb.jpg");
  if (m.previewPath && fs.existsSync(m.previewPath)) {
    await makeThumbnail(m.previewPath, pkg.titles?.[0] || m.request.topic, thumb, { width: dim.w, height: dim.h, fps: dim.fps, preset: dim.preset, burnCaptions: false });
    pkg.thumbnailPath = thumb;
  }
  m.youtube = pkg;
  fs.writeFileSync(path.join(projectDir(m.projectId), "metadata", "youtube.json"), JSON.stringify(pkg, null, 2));
  return pkg;
}

export function rendererNote(): string {
  return remotionAdapter.reason;
}
