import { assertNoFakeProductionData, synthesizeDemoBars, type MarketDataProvider } from "@/core/market-data";
import type { AssetClass, Bar, DisplayMode } from "@/core/types";
import { ids } from "@/core/ids";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { loadConfig } from "../config";
import { AlpacaDataProvider } from "./alpaca-data";
import { StooqProvider } from "./stooq";

const memory = new Map<string, Bar[]>();

export function configuredProvider(): MarketDataProvider {
  const name = process.env.MARKETDATA_PROVIDER ?? "stooq";
  if (name === "alpaca") return new AlpacaDataProvider();
  if (name === "demo") {
    return {
      id: "demo",
      displayName: "Demo synthetic",
      async healthCheck() {
        return { ok: true, message: "demo provider (synthetic, labeled)" };
      },
      async getBars(query) {
        return synthesizeDemoBars(query.instrument, query.assetClass);
      },
    };
  }
  return new StooqProvider();
}

export function barsFromCacheOrDemo(symbol: string, assetClass: AssetClass, mode?: DisplayMode): Bar[] {
  const cached = memory.get(symbol) ?? readPersisted(symbol);
  if (cached?.length) {
    memory.set(symbol, cached);
    return cached;
  }
  const display = mode ?? loadConfig().displayModeDefault;
  if (display === "demo" || process.env.MARKETDATA_PROVIDER === "demo") {
    return synthesizeDemoBars(symbol, assetClass, 240, symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0));
  }
  assertNoFakeProductionData(display, "synthetic");
  throw new Error(`No cached market data for ${symbol}. Refresh Stooq/Alpaca data before paper/live use.`);
}

export async function refreshInstrumentBars(symbol: string, assetClass: AssetClass): Promise<Bar[]> {
  const provider = configuredProvider();
  const mode = loadConfig().displayModeDefault;
  if (mode !== "demo") assertNoFakeProductionData(mode, provider.id === "demo" ? "synthetic" : provider.id);
  const bars = await provider.getBars({ instrument: symbol, assetClass, timeframe: "1d", limit: 250 });
  memory.set(symbol, bars);
  persist(symbol, bars);
  return bars;
}

function persist(symbol: string, bars: Bar[]): void {
  const db = getDb();
  db.prepare("DELETE FROM market_bar_cache WHERE symbol = ?").run(symbol);
  db.prepare(
    "INSERT INTO market_bar_cache (id, symbol, payload, provider, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(ids.dataSource(), symbol, JSON.stringify(bars), bars[0]?.provenance.provider ?? "unknown", toIsoUtc());
}

export function cachedSymbols(): string[] {
  const fromMemory = [...memory.keys()];
  try {
    const rows = getDb().prepare("SELECT DISTINCT symbol FROM market_bar_cache").all() as Array<{ symbol: string }>;
    return [...new Set([...fromMemory, ...rows.map((r) => r.symbol)])];
  } catch {
    return fromMemory;
  }
}

export function cacheProvenance(symbol: string) {
  const bars = memory.get(symbol) ?? readPersisted(symbol);
  return bars?.[0]?.provenance;
}

function readPersisted(symbol: string): Bar[] | undefined {
  try {
    const row = getDb().prepare("SELECT payload FROM market_bar_cache WHERE symbol = ? ORDER BY created_at DESC LIMIT 1").get(symbol) as
      | { payload: string }
      | undefined;
    if (!row) return undefined;
    return JSON.parse(row.payload) as Bar[];
  } catch {
    return undefined;
  }
}
