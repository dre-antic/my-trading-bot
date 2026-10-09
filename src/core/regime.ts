import { adx, atr, lastDefined, rsi, sma } from "./indicators";
import { Qty } from "./money";
import type { Bar, RegimeLabel } from "./types";

export interface RegimeClassification {
  labels: RegimeLabel[];
  primary: RegimeLabel;
  confidence: number;
  evidence: string[];
  modelVersion: string;
  timestamp: string;
}

const MODEL_VERSION = "regime-v1-deterministic";

export function classifyRegime(bars: Bar[], asOf = new Date()): RegimeClassification {
  const evidence: string[] = [];
  const labels: RegimeLabel[] = [];
  if (bars.length < 30) {
    return {
      labels: ["uncertain"],
      primary: "uncertain",
      confidence: 0.2,
      evidence: ["Fewer than 30 bars; regime is uncertain."],
      modelVersion: MODEL_VERSION,
      timestamp: asOf.toISOString(),
    };
  }

  const closes = bars.map((b) => new Qty(b.close).toNumberUnsafe());
  const adxSeries = adx(bars, 14);
  const atrSeries = atr(bars, 14);
  const rsiSeries = rsi(closes, 14);
  const sma50 = sma(closes, 50);
  const lastAdx = lastDefined(adxSeries);
  const lastAtr = lastDefined(atrSeries);
  const lastRsi = lastDefined(rsiSeries);
  const lastSma = lastDefined(sma50);
  const lastClose = closes[closes.length - 1];
  const atrWindow = atrSeries.filter((v): v is number => v != null).slice(-50);
  const atrMedian = median(atrWindow);

  if (lastAdx != null && lastAdx >= 25) {
    labels.push("trending");
    evidence.push(`ADX ${lastAdx.toFixed(1)} >= 25 suggests a trend.`);
  } else if (lastAdx != null && lastAdx < 20) {
    labels.push("ranging");
    evidence.push(`ADX ${lastAdx.toFixed(1)} < 20 suggests a range.`);
  }

  if (lastAtr != null && atrMedian && lastAtr > atrMedian * 1.4) {
    labels.push("high_volatility");
    evidence.push(`ATR ${lastAtr.toFixed(4)} is 40% above its recent median.`);
  } else if (lastAtr != null && atrMedian && lastAtr < atrMedian * 0.7) {
    labels.push("low_volatility");
    evidence.push(`ATR ${lastAtr.toFixed(4)} is 30% below its recent median.`);
  }

  if (lastSma != null && lastClose > lastSma && lastRsi != null && lastRsi >= 55) {
    labels.push("risk_on");
    evidence.push("Price above SMA50 with RSI >= 55.");
  } else if (lastSma != null && lastClose < lastSma && lastRsi != null && lastRsi <= 45) {
    labels.push("risk_off");
    evidence.push("Price below SMA50 with RSI <= 45.");
  }

  const last = bars[bars.length - 1];
  const range = new Qty(last.high).sub(last.low).toNumberUnsafe();
  const body = Math.abs(new Qty(last.close).sub(last.open).toNumberUnsafe());
  if (lastAtr && range > lastAtr * 3 && body / Math.max(range, 1e-9) < 0.2) {
    labels.push("abnormal");
    evidence.push("Last bar range is extreme versus ATR with a small body.");
  }

  if (labels.length === 0) {
    labels.push("uncertain");
    evidence.push("No strong regime features were present.");
  }

  const primary = labels[0];
  const confidence = Math.min(0.85, 0.35 + labels.length * 0.15);
  return {
    labels,
    primary,
    confidence,
    evidence,
    modelVersion: MODEL_VERSION,
    timestamp: asOf.toISOString(),
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
