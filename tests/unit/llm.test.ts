import { describe, expect, it } from "vitest";
import { OpenAiProvider, selectLlmProvider } from "@/server/providers/llm";
import { assertNoSecretInPrompt, sanitizeForLlm } from "@/core/security";

describe("optional LLM providers", () => {
  it("selects nothing when no keys or compatible URL are set", () => {
    const prev = {
      o: process.env.OPENAI_API_KEY,
      a: process.env.ANTHROPIC_API_KEY,
      c: process.env.OPENAI_COMPATIBLE_BASE_URL,
      g: process.env.GEMINI_API_KEY,
    };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_COMPATIBLE_BASE_URL;
    delete process.env.GEMINI_API_KEY;
    expect(selectLlmProvider()).toBeNull();
    process.env.OPENAI_API_KEY = prev.o;
    process.env.ANTHROPIC_API_KEY = prev.a;
    process.env.OPENAI_COMPATIBLE_BASE_URL = prev.c;
    process.env.GEMINI_API_KEY = prev.g;
  });

  it("refuses a missing key and sanitizes secrets", async () => {
    const provider = new OpenAiProvider("", async () => new Response("{}", { status: 200 }));
    await expect(provider.complete({ model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/not configured/);
    expect(sanitizeForLlm("key sk-abcdefghijklmnopqrstuv")).toContain("[REDACTED]");
    expect(() => assertNoSecretInPrompt("send sk-abcdefghijklmnopqrstuv")).toThrow(/secrets/);
  });

  it("maps a fixture OpenAI response when a key is supplied", async () => {
    const provider = new OpenAiProvider("sk-test", async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Desk summary from facts only." } }],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
        { status: 200 },
      ),
    );
    const out = await provider.complete({ model: "gpt-4o-mini", messages: [{ role: "user", content: "What is equity?" }] });
    expect(out.usedLlm).toBe(true);
    expect(out.text).toMatch(/facts/);
    expect(Number(out.estimatedCostUsd)).toBeGreaterThanOrEqual(0);
  });
});
