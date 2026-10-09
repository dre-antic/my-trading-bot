import {
  adx,
  atr,
  bollinger,
  closes,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
  supportResistance,
  vwap,
} from "./indicators";
import { Qty } from "./money";
import type { Bar } from "./types";

export interface IndicatorSet {
  series: Record<string, Array<number | null>>;
  scalars: Record<string, number | null>;
  account: { cash: number; equity: number; positionQty: number };
}

export function buildIndicatorSet(
  bars: Bar[],
  account = { cash: 0, equity: 0, positionQty: 0 },
): IndicatorSet {
  const c = closes(bars);
  const macdSet = macd(c);
  const bb = bollinger(c);
  const stoch = stochastic(bars);
  const sr = supportResistance(bars);
  const series: Record<string, Array<number | null>> = {
    close: c,
    open: bars.map((b) => new Qty(b.open).toNumberUnsafe()),
    high: bars.map((b) => new Qty(b.high).toNumberUnsafe()),
    low: bars.map((b) => new Qty(b.low).toNumberUnsafe()),
    volume: bars.map((b) => new Qty(b.volume).toNumberUnsafe()),
    sma_10: sma(c, 10),
    sma_20: sma(c, 20),
    sma_50: sma(c, 50),
    sma_200: sma(c, 200),
    ema_12: ema(c, 12),
    ema_26: ema(c, 26),
    rsi_14: rsi(c, 14),
    rsi: rsi(c, 14),
    macd: macdSet.macd,
    macd_signal: macdSet.signal,
    macd_hist: macdSet.histogram,
    atr_14: atr(bars, 14),
    atr: atr(bars, 14),
    bb_mid: bb.mid,
    bb_upper: bb.upper,
    bb_lower: bb.lower,
    vwap: vwap(bars),
    adx_14: adx(bars, 14),
    adx: adx(bars, 14),
    stoch_k: stoch.k,
    stoch_d: stoch.d,
    support: bars.map(() => sr.support),
    resistance: bars.map(() => sr.resistance),
  };
  const last = <T>(arr: Array<T | null>): T | null => (arr.length ? arr[arr.length - 1] : null);
  return {
    series,
    scalars: {
      support: sr.support,
      resistance: sr.resistance,
      close: last(c),
    },
    account,
  };
}
