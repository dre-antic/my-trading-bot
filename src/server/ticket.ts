import { evaluateRiskFirewall } from "@/core/risk-firewall";
import { sizePosition } from "@/core/position-sizing";
import { Money } from "@/core/money";
import { ids } from "@/core/ids";
import { toIsoUtc } from "@/core/time";
import { isMarketOpen } from "@/core/calendar";
import { parseStrategy } from "@/core/strategy";
import type { UniversalOrder } from "@/core/oms";
import type { BrokerAdapter, SubmitOrderRequest } from "@/core/broker";
import { assertNoFakeProductionData } from "@/core/market-data";
import { getDb } from "@/db/client";
import { AlpacaLiveAdapter } from "./alpaca-live";
import { OandaAdapter } from "./oanda";
import { loadConfig } from "./config";
import { assertCanPlaceLiveOrder, getLiveControl, recordBrokerError, recordBrokerSuccess } from "./live-control";
import {
  applyPaperMarketOrder,
  barsFor,
  flags,
  getInstrument,
  latestConstitution,
  portfolioOf,
  primaryAccount,
} from "./trading-service";

export interface TicketRequest {
  instrument: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  quantity: string;
  stopLoss?: string;
  takeProfit?: string;
  limitPrice?: string;
  stopPrice?: string;
  livePhrase?: string;
  strategyId?: string;
}

export function defaultProtectiveStop(side: "buy" | "sell", last: string): string {
  const px = Number(last);
  if (!Number.isFinite(px) || px <= 0) return "0";
  return (side === "buy" ? px * 0.99 : px * 1.01).toFixed(6);
}

export async function submitTicket(
  userId: string,
  ticket: TicketRequest,
  execution: "paper" | "live",
): Promise<{ orderId?: string; order?: UniversalOrder; resultKind: "paper" | "live"; status?: string }> {
  if (execution === "live") return submitLiveTicket(userId, ticket);
  return submitPaperTicket(userId, ticket);
}

export function submitPaperTicket(userId: string, ticket: TicketRequest): { orderId: string; resultKind: "paper"; status: string } {
  const runtime = flags(userId);
  if (runtime.stop_new_trades) throw new Error("Stop-new-trades is active.");
  if (runtime.trading_mode === "research") throw new Error("Research mode cannot execute.");
  const constitution = latestConstitution(userId);
  const inst = getInstrument(ticket.instrument);
  const port = portfolioOf(userId);
  const bars = barsFor(ticket.instrument, inst.assetClass);
  const provider = bars[0]?.provenance.provider ?? "unknown";
  if (runtime.display_mode !== "demo") {
    assertNoFakeProductionData("paper", provider === "demo" ? "synthetic" : provider);
  }
  const last = bars[bars.length - 1]?.close ?? ticket.limitPrice ?? "0";
  const stop = ticket.stopLoss ?? defaultProtectiveStop(ticket.side, last);
  const sizing = sizePosition({
    method: "fixed_quantity",
    accountEquity: new Money(port.equity, port.currency),
    cash: new Money(port.cash, port.currency),
    buyingPower: new Money(port.buyingPower, port.currency),
    entry: last,
    stop,
    direction: ticket.side === "buy" ? "long" : "short",
    instrument: inst,
    fixedQuantity: ticket.quantity,
    estimatedFeeBps: "1",
    estimatedSlippageBps: "2",
  });
  const account = primaryAccount(userId);
  const risk = evaluateRiskFirewall({
    constitution,
    now: new Date(),
    userId,
    accountId: account.id,
    broker: "paper",
    environment: "paper",
    liveEnabled: false,
    autonomousEnabled: false,
    tradingMode: runtime.trading_mode,
    displayMode: runtime.display_mode === "live" ? "paper" : runtime.display_mode,
    strategyId: ticket.strategyId ?? "manual_ticket",
    strategyVersion: 1,
    instrument: inst,
    market: inst.venue,
    direction: ticket.side === "buy" ? "long" : "short",
    sizing,
    portfolio: port,
    dataTimestamp: runtime.display_mode === "demo" ? new Date().toISOString() : (bars[bars.length - 1]?.timestamp ?? new Date().toISOString()),
    signalTimestamp: new Date().toISOString(),
    withinTradingHours: isMarketOpen(inst.assetClass, new Date()) || inst.assetClass === "crypto" || runtime.display_mode === "demo",
    newsRestricted: false,
    stopPresent: Boolean(stop && Number(stop) > 0),
    lastPrice: last,
    limitPrice: ticket.limitPrice,
    stopLossPrice: stop,
    takeProfitPrice: ticket.takeProfit,
  });
  if (risk.decision !== "APPROVED") {
    throw new Error(`Risk firewall rejected paper ticket: ${risk.violations.map((v) => v.message).join("; ")}`);
  }
  const applied = applyPaperMarketOrder(userId, {
    instrument: ticket.instrument,
    side: ticket.side,
    type: ticket.type,
    quantity: ticket.quantity,
    expectedPrice: last,
    limitPrice: ticket.limitPrice,
    stopPrice: ticket.stopPrice,
    strategyId: ticket.strategyId,
  });
  getDb()
    .prepare(
      "INSERT INTO journal_entries (id, user_id, account_id, candidate_id, order_id, strategy_id, strategy_version, thesis, entry_price, stop_price, target_price, actual_entry, actual_exit, result, regime, ai_reasoning, user_decision, execution_quality, result_kind, simulated, created_at) VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, NULL, 'paper', 1, ?)",
    )
    .run(
      ids.journal(),
      userId,
      applied.accountId,
      applied.orderId,
      `Paper ${ticket.side} ${ticket.instrument} (simulated)`,
      last,
      stop,
      ticket.takeProfit ?? null,
      "Human paper ticket. AI had no execution authority.",
      "approved-paper",
      toIsoUtc(),
    );
  return { orderId: applied.orderId, resultKind: "paper", status: applied.status };
}

