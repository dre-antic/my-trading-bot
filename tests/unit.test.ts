import { describe, expect, it } from "vitest";
import { budget } from "../src/budget/manager.js";
import { config } from "../src/config/index.js";
import { cache, cacheKey } from "../src/cache/index.js";
import { providerScore, rankProviders, withFailover, recordFailure, getStats } from "../src/providers/registry.js";
import { redact } from "../src/observability/logger.js";
import { alignScript, toSrt, toVtt } from "../src/providers/transcription/index.js";
import { listLicenses } from "../src/licenses/tracker.js";
import { estimateSpeechSec } from "../src/providers/tts/index.js";
import { parseJsonFromLlm, heuristicComplete } from "../src/providers/llm/index.js";

describe("budget", () => {
  it("rejects paid ops when paid providers are disabled", () => {
    expect(config.allowPaidProviders).toBe(false);
    const r = budget.authorize({ jobId: "j_test", estimatedUsd: 1.5, paid: true, jobBudgetUsd: 10 });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/disabled/i);
  });
  it("allows free ops", () => {
    const r = budget.authorize({ jobId: "j_test", estimatedUsd: 0, paid: false, jobBudgetUsd: 0 });
    expect(r.allowed).toBe(true);
  });
  it("records and sums spend", () => {
    budget.record("j_cost", { provider: "mock", operation: "test", estimatedUsd: 0.1, actualUsd: 0.1, paid: true });
    expect(budget.jobSpend("j_cost")).toBeGreaterThanOrEqual(0.1);
  });
});

describe("cache", () => {
  it("round-trips values", () => {
    const k = cacheKey(["unit", 1, { a: true }]);
    cache.set(k, "test", { hello: "world" });
    expect(cache.get<{ hello: string }>(k)?.hello).toBe("world");
  });
});

describe("provider scoring + failover", () => {
  it("computes score as specified", () => {
    expect(providerScore({ qualityScore: 10, availabilityScore: 10, freeQuotaScore: 10, speedScore: 10, costScore: 5 })).toBe(35);
  });
  it("ranks free before paid", () => {
    const ranked = rankProviders([
      { id: "paid", kind: "llm", free: false, configured: true, paid: true },
      { id: "free", kind: "llm", free: true, configured: true, paid: false },
    ]);
    expect(ranked[0]?.id).toBe("free");
    expect(ranked.find((p) => p.id === "paid")).toBeUndefined();
  });
  it("fails over from A to B", async () => {
    recordFailure("fail-a", "test", "PROVIDER_FAILURE", "boom");
    const { result, providerId } = await withFailover(
      [
        { id: "fail-a", kind: "test", free: true, configured: true, paid: false },
        { id: "ok-b", kind: "test", free: true, configured: true, paid: false },
      ],
      async (id) => {
        if (id === "fail-a") throw new Error("nope");
        return "yes";
      },
    );
    expect(result).toBe("yes");
    expect(providerId).toBe("ok-b");
    expect(getStats("ok-b", "test").calls).toBeGreaterThan(0);
  });
});

describe("captions", () => {
  it("builds srt and vtt with word timings", () => {
    const cues = alignScript("Hello world from Jamaica", 4);
    expect(cues.length).toBeGreaterThan(0);
    const srt = toSrt(cues);
    expect(srt).toMatch(/-->/);
    expect(toVtt(cues).startsWith("WEBVTT")).toBe(true);
  });
  it("estimates speech duration", () => {
    expect(estimateSpeechSec("one two three four five six seven eight nine ten", 150)).toBeGreaterThan(1);
  });
});

describe("security", () => {
  it("redacts api keys and bearer tokens", () => {
    expect(redact("Authorization: Bearer sk-abc123secret")).not.toMatch(/sk-abc/);
    expect(redact("api_key=supersecretvalue")).toMatch(/\[redacted\]/);
  });
});

describe("licenses", () => {
  it("tracks remotion as flagged for human review", () => {
    const rem = listLicenses().find((l) => l.id === "remotion");
    expect(rem?.flagged).toBeTruthy();
    expect(rem?.license.toLowerCase()).toMatch(/remotion/);
  });
  it("includes ffmpeg and pexels", () => {
    const ids = listLicenses().map((l) => l.id);
    expect(ids).toContain("ffmpeg");
    expect(ids).toContain("pexels");
    expect(ids).toContain("wikimedia");
  });
});

describe("heuristic llm", () => {
  it("returns parseable JSON for a documentary topic", () => {
    const text = heuristicComplete('Topic: "How Jamaican music influenced the world"\nSOURCES\n- title: Reggae excerpt: Reggae originated in Jamaica in the late 1960s.', "script");
    const parsed = parseJsonFromLlm<{ title: string; scenes: unknown[] }>(text);
    expect(parsed.title).toBeTruthy();
    expect(parsed.scenes.length).toBeGreaterThan(0);
  });
});
