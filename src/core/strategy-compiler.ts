import type { AssetClass } from "./types";
import type { RuleExpr, ValueRef } from "./dsl";
import type { StrategyDefinition } from "./strategy";
import { interpretSourceText, type InterpretedRule } from "./document-import";
import { parseTimeframe, type Mt5Timeframe } from "./timeframes";

export interface EvidenceQuote {
  quote: string;
  field: InterpretedRule["field"];
}

export interface CompiledStrategyDraft {
  definition: Omit<StrategyDefinition, "strategyId" | "version" | "createdAt" | "author">;
  evidence: EvidenceQuote[];
  uncompiled: string[];
  needsClarification: string[];
  usedLlm: boolean;
  sourceKind: string;
}

function indicator(name: string, period?: number): ValueRef {
  return { kind: "indicator", name, period };
}
function lit(value: string): ValueRef {
  return { kind: "literal", value };
}

const SYMBOL_TABLE: Array<{ re: RegExp; symbol: string; assetClass: AssetClass }> = [
  { re: /\bEUR[\s/-]?USD\b/i, symbol: "EURUSD", assetClass: "forex" },
  { re: /\bGBP[\s/-]?USD\b/i, symbol: "GBPUSD", assetClass: "forex" },
  { re: /\bUSD[\s/-]?JPY\b/i, symbol: "USDJPY", assetClass: "forex" },
  { re: /\bXAU[\s/-]?USD\b|\bgold\b/i, symbol: "XAUUSD", assetClass: "forex" },
  { re: /\bUS500\b|\bS&P\s*500\b|\bSPX\b/i, symbol: "US500", assetClass: "etf" },
  { re: /\bBTC[\s/-]?USD\b|\bbitcoin\b/i, symbol: "BTC-USD", assetClass: "crypto" },
  { re: /\bSPY\b/i, symbol: "SPY", assetClass: "etf" },
  { re: /\bAAPL\b/i, symbol: "AAPL", assetClass: "equity" },
  { re: /\bMSFT\b/i, symbol: "MSFT", assetClass: "equity" },
  { re: /\bNVDA\b/i, symbol: "NVDA", assetClass: "equity" },
];

const NEVER_ENTRY: RuleExpr = {
  op: "cmp",
  left: indicator("sma", 9999),
  cmp: ">",
  right: lit("0"),
};

export function compileStrategyFromText(text: string, opts?: { usedLlm?: boolean; sourceKind?: string; filename?: string }): CompiledStrategyDraft {
  const interpretation = interpretSourceText(text);
  const lower = text.toLowerCase();
  const evidence: EvidenceQuote[] = interpretation.rules.map((r) => ({ quote: r.sourceText, field: r.field }));
  const uncompiled: string[] = [];
  const needsClarification = [...interpretation.ambiguities];

  const symbolHit = SYMBOL_TABLE.find((row) => row.re.test(text));
  const instruments = symbolHit ? [symbolHit.symbol] : ["EURUSD"];
  const assetClass = symbolHit?.assetClass ?? "forex";
  const timeframe: Mt5Timeframe = detectTimeframe(text);
  const direction = /\bshort\b|\bsell\s+only\b/i.test(text) && !/\blong\b/i.test(text) ? "short" : "long";

  const rsiPeriod = captureInt(text, /rsi\s*(?:period\s*)?(\d+)/i) ?? 14;
  const rsiLow = captureNumber(text, /rsi[^.\n]{0,24}(?:below|under|<|oversold)\s*(\d+)/i);
  const rsiHigh = captureNumber(text, /rsi[^.\n]{0,24}(?:above|over|>|overbought)\s*(\d+)/i);
  const fastMa = captureInt(text, /(?:sma|ema|ma)\s*(\d{1,3}).{0,40}(?:sma|ema|ma)\s*\d{1,3}/i) ?? captureInt(text, /fast\s*(?:sma|ema|ma)\s*(\d+)/i);
  const slowMa = captureSecondInt(text, /(?:sma|ema|ma)\s*(\d{1,3}).{0,40}(?:sma|ema|ma)\s*(\d{1,3})/i) ?? captureInt(text, /slow\s*(?:sma|ema|ma)\s*(\d+)/i);
  const useEma = /\bema\b/i.test(text) && !/\bsma\b/i.test(text);
  const maName = useEma ? "ema" : "sma";
  const stopPct = captureNumber(text, /stop(?:\s*loss)?[^.\n]{0,20}(\d+(?:\.\d+)?)\s*%/i) ?? 2;
  const targetRr = captureNumber(text, /(?:rr|r\s*:\s*r|reward)[^.\n]{0,12}(\d+(?:\.\d+)?)/i) ?? 2;
  const bb = /bollinger/i.test(text);

  let entry: RuleExpr | null = null;
  let exit: RuleExpr | null = null;

  if (/oversold/i.test(text) && rsiLow == null) {
    needsClarification.push("The word oversold appears without an RSI level, so no entry level was assumed.");
  }

  if (fastMa && slowMa && fastMa !== slowMa) {
    entry = { op: "crosses_above", left: indicator(maName, Math.min(fastMa, slowMa)), right: indicator(maName, Math.max(fastMa, slowMa)) };
    exit = { op: "crosses_below", left: indicator(maName, Math.min(fastMa, slowMa)), right: indicator(maName, Math.max(fastMa, slowMa)) };
    evidence.push({ quote: `MA ${Math.min(fastMa, slowMa)}/${Math.max(fastMa, slowMa)}`, field: "entry" });
  } else if (rsiLow != null || bb) {
    const parts: RuleExpr[] = [];
    if (rsiLow != null) parts.push({ op: "cmp", left: indicator("rsi", rsiPeriod), cmp: "<", right: lit(String(rsiLow)) });
    if (bb) parts.push({ op: "cmp", left: indicator("close"), cmp: "<=", right: indicator("bb_lower") });
    entry = parts.length === 1 ? parts[0] : { op: "and", args: parts };
    const exitLevel = rsiHigh ?? 50;
    exit = { op: "cmp", left: indicator("rsi", rsiPeriod), cmp: ">", right: lit(String(exitLevel)) };
  } else if (/breakout|close above resistance/i.test(text)) {
    entry = { op: "cmp", left: indicator("close"), cmp: ">", right: indicator("resistance") };
    exit = { op: "cmp", left: indicator("close"), cmp: "<", right: indicator("sma", 20) };
  } else if (/momentum|adx/i.test(text)) {
    entry = {
      op: "and",
      args: [
        { op: "cmp", left: indicator("close"), cmp: ">", right: indicator("sma", 50) },
        { op: "cmp", left: indicator("rsi", 14), cmp: ">", right: lit("55") },
        { op: "cmp", left: indicator("adx", 14), cmp: ">", right: lit("20") },
      ],
    };
    exit = {
      op: "or",
      args: [
        { op: "cmp", left: indicator("rsi", 14), cmp: "<", right: lit("45") },
        { op: "crosses_below", left: indicator("close"), right: indicator("sma", 50) },
      ],
    };
  }

  if (!entry) {
    needsClarification.push("No mechanical entry rule could be compiled. The draft is inert until you clarify RSI, MA cross, or breakout conditions.");
    entry = NEVER_ENTRY;
    exit = NEVER_ENTRY;
  }
  if (!exit) exit = NEVER_ENTRY;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 12);
  for (const line of lines) {
    const compiled = interpretation.rules.some((r) => r.sourceText === line && r.confidence === "stated");
    const mentioned = /rsi|sma|ema|macd|bollinger|stop|profit|enter|buy|sell|exit/i.test(line);
    if (mentioned && !compiled && !/rsi\s*\d+|sma\s*\d+|%\s*$/i.test(line)) {
      uncompiled.push(line);
    }
  }

  const nameFromFile = opts?.filename?.replace(/\.[^.]+$/, "") ?? "";
  const name = humanName(nameFromFile, instruments[0], timeframe, lower);

  return {
    usedLlm: Boolean(opts?.usedLlm),
    sourceKind: opts?.sourceKind ?? "txt",
    evidence: uniqueEvidence(evidence),
    uncompiled: [...new Set(uncompiled)].slice(0, 12),
    needsClarification: [...new Set(needsClarification)],
    definition: {
      name,
      description: "Draft compiled from uploaded source. Not a profitability claim. Review SOURCE vs INTERPRETATION before attaching.",
      assetClass,
      instruments,
      timeframe,
      direction,
      entry,
      exit,
      stop: { kind: "percent", value: String(stopPct) },
      target: { kind: "rr", value: String(targetRr) },
      positionSizing: { method: "percent_account_risk", riskPct: "0.1" },
      compatibleRegimes: ["any"],
      lifecycle: "DRAFT",
      sourceDocumentIds: [],
      educational: false,
    },
  };
}

