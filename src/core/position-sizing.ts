import { Money, Qty, notional, riskDistance, roundToLot } from "./money";
import type { Direction, InstrumentSpec, SizingMethod } from "./types";

export interface SizingRequest {
  method: SizingMethod;
  accountEquity: Money;
  cash: Money;
  buyingPower: Money;
  entry: string;
  stop: string;
  direction: Direction;
  instrument: InstrumentSpec;
  fixedQuantity?: string;
  fixedRisk?: Money;
  riskPct?: string;
  atr?: string;
  atrMultiplier?: string;
  portfolioRiskBudget?: Money;
  estimatedFeeBps?: string;
  estimatedSlippageBps?: string;
}

export interface SizingResult {
  method: SizingMethod;
  accountEquity: string;
  riskPct: string;
  riskAmount: string;
  entry: string;
  stop: string;
  distance: string;
  quantity: string;
  notional: string;
  estimatedFees: string;
  estimatedSlippage: string;
  totalRisk: string;
  currency: string;
  rejected?: string;
}

export function sizePosition(req: SizingRequest): SizingResult {
  const entry = new Qty(req.entry);
  const stop = new Qty(req.stop);
  if (req.direction === "long" && !stop.lt(entry)) {
    return reject(req, "long stop must be below entry");
  }
  if (req.direction === "short" && !stop.gt(entry)) {
    return reject(req, "short stop must be above entry");
  }

  const distance = riskDistance(entry, stop);
  if (distance.isZero()) return reject(req, "entry and stop cannot be equal");

  let quantity = new Qty(0);
  let intendedRisk = new Money(0, req.accountEquity.currency);

  switch (req.method) {
    case "fixed_quantity":
      quantity = new Qty(req.fixedQuantity ?? "0");
      intendedRisk = notional(distance, quantity, req.accountEquity.currency);
      break;
    case "fixed_dollar_risk":
      intendedRisk = req.fixedRisk ?? new Money(0, req.accountEquity.currency);
      quantity = intendedRisk.amount.div(distance);
      break;
    case "percent_account_risk": {
      const pct = new Qty(req.riskPct ?? "0").div(100);
      intendedRisk = req.accountEquity.mul(pct);
      quantity = intendedRisk.amount.div(distance);
      break;
    }
    case "atr": {
      const atr = new Qty(req.atr ?? "0");
      if (atr.lte(0)) return reject(req, "ATR must be positive");
      const stopDist = atr.mul(req.atrMultiplier ?? "2");
      const pct = new Qty(req.riskPct ?? "0.5").div(100);
      intendedRisk = req.accountEquity.mul(pct);
      quantity = intendedRisk.amount.div(stopDist);
      break;
    }
    case "portfolio_risk": {
      intendedRisk = req.portfolioRiskBudget ?? new Money(0, req.accountEquity.currency);
      quantity = intendedRisk.amount.div(distance);
      break;
    }
    default:
      return reject(req, `unknown sizing method: ${String(req.method)}`);
  }

  quantity = roundToLot(quantity.abs(), req.instrument.lotSize);
  if (quantity.lt(req.instrument.minQuantity)) {
    return reject(req, "sized quantity is below the instrument minimum");
  }

  const tradeNotional = notional(entry, quantity, req.accountEquity.currency);
  if (tradeNotional.gt(req.buyingPower) && req.direction === "long") {
    return reject(req, "insufficient buying power for sized quantity");
  }

  const feeBps = new Qty(req.estimatedFeeBps ?? "0").div(10_000);
  const slipBps = new Qty(req.estimatedSlippageBps ?? "0").div(10_000);
  const estimatedFees = tradeNotional.mul(feeBps);
  const estimatedSlippage = tradeNotional.mul(slipBps);
  const stopRisk = notional(distance, quantity, req.accountEquity.currency);
  const totalRisk = stopRisk.add(estimatedFees).add(estimatedSlippage);
  const riskPct = req.accountEquity.amount.isZero()
    ? "0"
    : totalRisk.amount.div(req.accountEquity.amount).mul(100).toFixed(4);

  return {
    method: req.method,
    accountEquity: req.accountEquity.amount.toString(),
    riskPct,
    riskAmount: stopRisk.amount.toString(),
    entry: entry.toString(),
    stop: stop.toString(),
    distance: distance.toString(),
    quantity: quantity.toString(),
    notional: tradeNotional.amount.toString(),
    estimatedFees: estimatedFees.amount.toString(),
    estimatedSlippage: estimatedSlippage.amount.toString(),
    totalRisk: totalRisk.amount.toString(),
    currency: req.accountEquity.currency,
  };
}

function reject(req: SizingRequest, reason: string): SizingResult {
  return {
    method: req.method,
    accountEquity: req.accountEquity.amount.toString(),
    riskPct: "0",
    riskAmount: "0",
    entry: req.entry,
    stop: req.stop,
    distance: "0",
    quantity: "0",
    notional: "0",
    estimatedFees: "0",
    estimatedSlippage: "0",
    totalRisk: "0",
    currency: req.accountEquity.currency,
    rejected: reason,
  };
}
