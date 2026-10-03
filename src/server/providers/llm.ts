import { estimateCostUsd, type AiCompletion, type AiProvider, type AiProviderId } from "@/core/ai";
import { assertNoSecretInPrompt, sanitizeForLlm } from "@/core/security";
import { loadConfig } from "../config";

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export class OpenAiProvider implements AiProvider {
  readonly id: AiProviderId = "openai";
  readonly displayName = "OpenAI";
  constructor(private readonly key = loadConfig().openaiKey, private readonly fetchImpl = timedFetch) {}

  async complete(req: { model: string; messages: { role: "system" | "user" | "assistant"; content: string }[]; maxTokens?: number; timeoutMs?: number }): Promise<AiCompletion> {
    if (!this.key) throw new Error("OPENAI_API_KEY is not configured");
    const messages = req.messages.map((m) => ({ ...m, content: sanitizeForLlm(m.content) }));
    messages.forEach((m) => assertNoSecretInPrompt(m.content));
    const res = await this.fetchImpl(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: req.model, messages, max_tokens: req.maxTokens ?? 400 }),
      },
      req.timeoutMs ?? 20_000,
    );
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const body = (await res.json()) as {
      choices: Array<{ message: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const input = body.usage?.prompt_tokens ?? 0;
    const output = body.usage?.completion_tokens ?? 0;
    return {
      provider: "openai",
      model: req.model,
      text: body.choices[0]?.message.content ?? "",
      toolCalls: [],
      inputTokens: input,
      outputTokens: output,
      estimatedCostUsd: estimateCostUsd(req.model, input, output),
      usedLlm: true,
    };
  }
}

export class AnthropicProvider implements AiProvider {
  readonly id: AiProviderId = "anthropic";
  readonly displayName = "Anthropic";
  constructor(private readonly key = loadConfig().anthropicKey, private readonly fetchImpl = timedFetch) {}

  async complete(req: { model: string; messages: { role: "system" | "user" | "assistant"; content: string }[]; maxTokens?: number; timeoutMs?: number }): Promise<AiCompletion> {
    if (!this.key) throw new Error("ANTHROPIC_API_KEY is not configured");
    const system = req.messages.filter((m) => m.role === "system").map((m) => sanitizeForLlm(m.content)).join("\n");
    const messages = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: sanitizeForLlm(m.content) }));
    assertNoSecretInPrompt(system);
    messages.forEach((m) => assertNoSecretInPrompt(m.content));
    const res = await this.fetchImpl(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": this.key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: req.model, system, messages, max_tokens: req.maxTokens ?? 400 }),
      },
      req.timeoutMs ?? 20_000,
    );
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const body = (await res.json()) as { content?: Array<{ text?: string }>; usage?: { input_tokens: number; output_tokens: number } };
    const input = body.usage?.input_tokens ?? 0;
    const output = body.usage?.output_tokens ?? 0;
    return {
      provider: "anthropic",
      model: req.model,
      text: body.content?.[0]?.text ?? "",
      toolCalls: [],
      inputTokens: input,
      outputTokens: output,
      estimatedCostUsd: estimateCostUsd(req.model, input, output),
      usedLlm: true,
    };
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly id: AiProviderId = "openai_compatible";
  readonly displayName = "OpenAI-compatible";
  constructor(
    private readonly baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL,
    private readonly key = process.env.OPENAI_COMPATIBLE_API_KEY,
    private readonly fetchImpl = timedFetch,
  ) {}

  async complete(req: { model: string; messages: { role: "system" | "user" | "assistant"; content: string }[]; maxTokens?: number; timeoutMs?: number }): Promise<AiCompletion> {
    if (!this.baseUrl) throw new Error("OPENAI_COMPATIBLE_BASE_URL is not configured");
    const messages = req.messages.map((m) => ({ ...m, content: sanitizeForLlm(m.content) }));
    messages.forEach((m) => assertNoSecretInPrompt(m.content));
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.key) headers.Authorization = `Bearer ${this.key}`;
    const res = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
      { method: "POST", headers, body: JSON.stringify({ model: req.model, messages, max_tokens: req.maxTokens ?? 400 }) },
      req.timeoutMs ?? 20_000,
    );
    if (!res.ok) throw new Error(`Compatible LLM HTTP ${res.status}`);
    const body = (await res.json()) as { choices: Array<{ message: { content?: string } }>; usage?: { prompt_tokens: number; completion_tokens: number } };
    const input = body.usage?.prompt_tokens ?? 0;
    const output = body.usage?.completion_tokens ?? 0;
    return {
      provider: "openai_compatible",
      model: req.model,
      text: body.choices[0]?.message.content ?? "",
      toolCalls: [],
      inputTokens: input,
      outputTokens: output,
      estimatedCostUsd: estimateCostUsd(req.model, input, output),
      usedLlm: true,
    };
  }
}

export function selectLlmProvider(): AiProvider | null {
  const cfg = loadConfig();
  if (cfg.openaiKey) return new OpenAiProvider();
  if (cfg.anthropicKey) return new AnthropicProvider();
  if (process.env.OPENAI_COMPATIBLE_BASE_URL) return new OpenAiCompatibleProvider();
  return null;
}
