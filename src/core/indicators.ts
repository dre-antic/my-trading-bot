import { Qty } from "./money";
import type { Bar } from "./types";

export function closes(bars: Bar[]): number[] {
  return bars.map((b) => new Qty(b.close).toNumberUnsafe());
}

export function sma(values: number[], period: number): Array<number | null> {
  return rolling(values, period, (window) => avg(window));
}

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = avg(values.slice(0, period));
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    const g = delta > 0 ? delta : 0;
    const l = delta < 0 ? -delta : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function atr(bars: Bar[], period = 14): Array<number | null> {
  const tr: number[] = bars.map((bar, i) => {
    const high = new Qty(bar.high).toNumberUnsafe();
    const low = new Qty(bar.low).toNumberUnsafe();
    const prevClose = i === 0 ? new Qty(bar.close).toNumberUnsafe() : new Qty(bars[i - 1].close).toNumberUnsafe();
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  });
  return sma(tr, period);
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: Array<number | null>; signal: Array<number | null>; histogram: Array<number | null> } {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = values.map((_, i) => {
    if (fastEma[i] == null || slowEma[i] == null) return null;
    return (fastEma[i] as number) - (slowEma[i] as number);
  });
  const compact: number[] = [];
  const indexMap: number[] = [];
  macdLine.forEach((v, i) => {
    if (v != null) {
      compact.push(v);
      indexMap.push(i);
    }
  });
  const signalCompact = ema(compact, signal);
  const signalLine: Array<number | null> = values.map(() => null);
  const histogram: Array<number | null> = values.map(() => null);
  signalCompact.forEach((v, j) => {
    if (v == null) return;
    const i = indexMap[j];
    signalLine[i] = v;
    histogram[i] = (macdLine[i] as number) - v;
  });
  return { macd: macdLine, signal: signalLine, histogram };
}

export function bollinger(values: number[], period = 20, k = 2): {
  mid: Array<number | null>;
  upper: Array<number | null>;
  lower: Array<number | null>;
} {
  const mid = sma(values, period);
  const upper: Array<number | null> = values.map(() => null);
  const lower: Array<number | null> = values.map(() => null);
  for (let i = period - 1; i < values.length; i += 1) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = avg(window);
    const variance = avg(window.map((v) => (v - mean) ** 2));
    const sd = Math.sqrt(variance);
    upper[i] = mean + k * sd;
    lower[i] = mean - k * sd;
  }
  return { mid, upper, lower };
}

export function vwap(bars: Bar[]): Array<number | null> {
  const out: Array<number | null> = [];
  let pv = 0;
  let vol = 0;
  for (const bar of bars) {
    const typical =
      (new Qty(bar.high).toNumberUnsafe() + new Qty(bar.low).toNumberUnsafe() + new Qty(bar.close).toNumberUnsafe()) / 3;
    const volume = new Qty(bar.volume).toNumberUnsafe();
    pv += typical * volume;
    vol += volume;
    out.push(vol === 0 ? null : pv / vol);
  }
  return out;
}

