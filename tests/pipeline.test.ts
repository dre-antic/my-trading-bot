import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { queueAndRun, getJob } from "../src/director/index.js";
import { proceduralStill } from "../src/providers/media/index.js";
import { synthesize } from "../src/providers/tts/index.js";
import { dimensions, renderSceneClip, concatClips } from "../src/providers/render/index.js";
import { config } from "../src/config/index.js";

async function waitFor(jobId: string, timeoutMs = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = getJob(jobId);
    if (j && ["complete", "failed", "awaiting_approval"].includes(j.status)) return j;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("timeout waiting for job");
}

describe("render pipeline", () => {
  const dir = path.join(config.dataDir, "tmp-render");
  fs.mkdirSync(dir, { recursive: true });

  it("renders a real mp4 from a still + tts without cloud APIs", async () => {
    const img = path.join(dir, "still.jpg");
    const wav = path.join(dir, "vo.wav");
    const clip = path.join(dir, "clip.mp4");
    const out = path.join(dir, "out.mp4");
    await proceduralStill({ outPath: img, title: "Test Card", subtitle: "Aether render test", index: 0, width: 640, height: 360 });
    expect(fs.existsSync(img)).toBe(true);
    const tts = await synthesize("This is a short test narration for Aether Studio.", wav, "Natural male");
    expect(tts.durationSec).toBeGreaterThan(0.5);
    const spec = { ...dimensions("16:9", "draft"), width: 640, height: 360, burnCaptions: false };
    await renderSceneClip({
      scene: {
        id: "sc_01",
        index: 0,
        narration: "This is a short test narration for Aether Studio.",
        estimatedDurationSec: tts.durationSec,
        visualObjective: "test",
        visualKeywords: ["test"],
        preferredMediaType: "graphic",
        transition: "cut",
        cameraMotion: "zoom_in",
        musicMood: "documentary",
        claimIds: [],
      },
      asset: {
        id: "a",
        sceneId: "sc_01",
        kind: "graphic",
        path: img,
        title: "t",
        creator: "t",
        license: "original",
        attribution: "t",
        relevance: 50,
      },
      voice: { sceneId: "sc_01", path: wav, durationSec: tts.durationSec, voice: tts.voice, provider: tts.provider },
      outPath: clip,
      spec,
    });
    await concatClips([clip], undefined, out, spec);
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.statSync(out).size).toBeGreaterThan(1000);
  });
});

describe("end-to-end demo job", () => {
  it("produces a preview mp4 with citations and qc scores", async () => {
    const m = queueAndRun({
      topic: "How Jamaican music influenced the world",
      format: "documentary",
      durationSec: 18,
      audience: "General YouTube audience",
      tone: "Cinematic documentary",
      language: "en",
      voice: "Natural male",
      visualStyle: "Archival cinematic",
      musicStyle: "documentary",
      qualityLevel: "draft",
      budgetUsd: 0,
      approvalMode: "full_automatic",
      aspectRatio: "16:9",
      demo: true,
    });
    const done = await waitFor(m.jobId);
    expect(done.status).not.toBe("failed");
    expect(done.manifest.research?.sources.length).toBeGreaterThan(0);
    expect(done.manifest.script?.finalNarration || done.manifest.script?.draft).toBeTruthy();
    expect(done.manifest.scenes?.length).toBeGreaterThan(0);
    expect(done.manifest.previewPath || done.manifest.renderPath).toBeTruthy();
    const video = done.manifest.renderPath || done.manifest.previewPath!;
    expect(fs.existsSync(video)).toBe(true);
    expect(fs.statSync(video).size).toBeGreaterThan(2000);
    expect(done.manifest.qc?.overall).toBeGreaterThan(50);
    expect(done.manifest.youtube?.titles?.length).toBeGreaterThan(0);
  });
});
