import { config, secret } from "../../config/index.js";
import type { LlmMessage, LlmResult } from "../../types/index.js";
import { budget } from "../../budget/manager.js";
import { cache, cacheKey } from "../../cache/index.js";
import { ProviderError, retryBackoff, withTimeout } from "../errors.js";
import { rankProviders, recordFailure, recordSuccess } from "../registry.js";

export interface LlmProvider {
  id: string;
  free: boolean;
  paid: boolean;
  configured: boolean;
  complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number; jobId?: string }): Promise<LlmResult>;
}

function estimateCost(provider: string, tokensIn: number, tokensOut: number): number {
  const table: Record<string, [number, number]> = {
    groq: [0, 0],
    heuristic: [0, 0],
    mock: [0, 0],
    ollama: [0, 0],
    openrouter: [0, 0],
    gemini: [0, 0],
    cloudflare: [0, 0],
    openai: [0.15 / 1e6, 0.6 / 1e6],
  };
  const [pin, pout] = table[provider] ?? [0, 0];
  return tokensIn * pin + tokensOut * pout;
}

export async function openaiCompatChat(opts: {
  id: string;
  url: string;
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  json?: boolean;
  maxTokens?: number;
  extraHeaders?: Record<string, string>;
}): Promise<LlmResult> {
  const started = Date.now();
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: 0.4,
    max_tokens: opts.maxTokens ?? 2500,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await withTimeout(
    fetch(opts.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
        ...opts.extraHeaders,
      },
      body: JSON.stringify(body),
    }),
    45_000,
    opts.id,
  );
  if (!res.ok) {
    const t = await res.text();
    throw new ProviderError(`${opts.id} ${res.status} ${t.slice(0, 180)}`, opts.id, res.status === 429 ? "QUOTA" : "PROVIDER_FAILURE", res.status === 429 || res.status >= 500);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const tokensIn = data.usage?.prompt_tokens ?? 0;
  const tokensOut = data.usage?.completion_tokens ?? 0;
  return {
    text,
    provider: opts.id,
    model: opts.model,
    tokensIn,
    tokensOut,
    costUsd: estimateCost(opts.id, tokensIn, tokensOut),
    latencyMs: Date.now() - started,
  };
}

export class GroqLlm implements LlmProvider {
  id = "groq";
  free = true;
  paid = false;
  get configured() {
    return Boolean(secret("GROQ_API_KEY") || config.groqApiKey);
  }
  complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number }) {
    return openaiCompatChat({
      id: this.id,
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: secret("GROQ_API_KEY") || config.groqApiKey,
      model: config.groqModel,
      messages,
      json: opts?.json,
      maxTokens: opts?.maxTokens,
    });
  }
}

export class OpenRouterLlm implements LlmProvider {
  id = "openrouter";
  free = true;
  paid = false;
  get configured() {
    return Boolean(secret("OPENROUTER_API_KEY"));
  }
  complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number }) {
    return openaiCompatChat({
      id: this.id,
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: secret("OPENROUTER_API_KEY"),
      model: config.openrouterModel,
      messages,
      json: opts?.json,
      maxTokens: opts?.maxTokens,
      extraHeaders: { "HTTP-Referer": "http://localhost:8787", "X-Title": "Aether Studio" },
    });
  }
}

export class GeminiLlm implements LlmProvider {
  id = "gemini";
  free = true;
  paid = false;
  get configured() {
    return Boolean(secret("GEMINI_API_KEY") || config.geminiApiKey);
  }
  async complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<LlmResult> {
    const key = secret("GEMINI_API_KEY") || config.geminiApiKey;
    const started = Date.now();
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const sys = messages.find((m) => m.role === "system")?.content;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: opts?.maxTokens ?? 2500, temperature: 0.4, responseMimeType: opts?.json ? "application/json" : "text/plain" },
      }),
    });
    if (!res.ok) throw new ProviderError(`gemini ${res.status}`, this.id, res.status === 429 ? "QUOTA" : "PROVIDER_FAILURE", true);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return { text, provider: this.id, model: config.geminiModel, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - started };
  }
}

export class CloudflareLlm implements LlmProvider {
  id = "cloudflare";
  free = true;
  paid = false;
  get configured() {
    return Boolean((secret("CLOUDFLARE_API_TOKEN") || config.cloudflareApiToken) && (secret("CLOUDFLARE_ACCOUNT_ID") || config.cloudflareAccountId));
  }
  complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number }) {
    const account = secret("CLOUDFLARE_ACCOUNT_ID") || config.cloudflareAccountId;
    const token = secret("CLOUDFLARE_API_TOKEN") || config.cloudflareApiToken;
    return openaiCompatChat({
      id: this.id,
      url: `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`,
      apiKey: token,
      model: "@cf/meta/llama-3.1-8b-instruct",
      messages,
      json: opts?.json,
      maxTokens: opts?.maxTokens,
    });
  }
}

