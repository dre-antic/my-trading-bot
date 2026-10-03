import { Money, Qty, notional } from "./money";
import type { PortfolioSnapshot, PositionSnapshot } from "./types";

export interface PortfolioIntelligence {
  totalExposure: string;
  assetClassExposure: Record<string, string>;
  currencyExposure: Record<string, string>;
  sectorExposure: Record<string, string>;
  concentration: string;
  leverage: string;
  drawdown: string;
  openPositions: number;
  largestPositionPct: string;
}

export function analyzePortfolio(snapshot: PortfolioSnapshot): PortfolioIntelligence {
  const equity = new Money(snapshot.equity, snapshot.currency);
  const assetClassExposure: Record<string, string> = {};
  const currencyExposure: Record<string, string> = {};
  const sectorExposure: Record<string, string> = {};
  let total = new Money(0, snapshot.currency);
  let largest = new Money(0, snapshot.currency);

  for (const p of snapshot.positions) {
    const n = positionNotional(p, snapshot.currency);
    total = total.add(n);
    if (n.gt(largest)) largest = n;
    assetClassExposure[p.assetClass] = addAmt(assetClassExposure[p.assetClass], n);
    currencyExposure[p.currency] = addAmt(currencyExposure[p.currency], n);
    const sector = p.sector ?? "unknown";
    sectorExposure[sector] = addAmt(sectorExposure[sector], n);
  }

  const concentration = equity.amount.isZero() ? "0" : largest.amount.div(equity.amount).mul(100).toFixed(2);
  return {
    totalExposure: total.amount.toString(),
    assetClassExposure,
    currencyExposure,
    sectorExposure,
    concentration,
    leverage: snapshot.leverage,
    drawdown: snapshot.drawdown,
    openPositions: snapshot.positions.length,
    largestPositionPct: concentration,
  };
}

export function positionNotional(p: PositionSnapshot, currency: string): Money {
  return notional(p.marketPrice, new Qty(p.quantity).abs(), currency);
}

function addAmt(prev: string | undefined, add: Money): string {
  return new Money(prev ?? "0", add.currency).add(add).amount.toString();
}

export function emptyPortfolio(accountId: string, equity: string, currency = "USD"): PortfolioSnapshot {
  return {
    accountId,
    equity,
    cash: equity,
    buyingPower: equity,
    realizedPnl: "0",
    unrealizedPnl: "0",
    dailyPnl: "0",
    weeklyPnl: "0",
    peakEquity: equity,
    drawdown: "0",
    leverage: "1",
    positions: [],
    currency,
    asOf: new Date().toISOString(),
  };
}
