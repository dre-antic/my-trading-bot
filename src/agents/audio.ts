import fs from "node:fs";
import path from "node:path";
import { synthesize } from "../providers/tts/index.js";
import { alignScript, toSrt, toVtt } from "../providers/transcription/index.js";
import { ensureBundledMusic, pickMusic } from "../providers/music/index.js";
import { projectDir } from "../projects/store.js";
import type { CaptionCue, ProjectManifest, VoiceTrack } from "../types/index.js";

export async function runVoice(m: ProjectManifest): Promise<VoiceTrack[]> {
  const dir = path.join(projectDir(m.projectId), "audio");
  fs.mkdirSync(dir, { recursive: true });
  const tracks: VoiceTrack[] = [];
  for (const scene of m.scenes ?? []) {
    const out = path.join(dir, `${scene.id}.wav`);
    const tts = await synthesize(scene.narration, out, m.request.voice, 1);
    scene.estimatedDurationSec = tts.durationSec;
    tracks.push({ sceneId: scene.id, path: tts.path, durationSec: tts.durationSec, voice: tts.voice, provider: tts.provider });
  }
  m.voices = tracks;
  fs.writeFileSync(path.join(dir, "voices.json"), JSON.stringify(tracks, null, 2));
  return tracks;
}

export async function runMusic(m: ProjectManifest): Promise<void> {
  const tracks = await ensureBundledMusic();
  const chosen = pickMusic(tracks, m.request.musicStyle || m.scenes?.[0]?.musicMood || "documentary");
  const dest = path.join(projectDir(m.projectId), "music", path.basename(chosen.path));
  fs.copyFileSync(chosen.path, dest);
  m.musicPath = dest;
  m.musicMeta = {
    title: chosen.title,
    creator: chosen.creator,
    license: chosen.license,
    attribution: chosen.attribution,
    mood: chosen.mood,
    bpm: chosen.bpm,
  };
  fs.writeFileSync(path.join(projectDir(m.projectId), "music", "meta.json"), JSON.stringify(m.musicMeta, null, 2));
}

export async function runCaptions(m: ProjectManifest): Promise<CaptionCue[]> {
  const cues: CaptionCue[] = [];
  let offset = 0;
  for (const scene of m.scenes ?? []) {
    const voice = m.voices?.find((v) => v.sceneId === scene.id);
    const dur = voice?.durationSec ?? scene.estimatedDurationSec;
    const local = alignScript(scene.narration, dur);
    for (const c of local) {
      cues.push({
        ...c,
        startSec: c.startSec + offset,
        endSec: c.endSec + offset,
        words: c.words.map((w) => ({ ...w, startSec: w.startSec + offset, endSec: w.endSec + offset })),
      });
    }
    offset += dur;
  }
  m.captions = cues;
  const dir = path.join(projectDir(m.projectId), "captions");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify(cues, null, 2));
  fs.writeFileSync(path.join(dir, "captions.srt"), toSrt(cues));
  fs.writeFileSync(path.join(dir, "captions.vtt"), toVtt(cues));
  return cues;
}
