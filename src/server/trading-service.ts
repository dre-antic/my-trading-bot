import { runOutOfSample, runWalkForward, runMonteCarlo } from "@/core/anti-overfit";
import { runBacktest } from "@/core/backtest";
import { riskReward, transitionCandidate, type TradeCandidate } from "@/core/candidate";
import { parseConstitution, type Constitution } from "@/core/constitution";
import { interpretSourceText } from "@/core/document-import";
import { authorizeEmergency, type EmergencyAction } from "@/core/emergency";
import { ids } from "@/core/ids";
import { classifyMistakePatterns, draftJournalFromTrade } from "@/core/journal";
import { synthesizeDemoBars } from "@/core/market-data";
import { Money, Qty } from "@/core/money";
import {
  cancelPaperOrder,
  createPaperAccount,
  executionQuality,
  matchPaperOrders,
  paperEquity,
  submitPaperOrder,
  type PaperAccountState,
  type PaperQuote,
} from "@/core/paper-broker";
import { emptyPortfolio, analyzePortfolio } from "@/core/portfolio";
import { sizePosition } from "@/core/position-sizing";
import { classifyRegime } from "@/core/regime";
import { runDeterministicDesk } from "@/core/research-desk";
import { evaluateRiskFirewall } from "@/core/risk-firewall";
import { computeStopTarget, evaluateStrategyCompliance, parseStrategy, type StrategyDefinition } from "@/core/strategy";
import { lastDefined } from "@/core/indicators";
import { buildIndicatorSet } from "@/core/strategy-context";
import { toIsoUtc } from "@/core/time";
import { runTournament } from "@/core/tournament";
import type { AssetClass, DisplayMode, InstrumentSpec, LiveTradingMode } from "@/core/types";
import { isMarketOpen } from "@/core/calendar";
import { getDb } from "@/db/client";
import { addAlert, audit } from "./audit";
import { loadConfig } from "./config";

function db() {
  return getDb();
}

export function latestConstitution(userId: string): Constitution {
  const row = db()
    .prepare("SELECT payload FROM constitution_versions WHERE user_id = ? ORDER BY version DESC LIMIT 1")
    .get(userId) as { payload: string } | undefined;
  if (!row) throw new Error("Trading Constitution is missing");
  return parseConstitution(JSON.parse(row.payload));
}

export function listStrategies(userId: string): StrategyDefinition[] {
  const versions = db()
    .prepare(
      `SELECT s.lifecycle, v.payload FROM strategies s
       JOIN strategy_versions v ON v.strategy_id = s.id
       WHERE s.user_id = ?
       AND v.version = (SELECT MAX(version) FROM strategy_versions WHERE strategy_id = s.id)
       ORDER BY s.created_at`,
    )
    .all(userId) as Array<{ lifecycle: string; payload: string }>;
  return versions.map((v) => {
    const def = parseStrategy(JSON.parse(v.payload));
    return { ...def, lifecycle: v.lifecycle as StrategyDefinition["lifecycle"] };
  });
}

export function getStrategy(userId: string, strategyId: string): StrategyDefinition {
  const row = db()
    .prepare(
      `SELECT payload FROM strategy_versions
       WHERE strategy_id = ? AND strategy_id IN (SELECT id FROM strategies WHERE user_id = ?)
       ORDER BY version DESC LIMIT 1`,
    )
    .get(strategyId, userId) as { payload: string } | undefined;
  if (!row) throw new Error("strategy not found");
  return parseStrategy(JSON.parse(row.payload));
}

