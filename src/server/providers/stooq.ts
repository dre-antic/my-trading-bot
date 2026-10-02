import { provenance, type BarQuery, type MarketDataProvider } from "@/core/market-data";
import type { AssetClass, Bar } from "@/core/types";

const SYMBOL_MAP: Record<string, string> = {
  SPY: "spy.us",
  AAPL: "aapl.us",
  "BTC-USD": "btcusd",
  EURUSD: "eurusd",
};

export function stooqSymbol(instrument: string): string {
  return SYMBOL_MAP[instrument] ?? `${instrument.toLowerCase()}.us`;
}

export class StooqProvider implements MarketDataProvider {
  readonly id = "stooq";
  readonly displayName = "Stooq (free historical CSV)";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await this.fetchImpl("https://stooq.com/q/d/l/?s=spy.us&i=d");
      return { ok: res.ok, message: res.ok ? "stooq reachable" : `stooq HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "stooq unreachable" };
    }
  }

  async getBars(query: BarQuery): Promise<Bar[]> {
    const symbol = stooqSymbol(query.instrument);
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Stooq error ${res.status} for ${query.instrument}`);
    const text = await res.text();
    return parseStooqCsv(text, query.instrument, query.assetClass, url);
  }
}

export function parseStooqCsv(csv: string, instrument: string, assetClass: AssetClass, sourceRef: string): Bar[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || /No data/i.test(csv)) {
    throw new Error(`Stooq returned no rows for ${instrument}`);
  }
  const retrievedAt = new Date().toISOString();
  const bars: Bar[] = [];
  for (const line of lines.slice(1)) {
    const [date, open, high, low, close, volume] = line.split(",");
    if (!date || !close || close === "null") continue;
    const timestamp = `${date}T00:00:00.000Z`;
    bars.push({
      instrument,
      assetClass,
      timeframe: "1d",
      timestamp,
      open,
      high,
      low,
      close,
      volume: volume && volume !== "null" ? volume : "0",
      provenance: provenance({
        source: "stooq-csv",
        provider: "stooq",
        retrievedAt,
        dataTimestamp: timestamp,
        instrument,
        sourceRef,
      }),
    });
  }
  const limit = 400;
  return bars.slice(-limit);
}