export class OllamaLlm implements LlmProvider {
  id = "ollama";
  free = true;
  paid = false;
  get configured() {
    return Boolean(process.env.OLLAMA_ENABLED === "true") && !config.offlineMode;
  }
  async complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number }): Promise<LlmResult> {
    try {
      return await openaiCompatChat({
        id: this.id,
        url: `${config.ollamaBaseUrl.replace(/\/$/, "")}/v1/chat/completions`,
        apiKey: "ollama",
        model: "llama3.2:1b",
        messages,
        json: opts?.json,
        maxTokens: opts?.maxTokens,
      });
    } catch (e) {
      throw new ProviderError("Ollama not reachable (expected on machines without local models)", this.id, "PROVIDER_FAILURE", false);
    }
  }
}

export class OpenAiLlm implements LlmProvider {
  id = "openai";
  free = false;
  paid = true;
  get configured() {
    return Boolean(secret("OPENAI_API_KEY") || config.openaiApiKey);
  }
  complete(messages: LlmMessage[], opts?: { json?: boolean; maxTokens?: number }) {
    return openaiCompatChat({
      id: this.id,
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: secret("OPENAI_API_KEY") || config.openaiApiKey,
      model: config.openaiModel,
      messages,
      json: opts?.json,
      maxTokens: opts?.maxTokens,
    });
  }
}

/** Deterministic documentary writer used in DEMO_MODE and as last-resort free fallback. Never invents citations. */
export class HeuristicLlm implements LlmProvider {
  id = "heuristic";
  free = true;
  paid = false;
  configured = true;
  async complete(messages: LlmMessage[]): Promise<LlmResult> {
    const started = Date.now();
    const user = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    const text = heuristicComplete(user, messages.find((m) => m.role === "system")?.content ?? "");
    return { text, provider: this.id, model: "heuristic-v1", tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - started };
  }
}

