export type AssetClass = "equity" | "etf" | "forex" | "crypto" | "future" | "option" | "other";
export type Direction = "long" | "short";
export type AppEnvironment = "development" | "staging" | "paper" | "production";
export type DisplayMode = "demo" | "paper" | "live";
export type LiveTradingMode = "research" | "assisted" | "autonomous";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";
export type OrderSide = "buy" | "sell";
export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

export type OrderStatus =
  | "submitted"
  | "accepted"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "expired";

export type CandidateStatus =
  | "DISCOVERED"
  | "RESEARCHING"
  | "QUALIFIED"
  | "RISK_REJECTED"
  | "WAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "EXECUTED"
  | "CANCELLED";

export type StrategyLifecycle =
  | "DRAFT"
  | "RESEARCH"
  | "BACKTESTED"
  | "OUT_OF_SAMPLE"
  | "WALK_FORWARD"
  | "PAPER"
  | "APPROVED"
  | "LIVE"
  | "PAUSED"
  | "RETIRED";

export type DataFreshness = "CURRENT" | "HISTORICAL" | "STALE" | "UNKNOWN";
export type ResultKind = "historical" | "backtest" | "paper" | "live";
export type SizingMethod = "fixed_quantity" | "fixed_dollar_risk" | "percent_account_risk" | "atr" | "portfolio_risk";
export type RegimeLabel =
  | "trending"
  | "ranging"
  | "high_volatility"
  | "low_volatility"
  | "risk_on"
  | "risk_off"
  | "abnormal"
  | "uncertain";

export interface Provenance {
  source: string;
  provider: string;
  retrievedAt: string;
  dataTimestamp: string;
  instrument?: string;
  sourceRef?: string;
  agent?: string;
  model?: string;
  analysisVersion?: string;
  freshness: DataFreshness;
}

export interface Bar {
  instrument: string;
  assetClass: AssetClass;
  timeframe: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  provenance: Provenance;
}

export interface InstrumentSpec {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  currency: string;
  venue: string;
  priceDecimals: number;
  quantityDecimals: number;
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  timezone: string;
  tradingHours: string;
}

export interface AccountRef {
  userId: string;
  accountId: string;
  broker: string;
  environment: "paper" | "live";
}

export interface PositionSnapshot {
  instrument: string;
  assetClass: AssetClass;
  quantity: string;
  averagePrice: string;
  marketPrice: string;
  unrealizedPnl: string;
  sector?: string;
  currency: string;
}

export interface PortfolioSnapshot {
  accountId: string;
  equity: string;
  cash: string;
  buyingPower: string;
  realizedPnl: string;
  unrealizedPnl: string;
  dailyPnl: string;
  weeklyPnl: string;
  peakEquity: string;
  drawdown: string;
  leverage: string;
  positions: PositionSnapshot[];
  currency: string;
  asOf: string;
}

export const STRATEGY_LIFECYCLE_ORDER: StrategyLifecycle[] = [
  "DRAFT",
  "RESEARCH",
  "BACKTESTED",
  "OUT_OF_SAMPLE",
  "WALK_FORWARD",
  "PAPER",
  "APPROVED",
  "LIVE",
];

export function canAdvanceLifecycle(from: StrategyLifecycle, to: StrategyLifecycle): boolean {
  if (to === "PAUSED" || to === "RETIRED" || to === "DRAFT") return true;
  if (from === "PAUSED") return to === "PAPER" || to === "APPROVED" || to === "LIVE";
  const a = STRATEGY_LIFECYCLE_ORDER.indexOf(from);
  const b = STRATEGY_LIFECYCLE_ORDER.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b === a || b === a + 1;
}

export function assertNeverLiveByDefault(mode: DisplayMode, liveEnabled: boolean): void {
  if (mode === "live" && !liveEnabled) {
    throw new Error("LIVE mode is disabled. Explicit operator authorization is required.");
  }
}
