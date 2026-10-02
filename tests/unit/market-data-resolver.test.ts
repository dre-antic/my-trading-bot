import { describe, expect, it } from "vitest";
import { barsFromCacheOrDemo } from "@/server/providers/market-data-resolver";

describe("market data resolver", () => {
  it("returns labeled synthetic bars in demo mode", () => {
    const bars = barsFromCacheOrDemo("RESOLVER-DEMO", "etf", "demo");
    expect(bars.length).toBeGreaterThan(10);
    expect(bars[0].provenance.provider).toBe("demo");
    expect(bars[0].provenance.source).toBe("demo-synthetic");
  });

  it("refuses silent synthetic substitution in paper mode when cache is empty", () => {
    expect(() => barsFromCacheOrDemo("NO-CACHE-PAPER", "etf", "paper")).toThrow(/No cached market data|synthetic/);
  });
});
