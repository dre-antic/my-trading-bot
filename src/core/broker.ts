import type { UniversalOrder } from "./oms";
import type { PortfolioSnapshot } from "./types";

export type BrokerReadiness = "not_implemented" | "sandbox_only" | "integration_untested" | "production_ready";

export interface BrokerCapabilities {
  market: boolean;
  limit: boolean;
  stop: boolean;
  stopLimit: boolean;
  bracket: boolean;
  reduceOnly: boolean;
  paper: boolean;
  live: boolean;
}

export interface BrokerAccount {
  brokerAccountId: string;
  currency: string;
  cash: string;
  equity: string;
  buyingPower: string;
  patternDayTrader?: boolean;
}

export interface BrokerPosition {
  instrument: string;
  quantity: string;
  averagePrice: string;
  marketPrice: string;
}

export interface SubmitOrderRequest {
  clientOrderId: string;
  instrument: string;
  side: "buy" | "sell";
  type: UniversalOrder["type"];
  timeInForce: UniversalOrder["timeInForce"];
  quantity: string;
  limitPrice?: string;
  stopPrice?: string;
  reduceOnly?: boolean;
}

export interface BrokerHealth {
  ok: boolean;
  latencyMs: number;
  message: string;
  paper: boolean;
}

export interface BrokerAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly readiness: BrokerReadiness;
  readonly capabilities: BrokerCapabilities;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<BrokerHealth>;
  getAccount(): Promise<BrokerAccount>;
  getPositions(): Promise<BrokerPosition[]>;
  getOrders(): Promise<UniversalOrder[]>;
  getMarketData(instrument: string): Promise<{ bid: string; ask: string; last: string; timestamp: string }>;
  submitOrder(req: SubmitOrderRequest): Promise<UniversalOrder>;
  cancelOrder(brokerOrderId: string): Promise<UniversalOrder>;
  modifyOrder(brokerOrderId: string, patch: Partial<SubmitOrderRequest>): Promise<UniversalOrder>;
  getOrderStatus(brokerOrderId: string): Promise<UniversalOrder>;
  reconcile(): Promise<{ orders: UniversalOrder[]; positions: BrokerPosition[] }>;
}

export const BROKER_REGISTRY: Array<{
  id: string;
  displayName: string;
  readiness: BrokerReadiness;
  notes: string;
}> = [
  {
    id: "paper",
    displayName: "Internal Paper Broker",
    readiness: "sandbox_only",
    notes: "Fully implemented simulated broker. All values are labeled paper/simulated.",
  },
  {
    id: "alpaca_paper",
    displayName: "Alpaca Paper",
    readiness: "integration_untested",
    notes: "Real HTTP adapter to Alpaca paper trading. Not marked production-ready. Requires user keys.",
  },
  {
    id: "interactive_brokers",
    displayName: "Interactive Brokers",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Not implemented.",
  },
  {
    id: "oanda",
    displayName: "OANDA",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Not implemented.",
  },
  {
    id: "mt5",
    displayName: "MetaTrader 5",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Not implemented.",
  },
  {
    id: "ctrader",
    displayName: "cTrader",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Not implemented.",
  },
  {
    id: "binance",
    displayName: "Binance",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Original repo used CCXT sandbox. Not implemented here.",
  },
  {
    id: "coinbase",
    displayName: "Coinbase",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Not implemented.",
  },
  {
    id: "kraken",
    displayName: "Kraken",
    readiness: "not_implemented",
    notes: "Adapter interface reserved. Not implemented.",
  },
];

export function assertPaperOrAuthorizedLive(environment: "paper" | "live", liveEnabled: boolean): void {
  if (environment === "live" && !liveEnabled) {
    throw new Error("Refusing live broker access. LIVE execution is disabled.");
  }
}

export function snapshotFromBroker(
  accountId: string,
  account: BrokerAccount,
  positions: BrokerPosition[],
  extras: Partial<PortfolioSnapshot> = {},
): PortfolioSnapshot {
  return {
    accountId,
    equity: account.equity,
    cash: account.cash,
    buyingPower: account.buyingPower,
    realizedPnl: extras.realizedPnl ?? "0",
    unrealizedPnl: extras.unrealizedPnl ?? "0",
    dailyPnl: extras.dailyPnl ?? "0",
    weeklyPnl: extras.weeklyPnl ?? "0",
    peakEquity: extras.peakEquity ?? account.equity,
    drawdown: extras.drawdown ?? "0",
    leverage: extras.leverage ?? "1",
    currency: account.currency,
    asOf: extras.asOf ?? new Date().toISOString(),
    positions: positions.map((p) => ({
      instrument: p.instrument,
      assetClass: "other",
      quantity: p.quantity,
      averagePrice: p.averagePrice,
      marketPrice: p.marketPrice,
      unrealizedPnl: "0",
      currency: account.currency,
    })),
  };
}