export function selectLiveAdapter(instrument: string): BrokerAdapter {
  const spec = getInstrument(instrument);
  const cfg = loadConfig();
  if (spec.assetClass === "forex") {
    if (cfg.oandaEnv === "live" && cfg.oandaToken) return new OandaAdapter("live");
    throw new Error("Forex live requires OANDA_ENV=live plus OANDA_API_TOKEN and OANDA_ACCOUNT_ID.");
  }
  if (!cfg.alpacaLiveKey) throw new Error("Alpaca live keys are not configured. Refusing to invent a live order.");
  return new AlpacaLiveAdapter();
}

export async function submitLiveTicket(userId: string, ticket: TicketRequest): Promise<{ order: UniversalOrder; resultKind: "live" }> {
  assertCanPlaceLiveOrder(userId, ticket.livePhrase ?? "");
  const runtime = flags(userId);
  const constitution = latestConstitution(userId);
  const inst = getInstrument(ticket.instrument);
  const port = portfolioOf(userId);
  const bars = barsFor(ticket.instrument, inst.assetClass);
  assertNoFakeProductionData("live", bars[0]?.provenance.provider === "demo" ? "synthetic" : bars[0]?.provenance.provider ?? "unknown");
  const last = bars[bars.length - 1]?.close ?? ticket.limitPrice ?? "0";
  const stop = ticket.stopLoss ?? (ticket.side === "buy" ? String(Number(last) * 0.99) : String(Number(last) * 1.01));
  const sizing = sizePosition({
    method: "fixed_quantity",
    accountEquity: new Money(port.equity, port.currency),
    cash: new Money(port.cash, port.currency),
    buyingPower: new Money(port.buyingPower, port.currency),
    entry: last,
    stop,
    direction: ticket.side === "buy" ? "long" : "short",
    instrument: inst,
    fixedQuantity: ticket.quantity,
    estimatedFeeBps: "1",
    estimatedSlippageBps: "2",
  });
  const account = primaryAccount(userId);
  const risk = evaluateRiskFirewall({
    constitution,
    now: new Date(),
    userId,
    accountId: account.id,
    broker: inst.assetClass === "forex" ? "oanda_live" : "alpaca_live",
    environment: "live",
    liveEnabled: loadConfig().liveEnabled && getLiveControl(userId).liveEnabled,
    autonomousEnabled: false,
    tradingMode: runtime.trading_mode,
    displayMode: runtime.display_mode,
    strategyId: ticket.strategyId ?? "manual_ticket",
    strategyVersion: 1,
    instrument: inst,
    market: inst.venue,
    direction: ticket.side === "buy" ? "long" : "short",
    sizing,
    portfolio: port,
    dataTimestamp: bars[bars.length - 1]?.timestamp ?? new Date().toISOString(),
    signalTimestamp: new Date().toISOString(),
    withinTradingHours: isMarketOpen(inst.assetClass, new Date()) || inst.assetClass === "crypto",
    newsRestricted: false,
    stopPresent: Boolean(ticket.stopLoss),
    lastPrice: last,
    limitPrice: ticket.limitPrice,
    stopLossPrice: ticket.stopLoss,
    takeProfitPrice: ticket.takeProfit,
  });
  if (risk.decision !== "APPROVED") {
    throw new Error(`Risk firewall rejected live ticket: ${risk.violations.map((v) => v.message).join("; ")}`);
  }
  const adapter = selectLiveAdapter(ticket.instrument);
  const req: SubmitOrderRequest = {
    clientOrderId: ids.clientOrder(),
    instrument: ticket.instrument,
    side: ticket.side,
    type: ticket.type,
    timeInForce: "day",
    quantity: ticket.quantity,
    limitPrice: ticket.limitPrice,
    stopPrice: ticket.stopPrice,
    takeProfitPrice: ticket.takeProfit,
    stopLossPrice: ticket.stopLoss,
  };
  try {
    const order = await adapter.submitOrder(req);
    recordBrokerSuccess(userId);
    persistExternalOrder(userId, account.id, order, ticket.takeProfit);
    getDb()
      .prepare(
        "INSERT INTO journal_entries (id, user_id, account_id, candidate_id, order_id, strategy_id, strategy_version, thesis, entry_price, stop_price, target_price, actual_entry, actual_exit, result, regime, ai_reasoning, user_decision, execution_quality, result_kind, simulated, created_at) VALUES (?, ?, ?, NULL, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, NULL, 'live', 0, ?)",
      )
      .run(
        ids.journal(),
        userId,
        account.id,
        order.orderId,
        `Live ${ticket.side} ${ticket.instrument} via ${adapter.id}`,
        last,
        ticket.stopLoss ?? null,
        ticket.takeProfit ?? null,
        "Human live ticket. AI had no execution authority.",
        "approved-live",
        toIsoUtc(),
      );
    return { order, resultKind: "live" };
  } catch (error) {
    recordBrokerError(userId, error instanceof Error ? error.message : "live broker error");
    throw error;
  }
}

