import { computeStopTarget, evaluateStrategyCompliance, type StrategyDefinition } from "./strategy";
import { classifyRegime } from "./regime";
import { atr, lastDefined } from "./indicators";
import { Qty } from "./money";
import { buildIndicatorSet } from "./strategy-context";
import { evaluateRule } from "./dsl";
import type { Bar, Direction, ResultKind } from "./types";

export interface BacktestCosts {
  commissionBps: string;
  spreadBps: string;
  slippageBps: string;
  financingBpsPerDay?: string;
}

export interface BacktestTrade {
  instrument: string;
  direction: Direction;
  entryTime: string;
  exitTime: string;
  entry: string;
  exit: string;
  quantity: string;
  pnl: string;
  returnPct: string;
  barsHeld: number;
  reason: string;
  regime: string;
}

export interface BacktestMetrics {
  resultKind: ResultKind;
  startingEquity: string;
  endingEquity: string;
  totalReturn: string;
  annualizedReturn: string;
  volatility: string;
  sharpe: string;
  sortino: string;
  calmar: string;
  maxDrawdown: string;
  maxDrawdownDurationBars: number;
  winRate: string;
  lossRate: string;
  profitFactor: string;
  expectancy: string;
  averageWin: string;
  averageLoss: string;
  trades: number;
  exposure: string;
  turnover: string;
  equityCurve: Array<{ t: string; equity: string; drawdown: string }>;
}

export interface BacktestResult {
  strategyId: string;
  strategyVersion: number;
  instrument: string;
  from: string;
  to: string;
  costs: BacktestCosts;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  warnings: string[];
}

export interface BacktestRequest {
  strategy: StrategyDefinition;
  bars: Bar[];
  startingEquity?: string;
  quantity?: string;
  costs?: Partial<BacktestCosts>;
  fillOn: "next_open" | "close";
  resultKind?: ResultKind;
}

const DEFAULT_COSTS: BacktestCosts = {
  commissionBps: "1",
  spreadBps: "1",
  slippageBps: "1",
};

export function runBacktest(req: BacktestRequest): BacktestResult {
  const costs = { ...DEFAULT_COSTS, ...req.costs };
  const quantity = new Qty(req.quantity ?? "1");
  const warnings: string[] = [];
  if (req.strategy.educational) {
    warnings.push("This is an educational infrastructure strategy. Historical results are not a performance claim.");
  }
  warnings.push("Backtest results are historical simulations, not live results.");

  const trades: BacktestTrade[] = [];
  let equity = new Qty(req.startingEquity ?? "100000");
  const startEquity = equity;
  const curve: BacktestMetrics["equityCurve"] = [];
  let peak = equity;
  let maxDd = new Qty(0);
  let ddBars = 0;
  let maxDdBars = 0;
  let exposedBars = 0;
  let open:
    | {
        direction: Direction;
        entry: Qty;
        entryTime: string;
        stop: Qty;
        target: Qty;
        barsHeld: number;
      }
    | null = null;

  for (let i = 50; i < req.bars.length; i += 1) {
    const window = req.bars.slice(0, i + 1);
    const bar = req.bars[i];
    const regime = classifyRegime(window, new Date(bar.timestamp));
    if (open) {
      exposedBars += 1;
      open.barsHeld += 1;
      const high = new Qty(bar.high);
      const low = new Qty(bar.low);
      let exit: Qty | null = null;
      let reason = "";
      if (open.direction === "long") {
        if (low.lte(open.stop)) {
          exit = open.stop;
          reason = "stop";
        } else if (high.gte(open.target)) {
          exit = open.target;
          reason = "target";
        }
      } else if (high.gte(open.stop)) {
        exit = open.stop;
        reason = "stop";
      } else if (low.lte(open.target)) {
        exit = open.target;
        reason = "target";
      }
      const compliance = evaluateStrategyCompliance(req.strategy, window);
      if (!exit && compliance.failed.some((f) => f.rule.toLowerCase().includes("exit")) ) {
        // evaluate explicit exit rule
      }
      const ctx = buildIndicatorSet(window);
      const exitEval = evaluateRule(req.strategy.exit, ctx);
      if (!exit && exitEval.passed) {
        exit = new Qty(bar.close);
        reason = "exit-rule";
      }
      if (!exit && req.strategy.timeoutBars && open.barsHeld >= req.strategy.timeoutBars) {
        exit = new Qty(bar.close);
        reason = "timeout";
      }
      if (exit) {
        const trade = closeTrade(open, exit, quantity, costs, bar.timestamp, reason, regime.primary);
        trades.push(trade);
        equity = equity.add(trade.pnl);
        open = null;
      }
    } else {
      const compliance = evaluateStrategyCompliance(req.strategy, window);
      if (compliance.matched) {
        const fillBar = req.fillOn === "next_open" && i + 1 < req.bars.length ? req.bars[i + 1] : bar;
        const rawEntry = new Qty(req.fillOn === "next_open" ? fillBar.open : fillBar.close);
        const entry = applyFriction(rawEntry, costs, "buy");
        const atrs = atr(window, 14);
        const levels = computeStopTarget(
          req.strategy,
          entry.toNumberUnsafe(),
          lastDefined(atrs),
          req.strategy.direction === "short" ? "short" : "long",
        );
        if ("error" in levels) {
          warnings.push(`Skipped signal at ${bar.timestamp}: ${levels.error}`);
        } else {
          open = {
            direction: req.strategy.direction === "short" ? "short" : "long",
            entry,
            entryTime: fillBar.timestamp,
            stop: new Qty(levels.stop),
            target: new Qty(levels.target),
            barsHeld: 0,
          };
        }
      }
    }

    if (equity.gt(peak)) {
      peak = equity;
      ddBars = 0;
    } else {
      const dd = peak.sub(equity).div(peak).mul(100);
      if (dd.gt(maxDd)) maxDd = dd;
      ddBars += 1;
      if (ddBars > maxDdBars) maxDdBars = ddBars;
    }
    curve.push({
      t: bar.timestamp,
      equity: equity.toString(),
      drawdown: peak.isZero() ? "0" : peak.sub(equity).div(peak).mul(100).toFixed(4),
    });
  }

  const metrics = summarize(trades, curve, startEquity, equity, req.bars.length, exposedBars, req.resultKind ?? "backtest");
  return {
    strategyId: req.strategy.strategyId,
    strategyVersion: req.strategy.version,
    instrument: req.bars[0]?.instrument ?? "UNKNOWN",
    from: req.bars[0]?.timestamp ?? "",
    to: req.bars[req.bars.length - 1]?.timestamp ?? "",
    costs,
    trades,
    metrics,
    warnings,
  };
}

