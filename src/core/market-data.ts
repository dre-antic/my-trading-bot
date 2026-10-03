import type { AssetClass, Bar, DataFreshness, Provenance } from "./types";
import { isStale, parseUtc } from "./time";

export interface MarketDataProvider {
  readonly id: string;
  readonly displayName: string;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
  getBars(query: BarQuery): Promise<Bar[]>;
  getQuote?(instrument: string): Promise<{ bid: string; ask: string; last: string; timestamp: string }>;
}

export interface BarQuery {
  instrument: string;
  assetClass: AssetClass;
  timeframe: string;
  from?: string;
  to?: string;
  limit?: number;
}

export function provenance(partial: Omit<Provenance, "freshness"> & { now?: Date; maxAgeMs?: number }): Provenance {
  const now = partial.now ?? new Date();
  const dataTs = parseUtc(partial.dataTimestamp);
  let freshness: DataFreshness = "CURRENT";
  if (Number.isNaN(dataTs.getTime())) freshness = "UNKNOWN";
  else if (partial.maxAgeMs && isStale(dataTs, now, partial.maxAgeMs)) freshness = "STALE";
  else if (now.getTime() - dataTs.getTime() > 36 * 3_600_000) freshness = "HISTORICAL";
  return {
    source: partial.source,
    provider: partial.provider,
    retrievedAt: partial.retrievedAt,
    dataTimestamp: partial.dataTimestamp,
    instrument: partial.instrument,
    sourceRef: partial.sourceRef,
    agent: partial.agent,
    model: partial.model,
    analysisVersion: partial.analysisVersion,
    freshness,
  };
}

export function assertNoFakeProductionData(mode: "demo" | "paper" | "live", providerId: string): void {
  if ((mode === "paper" || mode === "live") && providerId === "synthetic") {
    throw new Error("Refusing to substitute synthetic market data in paper/live mode.");
  }
}

export function synthesizeDemoBars(instrument: string, assetClass: AssetClass, count = 220, seed = 7): Bar[] {
  const bars: Bar[] = [];
  let price = assetClass === "crypto" ? 60_000 : assetClass === "forex" ? 1.08 : 100;
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const start = Date.UTC(2023, 0, 2);
  for (let i = 0; i < count; i += 1) {
    const change = (rand() - 0.48) * (assetClass === "crypto" ? 0.03 : 0.012);
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + rand() * 0.004);
    const low = Math.min(open, close) * (1 - rand() * 0.004);
    const ts = new Date(start + i * 86_400_000).toISOString();
    bars.push({
      instrument,
      assetClass,
      timeframe: "1d",
      timestamp: ts,
      open: open.toFixed(4),
      high: high.toFixed(4),
      low: low.toFixed(4),
      close: close.toFixed(4),
      volume: (1_000_000 + rand() * 500_000).toFixed(0),
      provenance: provenance({
        source: "demo-synthetic",
        provider: "demo",
        retrievedAt: ts,
        dataTimestamp: ts,
        instrument,
        sourceRef: "synthetic-demo-series",
        now: new Date(ts),
      }),
    });
    price = close;
  }
  return bars;
}
