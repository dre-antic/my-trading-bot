import type { Bar } from "./types";

export const MT5_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"] as const;
export type Mt5Timeframe = (typeof MT5_TIMEFRAMES)[number];

export const TIMEFRAME_MINUTES: Record<Mt5Timeframe, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H4: 240,
  D1: 1440,
  W1: 10_080,
  MN: 43_200,
};

const ALIASES: Record<string, Mt5Timeframe> = {
  M1: "M1",
  "1M": "M1",
  "1MIN": "M1",
  M5: "M5",
  "5M": "M5",
  M15: "M15",
  "15M": "M15",
  M30: "M30",
  "30M": "M30",
  H1: "H1",
  "1H": "H1",
  H4: "H4",
  "4H": "H4",
  D1: "D1",
  "1D": "D1",
  DAILY: "D1",
  W1: "W1",
  "1W": "W1",
  WEEKLY: "W1",
  MN: "MN",
  MN1: "MN",
  MONTHLY: "MN",
};

export function parseTimeframe(raw: string | undefined | null, fallback: Mt5Timeframe = "D1"): Mt5Timeframe {
  if (!raw) return fallback;
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  return ALIASES[key] ?? fallback;
}

export function isMt5Timeframe(value: string): value is Mt5Timeframe {
  return (MT5_TIMEFRAMES as readonly string[]).includes(value);
}

/** Display-only resample. Caps output so the chart stays interactive. */
export function resampleBars(bars: Bar[], timeframe: Mt5Timeframe, maxBars = 400): Bar[] {
  if (!bars.length) return bars;
  if (timeframe === "D1") return bars.slice(-maxBars).map((b) => withTf(b, "D1"));
  if (timeframe === "W1" || timeframe === "MN") return aggregateBars(bars, timeframe).slice(-maxBars);
  return expandIntrabar(bars, timeframe, maxBars);
}

function withTf(bar: Bar, timeframe: string): Bar {
  return { ...bar, timeframe };
}

function aggregateBars(bars: Bar[], timeframe: Mt5Timeframe): Bar[] {
  const bucketMs = TIMEFRAME_MINUTES[timeframe] * 60_000;
  const groups = new Map<number, Bar[]>();
  for (const bar of bars) {
    const t = Date.parse(bar.timestamp);
    if (Number.isNaN(t)) continue;
    const key = Math.floor(t / bucketMs) * bucketMs;
    const list = groups.get(key) ?? [];
    list.push(bar);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, group]) => {
      const first = group[0];
      const last = group[group.length - 1];
      const high = Math.max(...group.map((g) => Number(g.high)));
      const low = Math.min(...group.map((g) => Number(g.low)));
      const volume = group.reduce((s, g) => s + Number(g.volume ?? 0), 0);
      return {
        ...last,
        timeframe,
        timestamp: new Date(ts).toISOString(),
        open: first.open,
        high: high.toFixed(4),
        low: low.toFixed(4),
        close: last.close,
        volume: volume.toFixed(0),
      };
    });
}

function expandIntrabar(daily: Bar[], timeframe: Mt5Timeframe, maxBars: number): Bar[] {
  const minutes = TIMEFRAME_MINUTES[timeframe];
  const perDay = Math.max(4, Math.min(48, Math.floor(1440 / minutes)));
  const daysNeeded = Math.max(1, Math.ceil(maxBars / perDay));
  const source = daily.slice(-daysNeeded);
  const out: Bar[] = [];
  for (const bar of source) {
    const open = Number(bar.open);
    const high = Number(bar.high);
    const low = Number(bar.low);
    const close = Number(bar.close);
    const up = close >= open;
    const path = up ? [open, high, low, close] : [open, low, high, close];
    const start = Date.parse(bar.timestamp);
    const stepMs = minutes * 60_000;
    for (let i = 0; i < perDay; i += 1) {
      const t = (i + 0.5) / perDay;
      const px = samplePath(path, t);
      const prev = i === 0 ? open : Number(out[out.length - 1]?.close ?? open);
      const noise = (high - low) * 0.08;
      const o = prev;
      const c = px;
      const h = Math.max(o, c) + noise * (i % 3 === 0 ? 0.4 : 0.1);
      const l = Math.min(o, c) - noise * (i % 5 === 0 ? 0.4 : 0.1);
      const vol = Number(bar.volume ?? 0) / perDay;
      out.push({
        ...bar,
        timeframe,
        timestamp: new Date(start + i * stepMs).toISOString(),
        open: o.toFixed(5),
        high: h.toFixed(5),
        low: l.toFixed(5),
        close: c.toFixed(5),
        volume: Math.max(1, vol).toFixed(0),
      });
    }
  }
  return out.slice(-maxBars);
}

function samplePath(points: number[], t: number): number {
  const x = Math.min(1, Math.max(0, t)) * (points.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = points[i] ?? points[0];
  const b = points[i + 1] ?? a;
  return a + (b - a) * f;
}
