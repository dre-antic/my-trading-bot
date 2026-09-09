import fs from "node:fs";
import path from "node:path";
import { completeLlm, parseJsonFromLlm } from "../providers/llm/index.js";
import { estimateSpeechSec } from "../providers/tts/index.js";
import { projectDir } from "../projects/store.js";
import type { ProjectManifest, ScenePlan, ScriptPackage } from "../types/index.js";

const TEMPLATES: Record<string, string> = {
  documentary: "Cinematic documentary: strong hook, historical chain, named people and dates only if sourced, quiet close.",
  youtube_long: "YouTube long-form: pattern interrupt hook in 8s, chaptered body, pattern of tension and payoff, CTA-free close.",
  youtube_shorts: "Vertical short: one idea, one twist, on-screen text friendly, under 60s spoken.",
  tiktok: "TikTok explainer: first line is the title, fast cuts implied, no slow preamble.",
  instagram_reels: "Reels: visual-first, punchy lines, looping-friendly last sentence.",
  educational: "Educational: learning objective, definitions, examples, recap.",
  storytelling: "Story: protagonist or culture as character, obstacle, transformation.",
  news_explainer: "News explainer: lede, context, stakes, what is known vs unknown.",
  list: "List format: numbered beats, each self-contained.",
  historical: "Historical: chronology first, causation second, historiography caution.",
  faceless: "Faceless channel: B-roll friendly narration, no host references, concrete visual nouns.",
};

export async function runScript(m: ProjectManifest): Promise<ScriptPackage> {
  const targetWords = Math.round((m.request.durationSec / 60) * 150);
  const sources = m.research?.sources ?? [];
  const claims = (m.research?.claims ?? []).filter((c) => c.certainty !== "UNCERTAIN");
  const sys = `You are the Script Agent for Aether Studio. ${TEMPLATES[m.request.format] ?? TEMPLATES.documentary}
Audience: ${m.request.audience}. Tone: ${m.request.tone}. Language: ${m.request.language}.
Write only from provided sources. Unsourced specifics must not appear. Target about ${targetWords} words.
Return JSON with title, concept, hook, outline (array of {act,beats}), draft, finalNarration, scenes (array of {heading,narration,visualObjective}), wordCount.`;
  const llm = await completeLlm(
    [
      { role: "system", content: sys },
      {
        role: "user",
        content: `Topic: "${m.request.topic}"\nSOURCES\n${sources
          .map((s) => `- id:${s.id} title:${s.title} excerpt:${s.excerpt.slice(0, 500)}`)
          .join("\n")}\nSUPPORTED CLAIMS\n${claims.map((c) => c.text).join("\n")}`,
      },
    ],
    { json: true, jobId: m.jobId, maxTokens: 3000 },
  );
  let script: ScriptPackage;
  try {
    script = parseJsonFromLlm<ScriptPackage>(llm.text);
  } catch {
    script = parseJsonFromLlm<ScriptPackage>(
      (await completeLlm([{ role: "user", content: `Topic: "${m.request.topic}"\nSOURCES\n${sources.map((s) => s.excerpt).join("\n")}` }], { jobId: m.jobId })).text,
    );
  }
  script.wordCount = (script.finalNarration || script.draft || "").split(/\s+/).length;
  const dir = path.join(projectDir(m.projectId), "script");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "concept.txt"), script.concept ?? "");
  fs.writeFileSync(path.join(dir, "outline.json"), JSON.stringify(script.outline ?? [], null, 2));
  fs.writeFileSync(path.join(dir, "draft.txt"), script.draft ?? "");
  fs.writeFileSync(path.join(dir, "final.txt"), script.finalNarration ?? script.draft ?? "");
  fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(script, null, 2));
  m.script = script;
  return script;
}

export function planScenes(m: ProjectManifest): ScenePlan[] {
  const script = m.script!;
  const hints = script.scenes?.length
    ? script.scenes
    : splitNarration(script.finalNarration || script.draft, Math.max(3, Math.min(8, Math.round(m.request.durationSec / 8))));
  const transitions: ScenePlan["transition"][] = ["fade_black", "crossfade", "cut", "crossfade", "fade_black"];
  const motions: ScenePlan["cameraMotion"][] = ["zoom_in", "pan_left", "zoom_out", "pan_right", "static"];
  let scenes: ScenePlan[] = hints.map((h, i) => {
    const narration = h.narration.trim();
    return {
      id: `sc_${String(i + 1).padStart(2, "0")}`,
      index: i,
      narration,
      estimatedDurationSec: estimateSpeechSec(narration, 150),
      visualObjective: h.visualObjective || "Topic-relevant imagery",
      visualKeywords: keywords(m.request.topic, narration, h.visualObjective),
      preferredMediaType: i % 2 === 0 ? "stock_video" : "stock_image",
      transition: transitions[i % transitions.length],
      cameraMotion: motions[i % motions.length],
      textOverlay: i === 0 ? (script.title || m.request.topic).slice(0, 42) : undefined,
      musicMood: m.request.musicStyle || "documentary",
      claimIds: m.research?.claims.slice(i * 2, i * 2 + 2).map((c) => c.id) ?? [],
    };
  });
  const target = m.request.durationSec;
  while (scenes.length > 2) {
    const total = scenes.reduce((a, s) => a + s.estimatedDurationSec, 0);
    if (total <= target * 1.35) break;
    scenes.pop();
  }
  scenes = scenes.map((s, i) => ({ ...s, id: `sc_${String(i + 1).padStart(2, "0")}`, index: i }));
  const dir = path.join(projectDir(m.projectId), "storyboard");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scenes.json"), JSON.stringify(scenes, null, 2));
  m.scenes = scenes;
  return scenes;
}

function splitNarration(text: string, n: number): { heading: string; narration: string; visualObjective: string }[] {
  const sentences = (text || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  if (!sentences.length) return [];
  const size = Math.ceil(sentences.length / n);
  const out = [];
  for (let i = 0; i < sentences.length; i += size) {
    const chunk = sentences.slice(i, i + size).join(" ");
    out.push({ heading: `Scene ${out.length + 1}`, narration: chunk, visualObjective: "Supporting visual" });
  }
  return out;
}

function keywords(topic: string, narration: string, visual: string): string[] {
  const stop = new Set(["the", "and", "that", "this", "with", "from", "were", "was", "for", "are", "not", "but"]);
  const words = `${topic} ${visual} ${narration}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  return [...new Set(words)].slice(0, 8);
}