export function createStrategyVersion(userId: string, input: Omit<StrategyDefinition, "strategyId" | "version" | "createdAt" | "author"> & { strategyId?: string }): StrategyDefinition {
  const now = toIsoUtc();
  const strategyId = input.strategyId ?? ids.strategy();
  const existing = db().prepare("SELECT id FROM strategies WHERE id = ? AND user_id = ?").get(strategyId, userId) as { id: string } | undefined;
  const latest = db()
    .prepare("SELECT MAX(version) as v FROM strategy_versions WHERE strategy_id = ?")
    .get(strategyId) as { v: number | null };
  const version = (latest?.v ?? 0) + 1;
  const def: StrategyDefinition = parseStrategy({
    ...input,
    strategyId,
    version,
    createdAt: now,
    author: userId,
  });
  if (!existing) {
    db()
      .prepare("INSERT INTO strategies (id, user_id, name, description, asset_class, lifecycle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(strategyId, userId, def.name, def.description, def.assetClass, def.lifecycle, now);
  } else {
    db().prepare("UPDATE strategies SET name = ?, description = ?, lifecycle = 'DRAFT' WHERE id = ?").run(def.name, def.description, strategyId);
  }
  db()
    .prepare("INSERT INTO strategy_versions (id, strategy_id, version, payload, author, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(ids.strategyVersion(), strategyId, version, JSON.stringify(def), userId, now);
  audit({ userId, action: "strategy.version_created", entity: "strategy", entityId: strategyId, payload: { version } });
  return def;
}

export function primaryAccount(userId: string): { id: string; paper_state: string; broker: string; environment: string; currency: string; display_name: string; last_sync_at: string | null } {
  const row = db()
    .prepare("SELECT * FROM broker_accounts WHERE user_id = ? ORDER BY created_at LIMIT 1")
    .get(userId) as
    | {
        id: string;
        paper_state: string;
        broker: string;
        environment: string;
        currency: string;
        display_name: string;
        last_sync_at: string | null;
      }
    | undefined;
  if (!row) throw new Error("no broker account");
  return row;
}

export function loadPaper(userId: string): { account: ReturnType<typeof primaryAccount>; state: PaperAccountState } {
  const account = primaryAccount(userId);
  const state = (account.paper_state ? JSON.parse(account.paper_state) : createPaperAccount(account.id, "100000")) as PaperAccountState;
  return { account, state };
}

export function savePaper(accountId: string, state: PaperAccountState): void {
  db()
    .prepare("UPDATE broker_accounts SET paper_state = ?, last_sync_at = ? WHERE id = ?")
    .run(JSON.stringify(state), toIsoUtc(), accountId);
}

export function getInstrument(symbol: string): InstrumentSpec {
  const row = db().prepare("SELECT * FROM instruments WHERE symbol = ?").get(symbol) as
    | {
        id: string;
        symbol: string;
        asset_class: AssetClass;
        currency: string;
        venue: string;
        price_decimals: number;
        quantity_decimals: number;
        tick_size: string;
        lot_size: string;
        min_quantity: string;
        timezone: string;
        trading_hours: string;
      }
    | undefined;
  if (!row) {
    return {
      id: symbol,
      symbol,
      assetClass: "equity",
      currency: "USD",
      venue: "UNKNOWN",
      priceDecimals: 2,
      quantityDecimals: 4,
      tickSize: "0.01",
      lotSize: "0.0001",
      minQuantity: "0.0001",
      timezone: "UTC",
      tradingHours: "always",
    };
  }
  return {
    id: row.id,
    symbol: row.symbol,
    assetClass: row.asset_class,
    currency: row.currency,
    venue: row.venue,
    priceDecimals: row.price_decimals,
    quantityDecimals: row.quantity_decimals,
    tickSize: row.tick_size,
    lotSize: row.lot_size,
    minQuantity: row.min_quantity,
    timezone: row.timezone,
    tradingHours: row.trading_hours,
  };
}

export function barsFor(symbol: string, assetClass: AssetClass): ReturnType<typeof synthesizeDemoBars> {
  const seed = symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return synthesizeDemoBars(symbol, assetClass, 240, seed);
}

export function flags(userId: string): {
  display_mode: DisplayMode;
  trading_mode: LiveTradingMode;
  live_enabled: number;
  autonomous_enabled: number;
  stop_new_trades: number;
  stop_automation: number;
} {
  return db().prepare("SELECT * FROM runtime_flags WHERE user_id = ?").get(userId) as {
    display_mode: DisplayMode;
    trading_mode: LiveTradingMode;
    live_enabled: number;
    autonomous_enabled: number;
    stop_new_trades: number;
    stop_automation: number;
  };
}

export function portfolioOf(userId: string) {
  const { account, state } = loadPaper(userId);
  const quotes = currentQuotes(state);
  const equity = paperEquity(state, quotes);
  const positions = Object.values(state.positions).map((p) => {
    const inst = getInstrument(p.instrument);
    const q = quotes.find((x) => x.instrument === p.instrument);
    const px = q?.last ?? p.averagePrice;
    const upnl = new Qty(px).sub(p.averagePrice).mul(p.quantity);
    return {
      instrument: p.instrument,
      assetClass: inst.assetClass,
      quantity: p.quantity,
      averagePrice: p.averagePrice,
      marketPrice: px,
      unrealizedPnl: upnl.toString(),
      currency: state.currency,
    };
  });
  const peakRow = db()
    .prepare("SELECT payload FROM portfolio_snapshots WHERE account_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(account.id) as { payload: string } | undefined;
  const peak = peakRow ? new Qty(JSON.parse(peakRow.payload).peakEquity ?? equity.toString()) : equity.amount;
  const peakEq = peak.gt(equity.amount) ? peak : equity.amount;
  const dd = peakEq.isZero() ? new Qty(0) : peakEq.sub(equity.amount).div(peakEq).mul(100);
  return emptyPortfolio(account.id, equity.amount.toString(), state.currency) && {
    accountId: account.id,
    equity: equity.amount.toString(),
    cash: state.cash,
    buyingPower: state.cash,
    realizedPnl: state.realizedPnl,
    unrealizedPnl: positions.reduce((s, p) => s.add(p.unrealizedPnl), new Qty(0)).toString(),
    dailyPnl: state.realizedPnl,
    weeklyPnl: state.realizedPnl,
    peakEquity: peakEq.toString(),
    drawdown: dd.toFixed(4),
    leverage: "1",
    positions,
    currency: state.currency,
    asOf: toIsoUtc(),
    broker: account.broker,
    environment: account.environment,
    displayName: account.display_name,
    lastSync: account.last_sync_at,
  };
}

function currentQuotes(state: PaperAccountState): PaperQuote[] {
  const symbols = new Set<string>([...Object.keys(state.positions), ...Object.values(state.orders).map((o) => o.instrument), "SPY"]);
  const now = toIsoUtc();
  return [...symbols].map((symbol) => {
    const inst = getInstrument(symbol);
    const bars = barsFor(symbol, inst.assetClass);
    const last = bars[bars.length - 1];
    const px = new Qty(last.close);
    return {
      instrument: symbol,
      bid: px.mul("0.9995").toFixed(inst.priceDecimals),
      ask: px.mul("1.0005").toFixed(inst.priceDecimals),
      last: px.toFixed(inst.priceDecimals),
      timestamp: now,
    };
  });
}

export function scanStrategy(userId: string, strategyId: string): TradeCandidate[] {
  const strategy = getStrategy(userId, strategyId);
  const account = primaryAccount(userId);
  const created: TradeCandidate[] = [];
  for (const symbol of strategy.instruments) {
    const inst = getInstrument(symbol);
    const bars = barsFor(symbol, inst.assetClass);
    const compliance = evaluateStrategyCompliance(strategy, bars);
    const regime = classifyRegime(bars);
    const ctx = buildIndicatorSet(bars);
    const close = lastDefined(ctx.series.close);
    if (close == null) continue;
    const direction = strategy.direction === "short" ? "short" : "long";
    const levels = computeStopTarget(strategy, close, lastDefined(ctx.series.atr), direction);
    const now = new Date();
    const lastBar = bars[bars.length - 1];
    const desk = runDeterministicDesk(strategy, bars);
    const candidateId = ids.candidate();
    const stop = "error" in levels ? close * (direction === "long" ? 0.98 : 1.02) : levels.stop;
    const target = "error" in levels ? close * (direction === "long" ? 1.04 : 0.96) : levels.target;
    const port = portfolioOf(userId);
    const sizing = sizePosition({
      method: strategy.positionSizing.method,
      accountEquity: new Money(port.equity, port.currency),
      cash: new Money(port.cash, port.currency),
      buyingPower: new Money(port.buyingPower, port.currency),
      entry: String(close),
      stop: String(stop),
      direction,
      instrument: inst,
      riskPct: strategy.positionSizing.riskPct,
      fixedQuantity: strategy.positionSizing.fixedQuantity,
      fixedRisk: strategy.positionSizing.fixedRisk ? new Money(strategy.positionSizing.fixedRisk, port.currency) : undefined,
      atr: lastDefined(ctx.series.atr)?.toString(),
      atrMultiplier: strategy.positionSizing.atrMultiplier,
      estimatedFeeBps: "1",
      estimatedSlippageBps: "2",
    });
    const status = compliance.matched ? "QUALIFIED" : "DISCOVERED";
    const candidate: TradeCandidate = {
      candidateId,
      strategyId: strategy.strategyId,
      strategyVersion: strategy.version,
      instrument: symbol,
      assetClass: inst.assetClass,
      direction,
      timeframe: strategy.timeframe,
      entry: String(close),
      stop: String(stop),
      target: String(target),
      positionSize: sizing.quantity,
      riskAmount: sizing.totalRisk,
      rewardAmount: new Qty(target).sub(close).abs().mul(sizing.quantity || "0").toString(),
      riskReward: riskReward(String(close), String(stop), String(target), direction),
      strategyMatch: compliance,
      technicalEvidence: [desk.technicalAnalysis],
      fundamentalEvidence: [desk.fundamentalAnalysis],
      newsEvidence: [desk.newsMacro],
      marketRegime: { primary: regime.primary, confidence: regime.confidence, evidence: regime.evidence },
      bullCase: desk.bullCase,
      bearCase: desk.bearCase,
      riskAnalysis: desk.risk,
      executionAnalysis: "Paper broker will fill at the displayed bid/ask plus labeled simulated fees.",
      invalidationConditions: ["Stop price", "Strategy invalidation rule", "Timeout"],
      dataTimestamp: lastBar.timestamp,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 6 * 3600_000).toISOString(),
      status,
      userId,
      accountId: account.id,
      broker: "paper",
      environment: "paper",
      resultKind: "paper",
    };
    db()
      .prepare("INSERT INTO trade_candidates (id, user_id, account_id, payload, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(candidateId, userId, account.id, JSON.stringify(candidate), status, candidate.createdAt, candidate.expiresAt);
    created.push(candidate);
  }
  audit({ userId, action: "scan.completed", entity: "strategy", entityId: strategyId, payload: { count: created.length } });
  addAlert(userId, "candidate_found", "Scan complete", `${created.length} candidate(s) generated for ${strategy.name}`);
  return created;
}

export function listCandidates(userId: string): TradeCandidate[] {
  const rows = db()
    .prepare("SELECT payload FROM trade_candidates WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Array<{ payload: string }>;
  return rows.map((r) => JSON.parse(r.payload) as TradeCandidate);
}

export function getCandidate(userId: string, id: string): TradeCandidate {
  const row = db()
    .prepare("SELECT payload FROM trade_candidates WHERE id = ? AND user_id = ?")
    .get(id, userId) as { payload: string } | undefined;
  if (!row) throw new Error("candidate not found");
  return JSON.parse(row.payload) as TradeCandidate;
}

function saveCandidate(c: TradeCandidate): void {
  db().prepare("UPDATE trade_candidates SET payload = ?, status = ? WHERE id = ?").run(JSON.stringify(c), c.status, c.candidateId);
}

export function riskCheckCandidate(userId: string, candidateId: string, editedQuantity?: string): { candidate: TradeCandidate; risk: ReturnType<typeof evaluateRiskFirewall>; sizing: ReturnType<typeof sizePosition> } {
  const candidate = getCandidate(userId, candidateId);
  const constitution = latestConstitution(userId);
  const inst = getInstrument(candidate.instrument);
  const port = portfolioOf(userId);
  const runtime = flags(userId);
  const config = loadConfig();
  const sizing = sizePosition({
    method: "fixed_quantity",
    accountEquity: new Money(port.equity, port.currency),
    cash: new Money(port.cash, port.currency),
    buyingPower: new Money(port.buyingPower, port.currency),
    entry: candidate.entry,
    stop: candidate.stop,
    direction: candidate.direction,
    instrument: inst,
    fixedQuantity: editedQuantity ?? candidate.positionSize,
    estimatedFeeBps: "1",
    estimatedSlippageBps: "2",
  });
  const { state } = loadPaper(userId);
  const openDup = Object.values(state.orders).some((o) => o.instrument === candidate.instrument && (o.status === "submitted" || o.status === "accepted" || o.status === "partially_filled"));
  const risk = evaluateRiskFirewall({
    constitution,
    now: new Date(),
    userId,
    accountId: candidate.accountId,
    broker: candidate.broker,
    environment: "paper",
    liveEnabled: config.liveEnabled && runtime.live_enabled === 1,
    autonomousEnabled: config.autonomousEnabled && runtime.autonomous_enabled === 1,
    tradingMode: runtime.stop_new_trades ? "research" : runtime.trading_mode,
    displayMode: runtime.display_mode,
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyVersion,
    instrument: inst,
    market: inst.venue,
    direction: candidate.direction,
    sizing,
    portfolio: port,
    dataTimestamp: new Date().toISOString(),
    signalTimestamp: new Date().toISOString(),
    withinTradingHours: isMarketOpen(inst.assetClass, new Date()) || inst.assetClass === "crypto" || runtime.display_mode === "demo",
    newsRestricted: false,
    existingOpenOrderForInstrument: openDup,
    stopPresent: Boolean(candidate.stop),
  });
  if (risk.decision === "REJECTED") {
    if (transitionCandidate(candidate.status, "RISK_REJECTED")) candidate.status = "RISK_REJECTED";
  } else if (candidate.status === "QUALIFIED" || candidate.status === "DISCOVERED" || candidate.status === "RESEARCHING") {
    candidate.status = "WAITING_APPROVAL";
  }
  candidate.positionSize = sizing.quantity;
  candidate.riskAmount = sizing.totalRisk;
  saveCandidate(candidate);
  db()
    .prepare("INSERT INTO risk_events (id, user_id, candidate_id, decision, violations, constitution_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(ids.riskEvent(), userId, candidateId, risk.decision, JSON.stringify(risk.violations), risk.constitutionVersion, toIsoUtc());
  audit({ userId, action: "risk.checked", entity: "candidate", entityId: candidateId, payload: { decision: risk.decision, violations: risk.violations } });
  if (risk.decision === "REJECTED") {
    addAlert(userId, "risk_limit", "Risk firewall rejected a proposal", risk.violations.map((v) => v.code).join(", "));
  } else {
    addAlert(userId, "approval_needed", "Approval needed", `${candidate.instrument} ${candidate.direction}`);
  }
  return { candidate, risk, sizing };
}

export function decideCandidate(
  userId: string,
  candidateId: string,
  decision: "APPROVE" | "REJECT" | "WATCH",
  editedQuantity?: string,
): { candidate: TradeCandidate; orderId?: string } {
  const checked = riskCheckCandidate(userId, candidateId, editedQuantity);
  const candidate = checked.candidate;
  if (decision === "WATCH") {
    audit({ userId, action: "candidate.watch", entity: "candidate", entityId: candidateId });
    return { candidate };
  }
  if (decision === "REJECT") {
    candidate.status = "REJECTED";
    saveCandidate(candidate);
    writeJournal(userId, candidate, "rejected");
    return { candidate };
  }
  if (checked.risk.decision !== "APPROVED") {
    throw new Error(`Risk firewall rejected this proposal: ${checked.risk.violations.map((v) => v.message).join("; ")}`);
  }
  if (flags(userId).trading_mode === "research") {
    throw new Error("Research mode cannot execute.");
  }
  candidate.status = "APPROVED";
  saveCandidate(candidate);
  const orderId = executePaper(userId, candidate, checked.sizing.quantity);
  return { candidate, orderId };
}

function executePaper(userId: string, candidate: TradeCandidate, quantity: string): string {
  const { account, state } = loadPaper(userId);
  const now = new Date();
  const submitted = submitPaperOrder(state, {
    userId,
    accountId: account.id,
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyVersion,
    candidateId: candidate.candidateId,
    instrument: candidate.instrument,
    side: candidate.direction === "long" ? "buy" : "sell",
    type: "market",
    quantity,
    expectedPrice: candidate.entry,
    now,
  });
  const quotes = currentQuotes(submitted.state);
  const matched = matchPaperOrders(submitted.state, quotes, now);
  savePaper(account.id, matched);
  persistOrderAndFills(userId, account.id, matched, submitted.order.orderId);
  const order = matched.orders[submitted.order.orderId];
  if (order.status === "filled") {
    candidate.status = "EXECUTED";
    saveCandidate(candidate);
    const fill = matched.fills.find((f) => f.orderId === order.orderId);
    writeJournal(userId, candidate, "approved", order.orderId, fill ? executionQuality(order, fill) : undefined);
    addAlert(userId, "order_filled", "Paper order filled", `${candidate.instrument} ${quantity} @ ${fill?.price ?? "n/a"} (simulated)`);
  } else {
    addAlert(userId, "order_submitted", "Paper order submitted", `${candidate.instrument} ${order.status}`);
  }
  audit({ userId, action: "order.paper_submit", entity: "order", entityId: order.orderId, payload: { status: order.status, simulated: true } });
  return order.orderId;
}

function persistOrderAndFills(userId: string, accountId: string, state: PaperAccountState, orderId: string): void {
  const order = state.orders[orderId];
  db()
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
      order.expectedPrice ?? null,
      order.rejectReason ?? null,
      order.submittedAt,
      order.updatedAt,
    );
  for (const fill of state.fills.filter((f) => f.orderId === orderId)) {
    db()
      .prepare("INSERT OR IGNORE INTO fills (id, order_id, instrument, side, quantity, price, fee, filled_at, simulated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)")
      .run(fill.fillId, fill.orderId, fill.instrument, fill.side, fill.quantity, fill.price, fill.fee, fill.filledAt);
  }
  for (const pos of Object.values(state.positions)) {
    const existing = db().prepare("SELECT id FROM positions WHERE account_id = ? AND instrument = ?").get(accountId, pos.instrument) as { id: string } | undefined;
    const inst = getInstrument(pos.instrument);
    const q = currentQuotes(state).find((x) => x.instrument === pos.instrument);
    if (existing) {
      db()
        .prepare("UPDATE positions SET quantity = ?, average_price = ?, market_price = ?, unrealized_pnl = ?, realized_pnl = ?, updated_at = ? WHERE id = ?")
        .run(pos.quantity, pos.averagePrice, q?.last ?? pos.averagePrice, "0", pos.realizedPnl, toIsoUtc(), existing.id);
    } else {
      db()
        .prepare("INSERT INTO positions (id, account_id, instrument, quantity, average_price, market_price, unrealized_pnl, realized_pnl, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(ids.position(), accountId, pos.instrument, pos.quantity, pos.averagePrice, q?.last ?? pos.averagePrice, "0", pos.realizedPnl, toIsoUtc());
    }
    void inst;
  }
}

function writeJournal(
  userId: string,
  candidate: TradeCandidate,
  decision: string,
  orderId?: string,
  quality?: ReturnType<typeof executionQuality>,
): void {
  const draft = draftJournalFromTrade({
    userId,
    accountId: candidate.accountId,
    candidateId: candidate.candidateId,
    orderId,
    strategyId: candidate.strategyId,
    strategyVersion: candidate.strategyVersion,
    thesis: `${candidate.bullCase} / Counter: ${candidate.bearCase}`,
    entry: candidate.entry,
    stop: candidate.stop,
    target: candidate.target,
    actualEntry: quality?.actualPrice,
    resultKind: "paper",
    simulated: true,
    aiReasoning: "Deterministic research desk. No LLM execution authority.",
    userDecision: decision,
    executionQuality: quality ? `expected ${quality.expectedPrice} actual ${quality.actualPrice} slippage ${quality.slippage} (simulated)` : undefined,
    regime: candidate.marketRegime.primary,
  });
  db()
    .prepare(
      `INSERT INTO journal_entries (id, user_id, account_id, candidate_id, order_id, strategy_id, strategy_version, thesis, entry_price, stop_price, target_price, actual_entry, actual_exit, result, regime, ai_reasoning, user_decision, execution_quality, result_kind, simulated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      ids.journal(),
      userId,
      draft.accountId,
      draft.candidateId ?? null,
      draft.orderId ?? null,
      draft.strategyId ?? null,
      draft.strategyVersion ?? null,
      draft.thesis,
      draft.entry,
      draft.stop,
      draft.target,
      draft.actualEntry ?? null,
      null,
      null,
      draft.regime ?? null,
      draft.aiReasoning,
      draft.userDecision ?? null,
      draft.executionQuality ?? null,
      draft.resultKind,
      toIsoUtc(),
    );
}

export function closePosition(userId: string, instrument: string): void {
  const { account, state } = loadPaper(userId);
  const pos = state.positions[instrument];
  if (!pos) throw new Error("no position");
  const qty = new Qty(pos.quantity);
  const now = new Date();
  const submitted = submitPaperOrder(state, {
    userId,
    accountId: account.id,
    instrument,
    side: qty.gt(0) ? "sell" : "buy",
    type: "market",
    quantity: qty.abs().toString(),
    reduceOnly: true,
    now,
  });
  const matched = matchPaperOrders(submitted.state, currentQuotes(submitted.state), now);
  savePaper(account.id, matched);
  persistOrderAndFills(userId, account.id, matched, submitted.order.orderId);
  const fill = matched.fills.find((f) => f.orderId === submitted.order.orderId);
  if (fill) {
    db()
      .prepare(
        `UPDATE journal_entries SET actual_exit = ? WHERE user_id = ? AND id = (
          SELECT id FROM journal_entries WHERE user_id = ? AND actual_exit IS NULL ORDER BY created_at DESC LIMIT 1
        )`,
      )
      .run(fill.price, userId, userId);
  }
  db().prepare("DELETE FROM positions WHERE account_id = ? AND instrument = ?").run(account.id, instrument);
  addAlert(userId, "target_hit", "Paper position closed", `${instrument} closed (simulated)`);
  audit({ userId, action: "position.closed", entity: "position", entityId: instrument, payload: { simulated: true } });
}

export function runStrategyBacktest(userId: string, strategyId: string) {
  const strategy = getStrategy(userId, strategyId);
  const inst = getInstrument(strategy.instruments[0]);
  const bars = barsFor(inst.symbol, inst.assetClass);
  const full = runBacktest({ strategy, bars, fillOn: "next_open" });
  const oos = runOutOfSample({ strategy, bars, fillOn: "next_open" });
  const wf = runWalkForward({ strategy, bars, fillOn: "next_open" }, 120, 40);
  const mc = runMonteCarlo(full, 100, 2);
  const backtestId = ids.backtest();
  db().prepare("INSERT INTO backtests (id, user_id, strategy_id, strategy_version, created_at) VALUES (?, ?, ?, ?, ?)").run(
    backtestId,
    userId,
    strategyId,
    strategy.version,
    toIsoUtc(),
  );
  db().prepare("INSERT INTO backtest_runs (id, backtest_id, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)").run(
    ids.run(),
    backtestId,
    "full",
    JSON.stringify(full),
    toIsoUtc(),
  );
  db().prepare("INSERT INTO walk_forward_runs (id, user_id, strategy_id, payload, created_at) VALUES (?, ?, ?, ?, ?)").run(
    ids.run(),
    userId,
    strategyId,
    JSON.stringify(wf),
    toIsoUtc(),
  );
  db().prepare("INSERT INTO monte_carlo_runs (id, user_id, strategy_id, payload, created_at) VALUES (?, ?, ?, ?, ?)").run(
    ids.run(),
    userId,
    strategyId,
    JSON.stringify(mc),
    toIsoUtc(),
  );
  audit({ userId, action: "backtest.run", entity: "strategy", entityId: strategyId, payload: { backtestId, trades: full.metrics.trades } });
  return { backtestId, full, oos, wf, mc };
}

export function tournament(userId: string) {
  const strategies = listStrategies(userId);
  const bars = barsFor("SPY", "etf");
  return runTournament(strategies, bars);
}

export function importDocument(userId: string, filename: string, text: string) {
  const interpretation = interpretSourceText(text);
  const id = ids.document();
  db()
    .prepare(
      "INSERT INTO strategy_documents (id, user_id, filename, kind, extracted_text, interpretation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, userId, filename, "txt", text, JSON.stringify(interpretation), toIsoUtc());
  audit({ userId, action: "document.imported", entity: "document", entityId: id, payload: { filename, ambiguities: interpretation.ambiguities.length } });
  return { id, interpretation };
}

export function askDesk(userId: string, question: string) {
  const strategies = listStrategies(userId);
  const candidates = listCandidates(userId);
  const port = portfolioOf(userId);
  const intel = analyzePortfolio(port);
  const journals = db()
    .prepare("SELECT result, regime, execution_quality, thesis FROM journal_entries WHERE user_id = ?")
    .all(userId) as Array<{ result?: string; regime?: string; execution_quality?: string; thesis: string }>;
  const q = question.toLowerCase();
  let answer = "";
  if (q.includes("reject")) {
    const last = db()
      .prepare("SELECT violations FROM risk_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(userId) as { violations: string } | undefined;
    answer = last
      ? `The last Risk Firewall decision listed: ${last.violations}. An LLM cannot override that result.`
      : "No risk rejection is on file.";
  } else if (q.includes("candidate") || q.includes("today")) {
    answer = candidates.length
      ? `There are ${candidates.length} stored candidates. Latest: ${candidates[0].instrument} ${candidates[0].status}.`
      : "No candidates have been generated yet. Run a scan from Strategies or Opportunities.";
  } else if (q.includes("mistake") || q.includes("learn")) {
    answer = classifyMistakePatterns(journals).join(" ");
  } else if (q.includes("backtest") || q.includes("high volatility") || q.includes("compare")) {
    answer = "Backtests are historical simulations. Open Backtests to run in-sample, out-of-sample, walk-forward, and Monte Carlo. Do not treat a single window as validation.";
  } else if (q.includes("market")) {
    const bars = barsFor("SPY", "etf");
    const desk = runDeterministicDesk(strategies[0] ?? educationalFallback(), bars);
    answer = `${desk.marketOverview} ${desk.marketRegime}`;
  } else {
    answer = `Account equity ${port.equity} ${port.currency} (paper/demo). Open positions: ${intel.openPositions}. Strategies: ${strategies.length}. This answer uses system data only.`;
  }
  db()
    .prepare(
      "INSERT INTO ai_runs (id, user_id, agent_id, provider, model, used_llm, input_tokens, output_tokens, estimated_cost_usd, task, output, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, '0', ?, ?, ?)",
    )
    .run(ids.aiRun(), userId, "trade_committee", "none", "deterministic-desk", question, answer, toIsoUtc());
  return {
    answer,
    usedLlm: false,
    citations: ["portfolio", "candidates", "risk_events", "journal"],
    disclaimer: "Deterministic desk. Paid LLM providers stay off unless configured. No execution authority.",
  };
}

function educationalFallback(): StrategyDefinition {
  return parseStrategy({
    strategyId: "tmp",
    version: 1,
    name: "tmp",
    description: "tmp",
    assetClass: "etf",
    instruments: ["SPY"],
    timeframe: "1d",
    direction: "long",
    entry: { op: "cmp", left: { kind: "indicator", name: "close" }, cmp: ">", right: { kind: "literal", value: "0" } },
    exit: { op: "cmp", left: { kind: "indicator", name: "close" }, cmp: "<", right: { kind: "literal", value: "0" } },
    stop: { kind: "percent", value: "2" },
    target: { kind: "rr", value: "2" },
    positionSizing: { method: "percent_account_risk", riskPct: "0.5" },
    compatibleRegimes: ["any"],
    lifecycle: "DRAFT",
    author: "system",
    createdAt: toIsoUtc(),
    sourceDocumentIds: [],
    educational: true,
  });
}

export function emergency(userId: string, action: EmergencyAction, confirmPhrase: string) {
  const auth = authorizeEmergency({ action, confirmPhrase, userId });
  if (!auth.ok) throw new Error(auth.reason);
  const { account, state } = loadPaper(userId);
  if (action === "STOP_NEW_TRADES") {
    db().prepare("UPDATE runtime_flags SET stop_new_trades = 1, trading_mode = 'research' WHERE user_id = ?").run(userId);
  }
  if (action === "STOP_AUTOMATION") {
    db().prepare("UPDATE runtime_flags SET stop_automation = 1, autonomous_enabled = 0 WHERE user_id = ?").run(userId);
  }
  if (action === "PAUSE_STRATEGY") {
    db().prepare("UPDATE strategies SET lifecycle = 'PAUSED' WHERE user_id = ? AND lifecycle = 'LIVE'").run(userId);
  }
  if (action === "CANCEL_OPEN_ORDERS") {
    let next = state;
    for (const order of Object.values(state.orders)) {
      if (order.status === "submitted" || order.status === "accepted" || order.status === "partially_filled") {
        next = cancelPaperOrder(next, order.orderId, new Date());
      }
    }
    savePaper(account.id, next);
  }
  if (action === "CLOSE_ALL_POSITIONS") {
    for (const pos of Object.keys(state.positions)) {
      closePosition(userId, pos);
    }
  }
  addAlert(userId, "system_failure", "Emergency control executed", action);
  audit({ userId, action: "emergency", entity: "runtime", entityId: action, payload: { action } });
  return { ok: true, action };
}

export function health() {
  const config = loadConfig();
  return {
    api: "ok",
    database: "ok",
    worker: "in-process",
    broker: { paper: "ok", alpaca: config.alpacaPaperKey ? "keys-present-untested" : "not-configured" },
    marketData: "demo-provider",
    ai: {
      openai: Boolean(config.openaiKey),
      anthropic: Boolean(config.anthropicKey),
      paidServices: Boolean(config.openaiKey || config.anthropicKey),
    },
    liveEnabled: config.liveEnabled,
    autonomousEnabled: config.autonomousEnabled,
  };
}

export function setModes(userId: string, patch: Partial<{ displayMode: DisplayMode; tradingMode: LiveTradingMode }>) {
  const config = loadConfig();
  if (patch.displayMode === "live" && !config.liveEnabled) {
    throw new Error("LIVE mode is blocked by environment policy.");
  }
  if (patch.tradingMode === "autonomous" && !config.autonomousEnabled) {
    throw new Error("Autonomous trading is blocked by environment policy.");
  }
  const current = flags(userId);
  db()
    .prepare("UPDATE runtime_flags SET display_mode = ?, trading_mode = ? WHERE user_id = ?")
    .run(patch.displayMode ?? current.display_mode, patch.tradingMode ?? current.trading_mode, userId);
  audit({ userId, action: "runtime.modes", entity: "runtime", payload: patch });
}