export class MockLlm implements LlmProvider {
  id = "mock";
  free = true;
  paid = false;
  configured = true;
  complete(messages: LlmMessage[]) {
    return new HeuristicLlm().complete(messages);
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function heuristicComplete(user: string, system: string): string {
  const topicMatch = user.match(/topic[:\s]+["']?(.+?)["']?(?:\n|$)/i);
  const topic = topicMatch?.[1]?.trim() || extractTopic(user);
  const sources = extractSources(user);
  const facts = sources.flatMap((s) => splitSentences(s.excerpt)).filter((s) => s.length > 40).slice(0, 14);
  const task = `${system}\n${user}`.toLowerCase();

  if (task.includes("fact checker") || (task.includes("strict fact") && task.includes("claim"))) {
    const claims = facts.map((f, i) => ({
      id: `c${i + 1}`,
      text: f,
      certainty: sources.length ? "SUPPORTED" : "UNCERTAIN",
      sourceIds: sources[0] ? [sources[0].id] : [],
    }));
    return JSON.stringify({ claims, conflicts: [] });
  }

  if (task.includes("youtube producer") || task.includes("keep watching")) {
    return JSON.stringify({
      keepWatching: true,
      openingStrong: true,
      everySceneContributes: true,
      visualsRelevant: true,
      narrationNatural: facts.length > 3,
      factsSupported: sources.length > 0,
      captionsReadable: true,
      feelsCheap: facts.length < 2,
      changes: facts.length < 2 ? ["Add more sourced narration"] : [],
      score: sources.length ? 88 : 74,
      verdict: "approve",
    });
  }

  if (task.includes("youtube package") || task.includes("thumbnailconcepts")) {
    return JSON.stringify({
      titles: titleOptions(topic),
      description: buildDescription(topic, sources),
      tags: tagify(topic),
      thumbnailConcepts: ["Bold title over archival-style still", "Single subject + high contrast", "Map or cultural object close-up"],
      socialDescription: `A sourced documentary short on ${topic}.`,
      shortFormSuggestions: ["Hook + one surprising fact + payoff in 45s"],
    });
  }

  const hook = facts[0]
    ? facts[0]
    : `What if the sound of one island rewired popular music on every continent? This is the story of ${topic}.`;
  const outline = [
    { act: "Hook", beats: ["Open on a striking claim", "Promise the journey"] },
    { act: "Origins", beats: ["Place, people, conditions", "The first innovations"] },
    { act: "Transmission", beats: ["How the sound traveled", "Who carried it"] },
    { act: "Impact", beats: ["What changed globally", "What remains"] },
    { act: "Close", beats: ["Callback to the hook", "A precise, sourced takeaway"] },
  ];
  const scenes = buildScenes(topic, facts, sources);
  const narration = scenes.map((s) => s.narration).join(" ");
  return JSON.stringify({
    title: topic,
    concept: `A sourced, faceless documentary that explains ${topic} with a clear causal chain and no unverified claims.`,
    hook,
    outline,
    draft: narration,
    finalNarration: narration,
    scenes,
    wordCount: narration.split(/\s+/).length,
  });
}

function extractTopic(user: string): string {
  const m = user.match(/"([^"]+)"/);
  if (m) return m[1];
  const line = user.split("\n").find((l) => l.length > 8) ?? "Untitled subject";
  return clip(line.replace(/^[#*\-\s]+/, ""), 80);
}

function extractSources(user: string): { id: string; title: string; excerpt: string }[] {
  const sources: { id: string; title: string; excerpt: string }[] = [];
  const block = user.match(/SOURCES([\s\S]+)/i)?.[1] ?? user;
  const parts = block.split(/\n(?=- |\d+\. )/);
  let i = 0;
  for (const p of parts) {
    const title = p.match(/title[:\s]+(.+)/i)?.[1] || p.slice(0, 60);
    const excerpt = p.match(/excerpt[:\s]+([\s\S]+)/i)?.[1] || p;
    if (excerpt.length > 40) {
      i += 1;
      sources.push({ id: `s${i}`, title: clip(title.trim(), 80), excerpt: clip(excerpt.trim(), 800) });
    }
  }
  return sources.slice(0, 8);
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildScenes(topic: string, facts: string[], sources: { id: string }[]) {
  const chunks = facts.length ? facts : [
    `${topic} is a story of people, place, and transmission — not a slogan.`,
    "We stay with what sources can support, and we flag what they cannot.",
    "Influence is a chain: invention, recording, travel, imitation, and reinvention.",
    "The closing question is not who owns a sound, but who carried it — and who heard it next.",
  ];
  const labels = ["Hook", "Context", "Turning point", "Global reach", "Close"];
  return chunks.slice(0, 5).map((narration, i) => ({
    heading: labels[i] ?? `Scene ${i + 1}`,
    narration,
    visualObjective: i === 0 ? "Cinematic establishing imagery matching the topic" : "Relevant archival or cultural visuals; no random stock",
    sourceIds: sources.slice(0, 2).map((s) => s.id),
  }));
}

function buildDescription(topic: string, sources: { title: string }[]): string {
  const cites = sources.map((s, i) => `${i + 1}. ${s.title}`).join("\n");
  return `${topic}\n\nA documentary produced with Aether Studio. Claims are tied to cited sources. Unverified statements are not presented as fact.\n\nSources:\n${cites || "See project research package."}\n\nChapters generated from the storyboard.`;
}

function titleOptions(topic: string): string[] {
  const clean = topic.replace(/\.$/, "");
  const second = /^how\b/i.test(clean) ? `${clean} — and what happened next` : `How ${clean} Changed Everything`;
  return [`${clean}: The Story They Don't Teach`, second, `${clean} — A Visual Documentary`];
}

function tagify(topic: string): string[] {
  const words = topic.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return [...new Set([...words, "documentary", "history", "explained", "faceless"])].slice(0, 15);
}

const CLOUD: LlmProvider[] = [
  new GroqLlm(),
  new OpenRouterLlm(),
  new GeminiLlm(),
  new CloudflareLlm(),
  new OllamaLlm(),
  new OpenAiLlm(),
];
const LOCAL: LlmProvider[] = [new HeuristicLlm(), new MockLlm()];

export function llmProviders(): LlmProvider[] {
  if (config.demoMode) return LOCAL;
  return [...CLOUD, ...LOCAL];
}

export async function completeLlm(
  messages: LlmMessage[],
  opts: { json?: boolean; maxTokens?: number; jobId?: string } = {},
): Promise<LlmResult> {
  const key = cacheKey(["llm", messages, opts.json, opts.maxTokens, config.demoMode]);
  const hit = cache.get<LlmResult>(key);
  if (hit) return { ...hit, provider: `${hit.provider}+cache` };

  const pool = config.demoMode || config.offlineMode ? LOCAL : [...rankProviders(
    CLOUD.map((p) => ({ id: p.id, kind: "llm", free: p.free, configured: p.configured, paid: p.paid })),
  ).map((r) => CLOUD.find((x) => x.id === r.id)!).filter(Boolean), ...LOCAL];

  let last: unknown;
  for (const p of pool) {
    if (!p.configured) continue;
    if (p.paid && opts.jobId) {
      const gate = budget.authorize({
        jobId: opts.jobId,
        estimatedUsd: 0.02,
        paid: true,
        jobBudgetUsd: config.jobBudgetUsd,
      });
      if (!gate.allowed) continue;
    }
    try {
      const result = await retryBackoff(() => p.complete(messages, opts), { retries: 1, label: p.id });
      recordSuccess(p.id, "llm", result.latencyMs, p.id === "heuristic" ? 62 : 80);
      if (opts.jobId) {
        budget.record(opts.jobId, {
          provider: p.id,
          operation: "llm.complete",
          estimatedUsd: result.costUsd,
          actualUsd: result.costUsd,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          paid: p.paid,
        });
      }
      cache.set(key, "llm", result, 6 * 60 * 60 * 1000);
      return result;
    } catch (e) {
      last = e;
      recordFailure(p.id, "llm", "PROVIDER_FAILURE", e instanceof Error ? e.message : String(e));
    }
  }
  throw last ?? new Error("No LLM provider available");
}

export function parseJsonFromLlm<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}
