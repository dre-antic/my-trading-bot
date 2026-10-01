import { constitutionAllowsAssetClass, constitutionAllowsBroker, constitutionAllowsMarket, constitutionAllowsStrategy, pctOf, type Constitution } from "./constitution";
import { Money, Qty } from "./money";
import { isStale, parseUtc } from "./time";
import type { Direction, InstrumentSpec, PortfolioSnapshot } from "./types";
import type { SizingResult } from "./position-sizing";

export type RiskDecision = "APPROVED" | "REJECTED";

export interface RiskCheckRequest {
  constitution: Constitution;
  now: Date;
  userId: string;
  accountId: string;
  broker: string;
  environment: "paper" | "live";
  liveEnabled: boolean;
  autonomousEnabled: boolean;
  tradingMode: "research" | "assisted" | "autonomous";
  displayMode: "demo" | "paper" | "live";
  strategyId: string;
  strategyVersion: number;
  instrument: InstrumentSpec;
  market: string;
  direction: Direction;
  sizing: SizingResult;
  portfolio: PortfolioSnapshot;
  dataTimestamp: string;
  signalTimestamp: string;
  spreadBps?: string;
  expectedSlippageBps?: string;
  liquidityNotional?: string;
  withinTradingHours: boolean;
  newsRestricted: boolean;
  duplicateClientOrderId?: string;
  existingOpenOrderForInstrument?: boolean;
  stopPresent: boolean;
}

export interface RiskViolation {
  code: string;
  message: string;
}

export interface RiskFirewallResult {
  decision: RiskDecision;
  violations: RiskViolation[];
  checkedAt: string;
  constitutionVersion: number;
}

