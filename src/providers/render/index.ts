import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../../config/index.js";
import type { LicensedAsset, ScenePlan, VoiceTrack } from "../../types/index.js";

export interface RenderSpec {
  width: number;
  height: number;
  fps: number;
  preset: string;
  burnCaptions: boolean;
  srtPath?: string;
}

function run(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${code}: ${err.slice(-1200)}`));
    });
  });
}

export function dimensions(aspect: "16:9" | "9:16" | "1:1", quality: "draft" | "standard" | "high"): { w: number; h: number; fps: number; preset: string } {
  const base = quality === "draft" ? 720 : quality === "high" ? 1080 : config.videoHeight;
  if (aspect === "9:16") return { w: Math.round((base * 9) / 16) % 2 === 0 ? Math.round((base * 9) / 16) : Math.round((base * 9) / 16) + 1, h: base === 720 ? 1280 : 1920, fps: quality === "draft" ? 24 : config.fps, preset: quality === "high" ? "medium" : "veryfast" };
  if (aspect === "1:1") return { w: base, h: base, fps: 24, preset: "veryfast" };
  const h = quality === "high" ? 1080 : quality === "draft" ? 720 : config.videoHeight;
  const w = h === 1080 ? 1920 : 1280;
  return { w, h, fps: quality === "high" ? 30 : 24, preset: quality === "high" ? "medium" : config.ffmpegPreset };
}

function escText(s: string): string {
  return s.replace(/\\/g, "/").replace(/'/g, "’").replace(/:/g, " —").replace(/%/g, "pct").slice(0, 90);
}

export async function renderSceneClip(opts: {
  scene: ScenePlan;
  asset: LicensedAsset;
  voice: VoiceTrack;
  outPath: string;
  spec: RenderSpec;
}): Promise<void> {
  const { scene, asset, voice, outPath, spec } = opts;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const dur = Math.max(voice.durationSec + 0.25, scene.estimatedDurationSec);
  const overlay = scene.textOverlay ? escText(scene.textOverlay) : "";
  const isImage = !/\.(mp4|mov|webm|mkv)$/i.test(asset.path);
  const z = scene.cameraMotion === "zoom_out" ? "if(eq(on,1),1.3,max(1.0,1.3-0.0009*on))" : "min(zoom+0.0008,1.28)";
  const vfCore = isImage
    ? `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=increase,crop=${spec.width}:${spec.height},zoompan=z='${z}':d=${Math.ceil(dur * spec.fps)}:s=${spec.width}x${spec.height}:fps=${spec.fps}`
    : `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=increase,crop=${spec.width}:${spec.height},fps=${spec.fps}`;
  const overlayVf = overlay
    ? `,drawtext=fontfile=${config.fontFile}:text='${overlay}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-140:shadowcolor=black:shadowx=2:shadowy=2`
    : "";
  const fade = `,fade=t=in:st=0:d=0.3,fade=t=out:st=${Math.max(0.4, dur - 0.35)}:d=0.3`;
  const args = isImage
    ? ["-y", "-loop", "1", "-i", asset.path, "-i", voice.path, "-t", dur.toFixed(3), "-vf", vfCore + overlayVf + fade, "-c:v", "libx264", "-preset", spec.preset, "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", outPath]
    : ["-y", "-stream_loop", "-1", "-i", asset.path, "-i", voice.path, "-t", dur.toFixed(3), "-vf", vfCore + overlayVf + fade, "-c:v", "libx264", "-preset", spec.preset, "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", outPath];
  await run(args);
}

export async function concatClips(clips: string[], musicPath: string | undefined, outPath: string, spec: RenderSpec, srtPath?: string): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const listFile = outPath + ".txt";
  fs.writeFileSync(listFile, clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n"));
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", listFile];
  if (musicPath) args.push("-stream_loop", "-1", "-i", musicPath);
  if (srtPath && spec.burnCaptions) {
    const escaped = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    args.push("-vf", `subtitles='${escaped}':force_style='FontName=DejaVu Sans,FontSize=18,Outline=1,Shadow=0,MarginV=40'`);
  }
  if (musicPath) {
    args.push(
      "-filter_complex",
      "[0:a]aformat=sample_fmts=fltp:channel_layouts=stereo[va];[1:a]volume=0.14,aformat=sample_fmts=fltp:channel_layouts=stereo[mus];[va][mus]amix=inputs=2:duration=first:dropout_transition=2[aout]",
      "-map",
      "0:v",
      "-map",
      "[aout]",
    );
  }
  args.push("-c:v", "libx264", "-preset", spec.preset, "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart", outPath);
  await run(args);
  try {
    fs.unlinkSync(listFile);
  } catch {
    /* ignore */
  }
}

export async function makeThumbnail(videoPath: string, title: string, outPath: string, spec: RenderSpec): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const still = outPath.replace(/\.jpg$/, ".still.jpg");
  await run(["-y", "-ss", "1.2", "-i", videoPath, "-frames:v", "1", still]);
  await run([
    "-y",
    "-i",
    still,
    "-vf",
    `scale=${spec.width}:${spec.height},drawbox=y=ih*0.62:h=ih*0.38:color=black@0.55:t=fill,drawtext=fontfile=${config.fontFile}:text='${escText(title)}':fontcolor=white:fontsize=42:x=60:y=h-160:line_spacing=12`,
    "-q:v",
    "3",
    outPath,
  ]);
}

export async function detectBlackFrames(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-i", videoPath, "-vf", "blackdetect=d=0.2:pic_th=0.98", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", () => {
      const hits = err.match(/blackdetect/g)?.length ?? 0;
      resolve(hits);
    });
  });
}

export const remotionAdapter = {
  id: "remotion",
  available: false,
  reason:
    "Remotion is licensed free for individuals and companies of up to 3 people. Automated pipelines at larger companies need Remotion for Automators. Chromium-based rendering is also too heavy for 8GB Intel Macs. Aether therefore uses FFmpeg as the default RenderingProvider. Enable Remotion later via RENDER_PROVIDER=remotion after reviewing LICENSE.md at remotion.dev.",
};
