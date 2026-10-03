import { provenance, type BarQuery, type MarketDataProvider } from "@/core/market-data";
import type { Bar } from "@/core/types";
import { loadConfig } from "../config";

export class AlpacaDataProvider implements MarketDataProvider {
  readonly id = "alpaca_data";
  readonly displayName = "Alpaca Market Data";

  constructor(
    private readonly key = loadConfig().alpacaPaperKey,
    private readonly secret = loadConfig().alpacaPaperSecret,
    private readonly baseUrl = process.env.ALPACA_DATA_BASE_URL ?? "https://data.alpaca.markets",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    if (!this.key || !this.secret) return { ok: false, message: "Alpaca data keys are not configured" };
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v2/stocks/SPY/bars?timeframe=1Day&limit=1`, { headers: this.headers() });
      return { ok: res.ok, message: res.ok ? "alpaca data reachable" : `alpaca data HTTP ${res.status}` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "alpaca data unreachable" };
    }
  }

  async getBars(query: BarQuery): Promise<Bar[]> {
    if (!this.key || !this.secret) {
      throw new Error("Alpaca data keys are not configured. Refusing to invent bars.");
    }
    const url = `${this.baseUrl}/v2/stocks/${encodeURIComponent(query.instrument)}/bars?timeframe=1Day&limit=${query.limit ?? 250}`;
    const res = await this.fetchImpl(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca data error ${res.status}`);
    const body = (await res.json()) as { bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> };
    const retrievedAt = new Date().toISOString();
    return (body.bars ?? []).map((b) => ({
      instrument: query.instrument,
      assetClass: query.assetClass,
      timeframe: "1d",
      timestamp: b.t,
      open: String(b.o),
      high: String(b.h),
      low: String(b.l),
      close: String(b.c),
      volume: String(b.v),
      provenance: provenance({
        source: "alpaca-bars",
        provider: "alpaca_data",
        retrievedAt,
        dataTimestamp: b.t,
        instrument: query.instrument,
        sourceRef: url,
      }),
    }));
  }

  private headers(): Record<string, string> {
    return {
      "APCA-API-KEY-ID": this.key as string,
      "APCA-API-SECRET-KEY": this.secret as string,
    };
  }
}