export function evaluateRiskFirewall(req: RiskCheckRequest): RiskFirewallResult {
  const violations: RiskViolation[] = [];
  const equity = new Money(req.portfolio.equity, req.portfolio.currency);

  if (req.constitution.emergencyHalt) {
    violations.push({ code: "EMERGENCY_HALT", message: "Trading Constitution emergency halt is active." });
  }
  if (req.tradingMode === "research") {
    violations.push({ code: "RESEARCH_MODE", message: "Research mode cannot submit orders." });
  }
  if (req.environment === "live" || req.displayMode === "live") {
    if (!req.liveEnabled) {
      violations.push({ code: "LIVE_DISABLED", message: "Live trading is disabled by environment policy." });
    }
  }
  if (req.tradingMode === "autonomous" && !req.autonomousEnabled) {
    violations.push({ code: "AUTONOMOUS_DISABLED", message: "Autonomous trading is disabled." });
  }
  if (req.sizing.rejected) {
    violations.push({ code: "SIZING_REJECTED", message: req.sizing.rejected });
  }
  if (!constitutionAllowsBroker(req.constitution, req.broker)) {
    violations.push({ code: "BROKER_NOT_PERMITTED", message: `Broker ${req.broker} is not permitted.` });
  }
  if (!constitutionAllowsStrategy(req.constitution, req.strategyId)) {
    violations.push({ code: "STRATEGY_NOT_PERMITTED", message: `Strategy ${req.strategyId} is not permitted.` });
  }
  if (!constitutionAllowsAssetClass(req.constitution, req.instrument.assetClass)) {
    violations.push({
      code: "ASSET_CLASS_NOT_PERMITTED",
      message: `Asset class ${req.instrument.assetClass} is not permitted.`,
    });
  }
  if (!constitutionAllowsMarket(req.constitution, req.market)) {
    violations.push({ code: "MARKET_NOT_PERMITTED", message: `Market ${req.market} is not permitted.` });
  }
  if (!req.withinTradingHours && req.constitution.permittedTradingHours !== "always") {
    violations.push({ code: "OUTSIDE_HOURS", message: "Instrument is outside permitted trading hours." });
  }
  if (req.newsRestricted) {
    violations.push({ code: "NEWS_RESTRICTED", message: "A high-impact news restriction is active." });
  }
  if (req.constitution.requireStopLoss && !req.stopPresent) {
    violations.push({ code: "STOP_REQUIRED", message: "A stop loss is required by the Trading Constitution." });
  }

  const dataTs = parseUtc(req.dataTimestamp);
  const signalTs = parseUtc(req.signalTimestamp);
  if (isStale(dataTs, req.now, req.constitution.maxDataAgeSeconds * 1000)) {
    violations.push({ code: "STALE_DATA", message: "Market data is older than the constitution allows." });
  }
  if (isStale(signalTs, req.now, req.constitution.maxSignalAgeSeconds * 1000)) {
    violations.push({ code: "STALE_SIGNAL", message: "The trade signal is older than the constitution allows." });
  }

  const totalRisk = new Money(req.sizing.totalRisk || "0", req.portfolio.currency);
  const maxTradePct = pctOf(equity, req.constitution.maxRiskPerTradePct);
  const maxTradeAmt = new Money(req.constitution.maxRiskPerTradeAmount, req.portfolio.currency);
  const tradeCap = maxTradePct.lt(maxTradeAmt) ? maxTradePct : maxTradeAmt;
  if (totalRisk.gt(tradeCap)) {
    violations.push({
      code: "TRADE_RISK_LIMIT",
      message: `Total risk ${totalRisk.toFixed(2)} exceeds per-trade cap ${tradeCap.toFixed(2)}.`,
    });
  }

  const dailyLoss = new Money(req.portfolio.dailyPnl, req.portfolio.currency);
  if (dailyLoss.isNegative() && dailyLoss.abs().gt(pctOf(equity, req.constitution.maxDailyLossPct))) {
    violations.push({ code: "DAILY_LOSS_LIMIT", message: "Daily loss limit has been reached." });
  }
  const weeklyLoss = new Money(req.portfolio.weeklyPnl, req.portfolio.currency);
  if (weeklyLoss.isNegative() && weeklyLoss.abs().gt(pctOf(equity, req.constitution.maxWeeklyLossPct))) {
    violations.push({ code: "WEEKLY_LOSS_LIMIT", message: "Weekly loss limit has been reached." });
  }
  const drawdown = new Qty(req.portfolio.drawdown);
  if (drawdown.gte(req.constitution.maxDrawdownPct)) {
    violations.push({ code: "MAX_DRAWDOWN", message: "Maximum drawdown limit has been reached." });
  }
  const leverage = new Qty(req.portfolio.leverage);
  if (leverage.gt(req.constitution.maxLeverage)) {
    violations.push({ code: "LEVERAGE_LIMIT", message: "Portfolio leverage exceeds the constitution." });
  }

  const orderNotional = new Money(req.sizing.notional || "0", req.portfolio.currency);
  if (orderNotional.gt(new Money(req.constitution.maxOrderNotional, req.portfolio.currency))) {
    violations.push({ code: "ORDER_SIZE", message: "Order notional exceeds the maximum order size." });
  }

  const exposureAfter = orderNotional.add(notionalOfOpen(req.portfolio));
  if (exposureAfter.gt(pctOf(equity, req.constitution.maxPortfolioExposurePct))) {
    violations.push({ code: "PORTFOLIO_EXPOSURE", message: "Trade would exceed maximum portfolio exposure." });
  }

  const instrumentExposure = instrumentNotional(req.portfolio, req.instrument.symbol).add(orderNotional);
  if (instrumentExposure.gt(pctOf(equity, req.constitution.maxInstrumentExposurePct))) {
    violations.push({ code: "INSTRUMENT_EXPOSURE", message: "Trade would exceed maximum instrument exposure." });
  }

  const correlated = correlatedNotional(req.portfolio, req.instrument).add(orderNotional);
  if (correlated.gt(pctOf(equity, req.constitution.maxCorrelatedExposurePct))) {
    violations.push({ code: "CORRELATED_EXPOSURE", message: "Trade would exceed maximum correlated exposure." });
  }

  if (req.portfolio.positions.length >= req.constitution.maxSimultaneousPositions) {
    const alreadyOpen = req.portfolio.positions.some((p) => p.instrument === req.instrument.symbol);
    if (!alreadyOpen) {
      violations.push({
        code: "MAX_POSITIONS",
        message: "Maximum number of simultaneous positions has been reached.",
      });
    }
  }

  if (req.spreadBps && new Qty(req.spreadBps).gt(req.constitution.maxSpreadBps)) {
    violations.push({ code: "SPREAD", message: "Quoted spread exceeds the constitution maximum." });
  }
  if (req.expectedSlippageBps && new Qty(req.expectedSlippageBps).gt(req.constitution.maxSlippageBps)) {
    violations.push({ code: "SLIPPAGE", message: "Expected slippage exceeds the constitution maximum." });
  }
  if (
    req.liquidityNotional &&
    new Money(req.liquidityNotional, req.portfolio.currency).lt(
      new Money(req.constitution.minLiquidityNotional, req.portfolio.currency),
    )
  ) {
    violations.push({ code: "LIQUIDITY", message: "Instrument liquidity is below the constitution minimum." });
  }
  if (req.existingOpenOrderForInstrument) {
    violations.push({ code: "DUPLICATE_ORDER", message: "An open order already exists for this instrument." });
  }
  if (new Money(req.sizing.notional || "0", req.portfolio.currency).gt(new Money(req.portfolio.buyingPower, req.portfolio.currency))) {
    violations.push({ code: "BUYING_POWER", message: "Insufficient buying power." });
  }
  if (new Qty(req.sizing.quantity || "0").lte(0)) {
    violations.push({ code: "ZERO_QUANTITY", message: "Position size is zero." });
  }

  return {
    decision: violations.length === 0 ? "APPROVED" : "REJECTED",
    violations,
    checkedAt: req.now.toISOString(),
    constitutionVersion: req.constitution.version,
  };
}

function notionalOfOpen(portfolio: PortfolioSnapshot): Money {
  return portfolio.positions.reduce(
    (sum, p) => sum.add(new Money(new Qty(p.marketPrice).mul(new Qty(p.quantity).abs()), portfolio.currency)),
    new Money(0, portfolio.currency),
  );
}

function instrumentNotional(portfolio: PortfolioSnapshot, symbol: string): Money {
  return portfolio.positions
    .filter((p) => p.instrument === symbol)
    .reduce(
      (sum, p) => sum.add(new Money(new Qty(p.marketPrice).mul(new Qty(p.quantity).abs()), portfolio.currency)),
      new Money(0, portfolio.currency),
    );
}

function correlatedNotional(portfolio: PortfolioSnapshot, instrument: InstrumentSpec): Money {
  return portfolio.positions
    .filter((p) => p.assetClass === instrument.assetClass || p.currency === instrument.currency)
    .reduce(
      (sum, p) => sum.add(new Money(new Qty(p.marketPrice).mul(new Qty(p.quantity).abs()), portfolio.currency)),
      new Money(0, portfolio.currency),
    );
}
