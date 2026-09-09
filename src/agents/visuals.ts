import fs from "node:fs";
import path from "node:path";
import { gatherCandidates, proceduralStill, downloadTo, scoreHit } from "../providers/media/index.js";
import { projectDir } from "../projects/store.js";
import { dimensions } from "../providers/render/index.js";
import type { LicensedAsset, ProjectManifest, ScenePlan } from "../types/index.js";

export async function runVisuals(m: ProjectManifest): Promise<LicensedAsset[]> {
  const scenes = m.scenes ?? [];
  const dim = dimensions(m.request.aspectRatio, m.request.qualityLevel);
  const assets: LicensedAsset[] = [];
  const usedUrls = new Set<string>();
  const dir = path.join(projectDir(m.projectId), "assets");
  fs.mkdirSync(dir, { recursive: true });

  for (const scene of scenes) {
    let chosen: LicensedAsset | null = null;
    const candidates = await gatherCandidates(scene, m.request.aspectRatio);
    for (const hit of candidates.slice(0, 6)) {
      if (hit.url && usedUrls.has(hit.url)) continue;
      const relevance = scoreHit(hit, scene, m.request.aspectRatio);
      if (relevance < 40) continue;
      const ext = guessExt(hit.downloadUrl, hit.kind.includes("video") ? ".mp4" : ".jpg");
      const dest = path.join(dir, `${scene.id}${ext}`);
      try {
        await downloadTo(hit.downloadUrl, dest);
        usedUrls.add(hit.url);
        chosen = {
          id: `${scene.id}_asset`,
          sceneId: scene.id,
          kind: hit.kind,
          path: dest,
          sourceUrl: hit.url,
          title: hit.title,
          creator: hit.creator,
          license: hit.license,
          attribution: hit.attribution,
          width: hit.width,
          height: hit.height,
          durationSec: hit.durationSec,
          relevance,
        };
        break;
      } catch {
        continue;
      }
    }
    if (!chosen) {
      const dest = path.join(dir, `${scene.id}_graphic.jpg`);
      await proceduralStill({
        outPath: dest,
        title: scene.textOverlay || m.script?.title || m.request.topic,
        subtitle: scene.visualObjective.slice(0, 70),
        index: scene.index,
        width: dim.w,
        height: dim.h,
      });
      chosen = {
        id: `${scene.id}_asset`,
        sceneId: scene.id,
        kind: "graphic",
        path: dest,
        title: "Procedural motion graphic",
        creator: "Aether Studio",
        license: "Original generated graphic",
        attribution: "Generated in-engine (not third-party stock)",
        width: dim.w,
        height: dim.h,
        relevance: 55,
      };
    }
    assets.push(chosen);
  }
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(assets, null, 2));
  m.assets = assets;
  return assets;
}

function guessExt(url: string, fallback: string): string {
  try {
    const p = new URL(url).pathname.toLowerCase();
    const m = p.match(/\.(jpg|jpeg|png|webp|mp4|webm|mov)$/);
    return m ? `.${m[1].replace("jpeg", "jpg")}` : fallback;
  } catch {
    return fallback;
  }
}

export function copyrightReport(m: ProjectManifest): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  for (const a of m.assets ?? []) {
    notes.push(`${a.sceneId}: ${a.license} — ${a.attribution}`);
    const bad = /getty|shutterstock|unlicensed|all rights reserved/i.test(a.license + a.attribution);
    if (bad) notes.push(`FLAG ${a.sceneId}: license needs human review`);
  }
  return { ok: !notes.some((n) => n.startsWith("FLAG")), notes };
}