function persistExternalOrder(userId: string, accountId: string, order: UniversalOrder, takeProfit?: string): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO orders (id, user_id, account_id, broker, environment, strategy_id, strategy_version, candidate_id, client_order_id, broker_order_id, instrument, side, type, tif, quantity, filled_quantity, limit_price, stop_price, status, expected_price, reject_reason, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      order.orderId,
      userId,
      accountId,
      order.broker,
      order.environment,
      order.strategyId ?? null,
      order.strategyVersion ?? null,
      order.candidateId ?? null,
      order.clientOrderId,
      order.brokerOrderId ?? null,
      order.instrument,
      order.side,
      order.type,
      order.timeInForce,
      order.quantity,
      order.filledQuantity,
      order.limitPrice ?? null,
      order.stopPrice ?? null,
      order.status,
      takeProfit ?? order.expectedPrice ?? null,
      order.rejectReason ?? null,
      order.submittedAt,
      order.updatedAt,
    );
}

export function listExperts(userId: string) {
  return getDb().prepare("SELECT * FROM expert_attachments WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

export function attachExpert(userId: string, strategyId: string, symbol: string) {
  const row = getDb()
    .prepare(
      `SELECT v.payload FROM strategy_versions v
       JOIN strategies s ON s.id = v.strategy_id
       WHERE v.strategy_id = ? AND s.user_id = ?
       ORDER BY v.version DESC LIMIT 1`,
    )
    .get(strategyId, userId) as { payload: string } | undefined;
  if (!row) throw new Error("strategy not found");
  parseStrategy(JSON.parse(row.payload));
  getInstrument(symbol);
  const id = ids.deployment();
  getDb()
    .prepare("INSERT INTO expert_attachments (id, user_id, strategy_id, symbol, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)")
    .run(id, userId, strategyId, symbol, toIsoUtc());
  return { id };
}

export function setExpertEnabled(userId: string, id: string, enabled: boolean) {
  getDb().prepare("UPDATE expert_attachments SET enabled = ? WHERE id = ? AND user_id = ?").run(enabled ? 1 : 0, id, userId);
}
