import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileStrategyFromText, tryParseStrategyJson } from "@/core/strategy-compiler";
import { parseStrategy } from "@/core/strategy";
import { evaluateRule } from "@/core/dsl";
import { buildIndicatorSet } from "@/core/strategy-context";
import { synthesizeDemoBars } from "@/core/market-data";

const fixture = readFileSync(path.join(process.cwd(), "tests/fixtures/rsi-mean-reversion.md"), "utf8");

describe("strategy compiler", () => {
  it("compiles the RSI fixture into a valid DSL strategy", () => {
    const compiled = compileStrategyFromText(fixture, { filename: "rsi-mean-reversion.md" });
    expect(compiled.definition.instruments).toEqual(["EURUSD"]);
    expect(compiled.definition.timeframe).toBe("H1");
    expect(compiled.definition.entry.op).toBe("and");
    expect(compiled.definition.stop.value).toBe("2");
    expect(compiled.usedLlm).toBe(false);
    expect(compiled.evidence.length).toBeGreaterThan(0);
    const def = parseStrategy({
      ...compiled.definition,
      strategyId: "test_rsi",
      version: 1,
      createdAt: new Date().toISOString(),
      author: "test",
    });
    const ctx = buildIndicatorSet(synthesizeDemoBars("EURUSD", "forex", 80, 4));
    const result = evaluateRule(def.entry, ctx);
    expect(result.missing === true || result.passed === true || result.passed === false).toBe(true);
  });

  it("does not invent a tradeable entry from vague prose", () => {
    const compiled = compileStrategyFromText("I like gold and maybe buy dips when it feels oversold.");
    expect(compiled.needsClarification.length).toBeGreaterThan(0);
    expect(compiled.definition.entry).toMatchObject({ op: "cmp" });
  });

  it("parses a JSON strategy file when present", () => {
    const json = JSON.stringify({
      name: "JSON expert",
      instruments: ["GBPUSD"],
      timeframe: "M15",
      entry: { op: "cmp", left: { kind: "indicator", name: "rsi", period: 14 }, cmp: "<", right: { kind: "literal", value: "25" } },
      exit: { op: "cmp", left: { kind: "indicator", name: "rsi", period: 14 }, cmp: ">", right: { kind: "literal", value: "55" } },
    });
    const parsed = tryParseStrategyJson(json);
    expect(parsed?.definition.instruments).toEqual(["GBPUSD"]);
    expect(parsed?.definition.entry.op).toBe("cmp");
  });
});