export function adx(bars: Bar[], period = 14): Array<number | null> {
  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  const tr: number[] = [0];
  for (let i = 1; i < bars.length; i += 1) {
    const high = new Qty(bars[i].high).toNumberUnsafe();
    const low = new Qty(bars[i].low).toNumberUnsafe();
    const prevHigh = new Qty(bars[i - 1].high).toNumberUnsafe();
    const prevLow = new Qty(bars[i - 1].low).toNumberUnsafe();
    const prevClose = new Qty(bars[i - 1].close).toNumberUnsafe();
    const up = high - prevHigh;
    const down = prevLow - low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const atrs = sma(tr, period);
  const plusDi: Array<number | null> = bars.map(() => null);
  const minusDi: Array<number | null> = bars.map(() => null);
  const dx: number[] = [];
  const dxIndex: number[] = [];
  const plusSma = sma(plusDm, period);
  const minusSma = sma(minusDm, period);
  for (let i = 0; i < bars.length; i += 1) {
    if (atrs[i] == null || plusSma[i] == null || minusSma[i] == null || atrs[i] === 0) continue;
    const p = (100 * (plusSma[i] as number)) / (atrs[i] as number);
    const m = (100 * (minusSma[i] as number)) / (atrs[i] as number);
    plusDi[i] = p;
    minusDi[i] = m;
    const d = p + m === 0 ? 0 : (100 * Math.abs(p - m)) / (p + m);
    dx.push(d);
    dxIndex.push(i);
  }
  const adxCompact = sma(dx, period);
  const out: Array<number | null> = bars.map(() => null);
  adxCompact.forEach((v, j) => {
    if (v != null) out[dxIndex[j]] = v;
  });
  return out;
}

export function stochastic(bars: Bar[], kPeriod = 14, dPeriod = 3): {
  k: Array<number | null>;
  d: Array<number | null>;
} {
  const k: Array<number | null> = bars.map(() => null);
  for (let i = kPeriod - 1; i < bars.length; i += 1) {
    const window = bars.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...window.map((b) => new Qty(b.high).toNumberUnsafe()));
    const lowest = Math.min(...window.map((b) => new Qty(b.low).toNumberUnsafe()));
    const close = new Qty(bars[i].close).toNumberUnsafe();
    k[i] = highest === lowest ? 0 : ((close - lowest) / (highest - lowest)) * 100;
  }
  const compact = k.filter((v): v is number => v != null);
  const dCompact = sma(compact, dPeriod);
  const d: Array<number | null> = bars.map(() => null);
  let j = 0;
  for (let i = 0; i < k.length; i += 1) {
    if (k[i] == null) continue;
    d[i] = dCompact[j] ?? null;
    j += 1;
  }
  return { k, d };
}

export function lastDefined(values: Array<number | null>): number | null {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null) return values[i];
  }
  return null;
}

export function crossedAbove(left: Array<number | null>, right: Array<number | null>): boolean {
  if (left.length < 2 || right.length < 2) return false;
  const i = left.length - 1;
  const a0 = left[i - 1];
  const a1 = left[i];
  const b0 = right[i - 1];
  const b1 = right[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

export function crossedBelow(left: Array<number | null>, right: Array<number | null>): boolean {
  if (left.length < 2 || right.length < 2) return false;
  const i = left.length - 1;
  const a0 = left[i - 1];
  const a1 = left[i];
  const b0 = right[i - 1];
  const b1 = right[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 >= b0 && a1 < b1;
}

export function supportResistance(bars: Bar[], lookback = 20): { support: number | null; resistance: number | null } {
  if (bars.length < 3) return { support: null, resistance: null };
  const window = bars.slice(-lookback);
  const lows = window.map((b) => new Qty(b.low).toNumberUnsafe());
  const highs = window.map((b) => new Qty(b.high).toNumberUnsafe());
  return { support: Math.min(...lows), resistance: Math.max(...highs) };
}

export function detectBreakout(bars: Bar[], lookback = 20): { breakoutHigh: boolean; breakoutLow: boolean } {
  if (bars.length < lookback + 1) return { breakoutHigh: false, breakoutLow: false };
  const prior = bars.slice(-lookback - 1, -1);
  const last = bars[bars.length - 1];
  const resistance = Math.max(...prior.map((b) => new Qty(b.high).toNumberUnsafe()));
  const support = Math.min(...prior.map((b) => new Qty(b.low).toNumberUnsafe()));
  const close = new Qty(last.close).toNumberUnsafe();
  return { breakoutHigh: close > resistance, breakoutLow: close < support };
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function rolling(values: number[], period: number, fn: (window: number[]) => number): Array<number | null> {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    return fn(values.slice(i - period + 1, i + 1));
  });
}
