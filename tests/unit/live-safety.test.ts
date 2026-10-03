import { describe, expect, it } from "vitest";
import {
  LIVE_HOSTS,
  LIVE_PHRASES,
  assertDistinctLiveKeys,
  assertLiveBrokerUrl,
  evaluateArmLive,
  evaluateEnableLive,
  evaluatePlaceLiveOrder,
  isPaperTradingHost,
  sessionSecretAllowsLive,
} from "@/core/live-safety";

const base = {
  envLiveEnabled: true,
  userLiveEnabled: true,
  armedUntil: new Date(Date.now() + 60_000).toISOString(),
  halted: false,
  stopNewTrades: false,
  displayMode: "live" as const,
  tradingMode: "assisted" as const,
  sessionSecret: "a-sufficiently-long-production-session-secret",
  now: new Date(),
};

describe("live safety gates", () => {
  it("blocks enable when env is off or the session secret is the example", () => {
    expect(evaluateEnableLive({ envLiveEnabled: false, sessionSecret: base.sessionSecret, confirmPhrase: LIVE_PHRASES.enable }).ok).toBe(false);
    expect(
      evaluateEnableLive({
        envLiveEnabled: true,
        sessionSecret: "change-me-to-a-long-random-string-at-least-32-chars",
        confirmPhrase: LIVE_PHRASES.enable,
      }).ok,
    ).toBe(false);
    expect(sessionSecretAllowsLive("dev-only-session-secret-change-me-32ch")).toBe(false);
    expect(
      evaluateEnableLive({ envLiveEnabled: true, sessionSecret: base.sessionSecret, confirmPhrase: LIVE_PHRASES.enable }).ok,
    ).toBe(true);
  });

  it("requires the exact enable/arm/place phrases", () => {
    expect(evaluateEnableLive({ envLiveEnabled: true, sessionSecret: base.sessionSecret, confirmPhrase: "enable live" }).ok).toBe(false);
    expect(evaluateArmLive({ ...base, confirmPhrase: "arm" }).ok).toBe(false);
    expect(evaluatePlaceLiveOrder({ ...base, confirmPhrase: "buy" }).failures.join(" ")).toMatch(/PLACE LIVE ORDER/);
  });

  it("refuses to arm in research or autonomous mode", () => {
    expect(evaluateArmLive({ ...base, confirmPhrase: LIVE_PHRASES.arm, tradingMode: "research" }).ok).toBe(false);
    expect(evaluateArmLive({ ...base, confirmPhrase: LIVE_PHRASES.arm, tradingMode: "autonomous" }).ok).toBe(false);
    expect(evaluateArmLive({ ...base, confirmPhrase: LIVE_PHRASES.arm }).ok).toBe(true);
  });

  it("refuses live orders when the session is not armed or the breaker is tripped", () => {
    expect(evaluatePlaceLiveOrder({ ...base, confirmPhrase: LIVE_PHRASES.place, armedUntil: null }).ok).toBe(false);
    expect(evaluatePlaceLiveOrder({ ...base, confirmPhrase: LIVE_PHRASES.place, halted: true, haltReason: "broker errors" }).ok).toBe(false);
    expect(evaluatePlaceLiveOrder({ ...base, confirmPhrase: LIVE_PHRASES.place, tradingMode: "autonomous" }).ok).toBe(false);
    expect(evaluatePlaceLiveOrder({ ...base, confirmPhrase: LIVE_PHRASES.place }).ok).toBe(true);
  });

  it("refuses paper hosts and mixed paper/live keys", () => {
    expect(isPaperTradingHost(LIVE_HOSTS.alpacaPaper)).toBe(true);
    expect(isPaperTradingHost(LIVE_HOSTS.oandaPractice)).toBe(true);
    expect(() => assertLiveBrokerUrl(LIVE_HOSTS.alpacaPaper)).toThrow(/paper/);
    expect(() => assertLiveBrokerUrl("https://evil.example")).toThrow(/allowlist/);
    expect(() => assertLiveBrokerUrl(LIVE_HOSTS.alpacaLive)).not.toThrow();
    expect(() => assertDistinctLiveKeys("same", "same")).toThrow(/distinct/);
    expect(() => assertDistinctLiveKeys("paper", "live")).not.toThrow();
  });
});
