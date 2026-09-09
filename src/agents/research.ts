import fs from "node:fs";
import path from "node:path";
import { completeLlm, parseJsonFromLlm } from "../providers/llm/index.js";
import { searchTopic } from "../providers/search/index.js";
import { projectDir } from "../projects/store.js";
import type { Claim, ProjectManifest, ResearchPackage, SourceRecord } from "../types/index.js";

function researchQuestions(topic: string, format: string): string[] {
  return [
    `What is ${topic}?`,
    `When and where did ${topic} originate?`,
    `Who are the key people associated with ${topic}?`,
    `How did ${topic} spread or influence other regions?`,
    `What claims about ${topic} are well documented?`,
    `${topic} ${format} primary sources`,
  ];
}

export async function runResearch(m: ProjectManifest): Promise<ResearchPackage> {
  const questions = researchQuestions(m.request.topic, m.request.format);
  const sources = await searchTopic(m.request.topic, questions);
  const pkg: ResearchPackage = {
    topic: m.request.topic,
    questions,
    sources,
    claims: extractClaims(sources),
    conflicts: [],
    summary: sources
      .slice(0, 3)
      .map((s) => s.excerpt)
      .join(" ")
      .slice(0, 1200),
  };
  const dir = path.join(projectDir(m.projectId), "research");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(projectDir(m.projectId), "sources", "sources.json"), JSON.stringify(sources, null, 2));
  m.research = pkg;
  return pkg;
}

function extractClaims(sources: SourceRecord[]): Claim[] {
  const claims: Claim[] = [];
  for (const s of sources) {
    const sentences = s.excerpt.split(/(?<=[.!?])\s+/).filter((x) => x.length > 50);
    for (const text of sentences.slice(0, 3)) {
      const hasNumber = /\d/.test(text);
      const certainty = s.tier === 1 ? (hasNumber ? "SUPPORTED" : "KNOWN") : s.tier === 2 ? "SUPPORTED" : "INFERRED";
      claims.push({
        id: `cl_${claims.length + 1}`,
        text: text.trim(),
        certainty,
        sourceIds: [s.id],
      });
    }
  }
  return claims.slice(0, 24);
}

export async function runFactCheck(m: ProjectManifest): Promise<void> {
  if (!m.research) return;
  const llm = await completeLlm(
    [
      {
        role: "system",
        content:
          "You are a strict fact checker. Return JSON {claims:[{id,text,certainty,sourceIds,notes}], conflicts:[{claimA,claimB,note}]}. Certainty must be KNOWN, SUPPORTED, INFERRED, or UNCERTAIN. Never upgrade a claim without a source. Do not invent sources.",
      },
      {
        role: "user",
        content: `Topic: ${m.request.topic}\nSOURCES\n${m.research.sources
          .map((s) => `- id:${s.id} title:${s.title} excerpt:${s.excerpt.slice(0, 400)}`)
          .join("\n")}\nEXISTING CLAIMS\n${JSON.stringify(m.research.claims.slice(0, 20))}`,
      },
    ],
    { json: true, jobId: m.jobId },
  );
  try {
    const parsed = parseJsonFromLlm<{ claims?: Claim[]; conflicts?: ResearchPackage["conflicts"] }>(llm.text);
    if (parsed.claims?.length) {
      m.research.claims = parsed.claims.map((c) => ({
        ...c,
        certainty: (["KNOWN", "SUPPORTED", "INFERRED", "UNCERTAIN"] as const).includes(c.certainty) ? c.certainty : "UNCERTAIN",
      }));
    }
    m.research.conflicts = parsed.conflicts ?? [];
  } catch {
    m.warnings.push("Fact checker returned unstructured output; kept extractive claims.");
  }
  for (const c of m.research.claims) {
    if (c.certainty === "UNCERTAIN") m.warnings.push(`Uncertain claim flagged: ${c.text.slice(0, 80)}`);
  }
  fs.writeFileSync(path.join(projectDir(m.projectId), "research", "factcheck.json"), JSON.stringify(m.research, null, 2));
}
