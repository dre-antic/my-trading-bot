import { cacheProvenance, cachedSymbols, configuredProvider } from "@/server/providers/market-data-resolver";
import { withUser } from "@/server/http";
import { getDb } from "@/db/client";

export async function GET() {
  return withUser(() => {
    const provider = configuredProvider();
    const symbols = cachedSymbols();
    const sources = getDb().prepare("SELECT provider, readiness, notes FROM market_data_sources").all();
    return {
      provider: { id: provider.id, displayName: provider.displayName },
      mode: process.env.ATCC_DISPLAY_MODE ?? "demo",
      cached: symbols.map((symbol) => ({ symbol, provenance: cacheProvenance(symbol) })),
      sources,
    };
  });
}
