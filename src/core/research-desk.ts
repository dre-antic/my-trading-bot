import { classifyRegime } from "./regime";
import { buildIndicatorSet } from "./strategy-context";
import { lastDefined } from "./indicators";
import { evaluateStrategyCompliance, type StrategyDefinition } from "./strategy";
import type { Bar } from "./types";
import { AGENT_CATALOG } from "./ai";

export interface DeskReport {
  marketOverview: string;
  marketRegime: string;
  strategyConditions: string;
  technicalAnalysis: string;
  fundamentalAnalysis: string;
  newsMacro: string;
  bullCase: string;
  bearCase: string;
  risk: string;
  portfolioImpact: string;
  tradeProposal: string;
  invalidation: string;
  dataQuality: string;
  usedLlm: false;
  agents: string[];
  evidenceAsymmetric?: string;
}

export function runDeterministicDesk(
  strategy: StrategyDefinition,
  bars: Bar[],
  extras?: { fundamentals?: string[]; news?: string[]; portfolioNote?: string },
): DeskReport {
  const compliance = evaluateStrategyCompliance(strategy, bars);
  const regime = classifyRegime(bars);
  const ctx = buildIndicatorSet(bars);
  const close = lastDefined(ctx.series.close);
  const rsi = lastDefined(ctx.series.rsi);
  const adx = lastDefined(ctx.series.adx);
  const sma20 = lastDefined(ctx.series.sma_20);
  const sma50 = lastDefined(ctx.series.sma_50);
  const lastBar = bars[bars.length - 1];

  const technical = [
    close != null ? `Last close ${close.toFixed(4)}` : "Close unavailable",
    rsi != null ? `RSI(14) ${rsi.toFixed(1)}` : "RSI unavailable",
    adx != null ? `ADX(14) ${adx.toFixed(1)}` : "ADX unavailable",
    sma20 != null ? `SMA20 ${sma20.toFixed(4)}` : "SMA20 unavailable",
    sma50 != null ? `SMA50 ${sma50.toFixed(4)}` : "SMA50 unavailable",
  ].join(". ");

  const bullBits: string[] = [];
  const bearBits: string[] = [];
  if (compliance.matched) bullBits.push("The candidate currently satisfies the coded strategy rules.");
  else bearBits.push("The candidate does not fully satisfy the coded strategy rules.");
  if (rsi != null && rsi < 35) bullBits.push("RSI is in a relatively low zone, which can support a mean-reversion thesis.");
  if (rsi != null && rsi > 65) bearBits.push("RSI is elevated, which can argue against a fresh long.");
  if (sma20 != null && sma50 != null && sma20 > sma50) bullBits.push("SMA20 is above SMA50.");
  if (sma20 != null && sma50 != null && sma20 < sma50) bearBits.push("SMA20 is below SMA50.");
  if (!bullBits.length) bullBits.push("No strong bullish evidence was found in the available indicators.");
  if (!bearBits.length) bearBits.push("No strong bearish evidence was found in the available indicators.");

  const asymmetric =
    bullBits.length >= 2 && bearBits.length === 1
      ? "Evidence currently leans bullish; the counterargument is still shown."
      : bearBits.length >= 2 && bullBits.length === 1
        ? "Evidence currently leans bearish; the counterargument is still shown."
        : undefined;

  return {
    marketOverview: `${lastBar.instrument} last bar ${lastBar.timestamp} close ${lastBar.close}. Provider ${lastBar.provenance.provider}, freshness ${lastBar.provenance.freshness}.`,
    marketRegime: `${regime.primary} (confidence ${regime.confidence.toFixed(2)}, model ${regime.modelVersion}). ${regime.evidence.join(" ")} Regime is a classification, not truth.`,
    strategyConditions: compliance.matched
      ? "Coded strategy conditions currently match."
      : `Coded strategy conditions do not fully match. Failures: ${compliance.failed.map((f) => f.rule).join("; ") || "none listed"}.`,
    technicalAnalysis: technical + " Indicators are evidence, not trade decisions.",
    fundamentalAnalysis:
      extras?.fundamentals?.join(" ") ??
      "No fundamental feed is configured. The desk will not invent earnings, rates, or on-chain figures.",
    newsMacro:
      extras?.news?.join(" ") ??
      "No news feed is configured. News sentiment alone cannot trigger a trade.",
    bullCase: bullBits.join(" "),
    bearCase: bearBits.join(" "),
    risk: "Any proposal must still pass the deterministic Risk Firewall and human approval.",
    portfolioImpact: extras?.portfolioNote ?? "Portfolio impact is computed from current account positions at proposal time.",
    tradeProposal: compliance.matched
      ? "The deterministic desk can raise a candidate for risk review. This is a proposal, not an order."
      : "No compliant candidate. The desk will not force a trade.",
    invalidation: "Invalidation is the strategy stop, timeout, or explicit invalidation rule — not an AI opinion.",
    dataQuality: `Source ${lastBar.provenance.source}; retrieved ${lastBar.provenance.retrievedAt}; data time ${lastBar.provenance.dataTimestamp}; freshness ${lastBar.provenance.freshness}.`,
    usedLlm: false,
    agents: AGENT_CATALOG.map((a) => a.id),
    evidenceAsymmetric: asymmetric,
  };
}
