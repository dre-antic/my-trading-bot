import { LIVE_PHRASES } from "@/core/live-safety";
import { getDb } from "@/db/client";
import { liveStatus } from "./live-control";
import { attachExpert, listExperts, setExpertEnabled } from "./ticket";
import {
  barsFor,
  flags,
  getInstrument,
  listInstruments,
  listStrategies,
  portfolioOf,
  scanStrategy,
} from "./trading-service";

export function quoteFor(symbol: string) {
  const inst = getInstrument(symbol);
  const bars = barsFor(symbol, inst.assetClass);
  const lastBar = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  const last = Number(lastBar?.close ?? 0);
  const prior = Number(prev?.close ?? last);
  const changePct = prior ? ((last - prior) / prior) * 100 : 0;
  const spread = inst.assetClass === "forex" ? last * 0.00008 : last * 0.0004;
  return {
    symbol,
    assetClass: inst.assetClass,
    venue: inst.venue,
    last: lastBar?.close ?? "0",
    bid: (last - spread / 2).toFixed(inst.assetClass === "forex" ? 5 : 4),
    ask: (last + spread / 2).toFixed(inst.assetClass === "forex" ? 5 : 4),
    changePct: changePct.toFixed(2),
    timestamp: lastBar?.timestamp ?? null,
    provider: lastBar?.provenance.provider ?? "unknown",
    bars: bars.slice(-180).map((b) => ({
      t: b.timestamp,
      o: b.open,
      h: b.high,
      l: b.low,
      c: b.close,
      v: b.volume,
    })),
  };
}

export function terminalSnapshot(userId: string, symbol = "SPY") {
  const watch = listInstruments().map((inst) => {
    const q = quoteFor(inst.symbol);
    return {
      symbol: inst.symbol,
      assetClass: inst.assetClass,
      venue: inst.venue,
      last: q.last,
      bid: q.bid,
      ask: q.ask,
      changePct: q.changePct,
      provider: q.provider,
    };
  });
  const selected = watch.some((w) => w.symbol === symbol) ? symbol : watch[0]?.symbol ?? "SPY";
  const chart = quoteFor(selected);
  const port = portfolioOf(userId);
  const db = getDb();
  const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 40").all(userId);
  const fills = db
    .prepare(
      "SELECT f.* FROM fills f JOIN orders o ON o.id = f.order_id WHERE o.user_id = ? ORDER BY f.filled_at DESC LIMIT 40",
    )
    .all(userId);
  return {
    symbol: selected,
    watch,
    chart,
    portfolio: port,
    orders,
    fills,
    experts: listExperts(userId),
    strategies: listStrategies(userId).map((s) => ({
      strategyId: s.strategyId,
      name: s.name,
      lifecycle: s.lifecycle,
      instruments: s.instruments,
    })),
    flags: flags(userId),
    live: liveStatus(userId),
    phrases: LIVE_PHRASES,
    oneClickPaper: true,
    oneClickLive: false,
  };
}

export function runAttachedExperts(userId: string, symbol?: string) {
  const rows = listExperts(userId) as Array<{ strategy_id: string; symbol: string; enabled: number }>;
  const created = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    if (symbol && row.symbol !== symbol) continue;
    created.push(...scanStrategy(userId, row.strategy_id));
  }
  return created;
}

export function attachExpertToChart(userId: string, strategyId: string, symbol: string) {
  getInstrument(symbol);
  return attachExpert(userId, strategyId, symbol);
}

export function toggleExpert(userId: string, id: string, enabled: boolean) {
  setExpertEnabled(userId, id, enabled);
}
