import { describe, expect, it } from "vitest";
import { parseTimeframe, resampleBars } from "@/core/timeframes";
import { synthesizeDemoBars } from "@/core/market-data";

describe("timeframes", () => {
  it("parses MT5 aliases", () => {
    expect(parseTimeframe("1h")).toBe("H1");
    expect(parseTimeframe("daily")).toBe("D1");
    expect(parseTimeframe("15m")).toBe("M15");
  });

  it("resamples daily demo bars without dropping OHLC integrity", () => {
    const daily = synthesizeDemoBars("EURUSD", "forex", 40, 2);
    const h1 = resampleBars(daily, "H1", 80);
    expect(h1.length).toBeGreaterThan(10);
    expect(h1[0].timeframe).toBe("H1");
    for (const bar of h1) {
      expect(Number(bar.high)).toBeGreaterThanOrEqual(Number(bar.low));
    }
    const weekly = resampleBars(daily, "W1", 20);
    expect(weekly.length).toBeGreaterThan(0);
    expect(weekly[0].timeframe).toBe("W1");
  });
});