export function tryParseStrategyJson(text: string): CompiledStrategyDraft | null {
  try {
    const parsed = JSON.parse(text) as Partial<StrategyDefinition> & { entry?: RuleExpr; exit?: RuleExpr };
    if (!parsed.entry || !parsed.exit) return null;
    const inner = compileStrategyFromText(
      `${parsed.name ?? "Imported JSON"}\n${parsed.description ?? ""}\n${(parsed.instruments ?? []).join(" ")}`,
      { sourceKind: "json" },
    );
    return {
      ...inner,
      definition: {
        ...inner.definition,
        name: parsed.name ?? inner.definition.name,
        description: parsed.description ?? inner.definition.description,
        assetClass: parsed.assetClass ?? inner.definition.assetClass,
        instruments: parsed.instruments?.length ? parsed.instruments : inner.definition.instruments,
        timeframe: parsed.timeframe ? parseTimeframe(parsed.timeframe, "D1") : inner.definition.timeframe,
        direction: parsed.direction ?? inner.definition.direction,
        entry: parsed.entry,
        exit: parsed.exit,
        stop: parsed.stop ?? inner.definition.stop,
        target: parsed.target ?? inner.definition.target,
        positionSizing: parsed.positionSizing ?? inner.definition.positionSizing,
        filters: parsed.filters,
        invalidation: parsed.invalidation,
      },
    };
  } catch {
    return null;
  }
}

function detectTimeframe(text: string): Mt5Timeframe {
  const match = text.match(/\b(M1|M5|M15|M30|H1|H4|D1|W1|MN1?|1m|5m|15m|30m|1h|4h|1d|daily|hourly)\b/i);
  return parseTimeframe(match?.[1], "H1");
}

function captureInt(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function captureSecondInt(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m?.[2] ? Number(m[2]) : null;
}

function captureNumber(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

function humanName(filename: string, symbol: string, tf: string, lower: string): string {
  if (filename && !/^strategy|upload|file|new/i.test(filename)) {
    return filename.replace(/[_-]+/g, " ").trim();
  }
  if (/rsi|mean\s*reversion/i.test(lower)) return `RSI mean reversion ${symbol} ${tf}`;
  if (/sma|ema|cross|trend/i.test(lower)) return `MA trend ${symbol} ${tf}`;
  if (/breakout/i.test(lower)) return `Breakout ${symbol} ${tf}`;
  return `Imported expert ${symbol} ${tf}`;
}

function uniqueEvidence(rows: EvidenceQuote[]): EvidenceQuote[] {
  const seen = new Set<string>();
  const out: EvidenceQuote[] = [];
  for (const row of rows) {
    const key = `${row.field}:${row.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 16);
}
