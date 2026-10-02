import { describe, expect, it } from "vitest";
import { parseStooqCsv, stooqSymbol } from "@/server/providers/stooq";

const SAMPLE = `Date,Open,High,Low,Close,Volume
2024-01-02,100.1,101.2,99.5,100.8,123456
2024-01-03,100.8,102.0,100.2,101.5,234567
`;

describe("Stooq CSV parser", () => {
  it("maps known symbols and parses provenance-labeled bars", () => {
    expect(stooqSymbol("SPY")).toBe("spy.us");
    const bars = parseStooqCsv(SAMPLE, "SPY", "etf", "https://stooq.com/q/d/l/?s=spy.us&i=d");
    expect(bars).toHaveLength(2);
    expect(bars[1].close).toBe("101.5");
    expect(bars[1].provenance.provider).toBe("stooq");
    expect(bars[1].provenance.source).toBe("stooq-csv");
    expect(bars[1].instrument).toBe("SPY");
  });

  it("refuses empty or no-data responses", () => {
    expect(() => parseStooqCsv("Date,Open,High,Low,Close,Volume\n", "SPY", "etf", "x")).toThrow(/no rows/);
    expect(() => parseStooqCsv("No data", "SPY", "etf", "x")).toThrow(/no rows/);
  });
});