function applyFriction(price: Qty, costs: BacktestCosts, side: "buy" | "sell"): Qty {
  const bps = new Qty(costs.spreadBps).add(costs.slippageBps).div(10_000);
  return side === "buy" ? price.mul(new Qty(1).add(bps)) : price.mul(new Qty(1).sub(bps));
}

function closeTrade(
  open: { direction: Direction; entry: Qty; entryTime: string; barsHeld: number },
  exitRaw: Qty,
  quantity: Qty,
  costs: BacktestCosts,
  exitTime: string,
  reason: string,
  regime: string,
): BacktestTrade {
  const exit = applyFriction(exitRaw, costs, open.direction === "long" ? "sell" : "buy");
  const commission = open.entry.mul(quantity).add(exit.mul(quantity)).mul(new Qty(costs.commissionBps).div(10_000));
  const move = open.direction === "long" ? exit.sub(open.entry) : open.entry.sub(exit);
  const pnl = move.mul(quantity).sub(commission);
  const ret = open.entry.isZero() ? new Qty(0) : move.div(open.entry).mul(100);
  return {
    instrument: "",
    direction: open.direction,
    entryTime: open.entryTime,
    exitTime,
    entry: open.entry.toString(),
    exit: exit.toString(),
    quantity: quantity.toString(),
    pnl: pnl.toString(),
    returnPct: ret.toFixed(4),
    barsHeld: open.barsHeld,
    reason,
    regime,
  };
}

function summarize(
  trades: BacktestTrade[],
  curve: BacktestMetrics["equityCurve"],
  start: Qty,
  end: Qty,
  bars: number,
  exposedBars: number,
  resultKind: ResultKind,
): BacktestMetrics {
  const pnls = trades.map((t) => new Qty(t.pnl));
  const wins = pnls.filter((p) => p.gt(0));
  const losses = pnls.filter((p) => p.lt(0));
  const winSum = wins.reduce((s, p) => s.add(p), new Qty(0));
  const lossSum = losses.reduce((s, p) => s.add(p.abs()), new Qty(0));
  const total = pnls.reduce((s, p) => s.add(p), new Qty(0));
  const avg = trades.length ? total.div(trades.length) : new Qty(0);
  const rets = curve.map((c, i) => {
    if (i === 0) return 0;
    const prev = new Qty(curve[i - 1].equity);
    return prev.isZero() ? 0 : new Qty(c.equity).sub(prev).div(prev).toNumberUnsafe();
  });
  const vol = stdev(rets) * Math.sqrt(252);
  const mean = avgNum(rets) * 252;
  const downside = stdev(rets.filter((r) => r < 0)) * Math.sqrt(252);
  const maxDd = curve.reduce((m, c) => Math.max(m, Number(c.drawdown)), 0);
  const years = Math.max(bars / 252, 1 / 252);
  const totalReturn = start.isZero() ? new Qty(0) : end.sub(start).div(start).mul(100);
  const annualized = start.isZero() ? 0 : (Math.pow(end.toNumberUnsafe() / start.toNumberUnsafe(), 1 / years) - 1) * 100;
  return {
    resultKind,
    startingEquity: start.toString(),
    endingEquity: end.toString(),
    totalReturn: totalReturn.toFixed(4),
    annualizedReturn: annualized.toFixed(4),
    volatility: (vol * 100).toFixed(4),
    sharpe: vol === 0 ? "0" : (mean / vol).toFixed(4),
    sortino: downside === 0 ? "0" : (mean / downside).toFixed(4),
    calmar: maxDd === 0 ? "0" : (annualized / maxDd).toFixed(4),
    maxDrawdown: maxDd.toFixed(4),
    maxDrawdownDurationBars: 0,
    winRate: trades.length ? ((wins.length / trades.length) * 100).toFixed(2) : "0",
    lossRate: trades.length ? ((losses.length / trades.length) * 100).toFixed(2) : "0",
    profitFactor: lossSum.isZero() ? (winSum.isZero() ? "0" : "999") : winSum.div(lossSum).toFixed(4),
    expectancy: avg.toFixed(4),
    averageWin: wins.length ? winSum.div(wins.length).toFixed(4) : "0",
    averageLoss: losses.length ? lossSum.div(losses.length).neg().toFixed(4) : "0",
    trades: trades.length,
    exposure: bars === 0 ? "0" : ((exposedBars / bars) * 100).toFixed(2),
    turnover: trades.length.toString(),
    equityCurve: curve,
  };
}

function avgNum(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avgNum(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

