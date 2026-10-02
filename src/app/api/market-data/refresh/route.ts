import { refreshInstrumentBars } from "@/server/providers/market-data-resolver";
import { withUser } from "@/server/http";

export async function POST(req: Request) {
  const body = (await req.json()) as { symbol?: string; assetClass?: "etf" | "equity" | "forex" | "crypto" };
  return withUser(async () => {
    const symbol = body.symbol ?? "SPY";
    const bars = await refreshInstrumentBars(symbol, body.assetClass ?? "etf");
    return { symbol, bars: bars.length, provider: bars[0]?.provenance.provider, source: bars[0]?.provenance.source };
  });
}
