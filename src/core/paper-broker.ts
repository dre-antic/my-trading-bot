import { ids } from "./ids";
import { Money, Qty, notional } from "./money";
import { applyOrderTransition, isOpenOrder, remainingQuantity, type UniversalOrder } from "./oms";
import type { OrderType, TimeInForce } from "./types";

export interface PaperFill {
  fillId: string;
  orderId: string;
  instrument: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  fee: string;
  filledAt: string;
  simulated: true;
}

export interface PaperPosition {
  instrument: string;
  quantity: string;
  averagePrice: string;
  realizedPnl: string;
}

export interface PaperAccountState {
  accountId: string;
  currency: string;
  cash: string;
  realizedPnl: string;
  positions: Record<string, PaperPosition>;
  orders: Record<string, UniversalOrder>;
  fills: PaperFill[];
  lastReconciledAt?: string;
}

export interface PaperQuote {
  instrument: string;
  bid: string;
  ask: string;
  last: string;
  timestamp: string;
}

export interface SubmitPaperOrderInput {
  userId: string;
  accountId: string;
  strategyId?: string;
  strategyVersion?: number;
  candidateId?: string;
  instrument: string;
  side: "buy" | "sell";
  type: OrderType;
  timeInForce?: TimeInForce;
  quantity: string;
  limitPrice?: string;
  stopPrice?: string;
  reduceOnly?: boolean;
  expectedPrice?: string;
  clientOrderId?: string;
  now: Date;
}

export function createPaperAccount(accountId: string, cash: string, currency = "USD"): PaperAccountState {
  return {
    accountId,
    currency,
    cash,
    realizedPnl: "0",
    positions: {},
    orders: {},
    fills: [],
  };
}

export function submitPaperOrder(state: PaperAccountState, input: SubmitPaperOrderInput): { state: PaperAccountState; order: UniversalOrder } {
  if (input.clientOrderId && Object.values(state.orders).some((o) => o.clientOrderId === input.clientOrderId && isOpenOrder(o.status))) {
    throw new Error("duplicate client order id");
  }
  const now = input.now.toISOString();
  const order: UniversalOrder = {
    orderId: ids.order(),
    clientOrderId: input.clientOrderId ?? ids.clientOrder(),
    userId: input.userId,
    accountId: input.accountId,
    broker: "paper",
    environment: "paper",
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    candidateId: input.candidateId,
    instrument: input.instrument,
    side: input.side,
    type: input.type,
    timeInForce: input.timeInForce ?? "day",
    quantity: input.quantity,
    filledQuantity: "0",
    limitPrice: input.limitPrice,
    stopPrice: input.stopPrice,
    reduceOnly: input.reduceOnly,
    status: "submitted",
    submittedAt: now,
    updatedAt: now,
    expectedPrice: input.expectedPrice,
  };
  return {
    state: { ...state, orders: { ...state.orders, [order.orderId]: order } },
    order,
  };
}

export function matchPaperOrders(state: PaperAccountState, quotes: PaperQuote[], now: Date, feeBps = "1"): PaperAccountState {
  let next = { ...state, orders: { ...state.orders }, positions: { ...state.positions }, fills: [...state.fills] };
  for (const order of Object.values(state.orders)) {
    if (!isOpenOrder(order.status)) continue;
    const quote = quotes.find((q) => q.instrument === order.instrument);
    if (!quote) continue;
    const accepted = order.status === "submitted" ? applyOrderTransition(order, "accepted", now.toISOString()) : order;
    next.orders[accepted.orderId] = accepted;
    const fillPrice = resolveFillPrice(accepted, quote);
    if (fillPrice == null) continue;
    next = applyFill(next, accepted, fillPrice, quote.timestamp, feeBps);
  }
  return next;
}

function resolveFillPrice(order: UniversalOrder, quote: PaperQuote): string | null {
  const bid = new Qty(quote.bid);
  const ask = new Qty(quote.ask);
  if (order.type === "market") {
    return order.side === "buy" ? ask.toString() : bid.toString();
  }
  if (order.type === "limit" && order.limitPrice) {
    const limit = new Qty(order.limitPrice);
    if (order.side === "buy" && ask.lte(limit)) return ask.toString();
    if (order.side === "sell" && bid.gte(limit)) return bid.toString();
    return null;
  }
  if (order.type === "stop" && order.stopPrice) {
    const stop = new Qty(order.stopPrice);
    if (order.side === "buy" && ask.gte(stop)) return ask.toString();
    if (order.side === "sell" && bid.lte(stop)) return bid.toString();
    return null;
  }
  if (order.type === "stop_limit" && order.stopPrice && order.limitPrice) {
    const stop = new Qty(order.stopPrice);
    const limit = new Qty(order.limitPrice);
    if (order.side === "buy" && ask.gte(stop) && ask.lte(limit)) return ask.toString();
    if (order.side === "sell" && bid.lte(stop) && bid.gte(limit)) return bid.toString();
    return null;
  }
  return null;
}

function applyFill(state: PaperAccountState, order: UniversalOrder, price: string, ts: string, feeBps: string): PaperAccountState {
  const qty = new Qty(remainingQuantity(order));
  if (qty.lte(0)) return state;
  const fee = notional(price, qty, state.currency).mul(new Qty(feeBps).div(10_000));
  const fill: PaperFill = {
    fillId: ids.fill(),
    orderId: order.orderId,
    instrument: order.instrument,
    side: order.side,
    quantity: qty.toString(),
    price,
    fee: fee.amount.toString(),
    filledAt: ts,
    simulated: true,
  };
  const filledOrder = applyOrderTransition(order, "filled", ts, {
    filledQuantity: order.quantity,
    brokerOrderId: order.orderId,
  });
  const { positions, cash, realizedPnl } = applyPositionFill(
    state,
    order.instrument,
    order.side,
    qty,
    new Qty(price),
    fee,
  );
  return {
    ...state,
    cash,
    realizedPnl,
    positions,
    orders: { ...state.orders, [order.orderId]: filledOrder },
    fills: [...state.fills, fill],
  };
}

function applyPositionFill(
  state: PaperAccountState,
  instrument: string,
  side: "buy" | "sell",
  qty: Qty,
  price: Qty,
  fee: Money,
): { positions: Record<string, PaperPosition>; cash: string; realizedPnl: string } {
  const positions = { ...state.positions };
  const existing = positions[instrument] ?? {
    instrument,
    quantity: "0",
    averagePrice: "0",
    realizedPnl: "0",
  };
  const signed = side === "buy" ? qty : qty.neg();
  const currentQty = new Qty(existing.quantity);
  const newQty = currentQty.add(signed);
  let realized = new Money(existing.realizedPnl, state.currency);
  let cash = new Money(state.cash, state.currency);
  let avg = new Qty(existing.averagePrice);

  if (side === "buy") {
    cash = cash.sub(notional(price, qty, state.currency)).sub(fee);
    if (currentQty.gte(0)) {
      const total = currentQty.add(qty);
      avg = total.isZero() ? new Qty(0) : currentQty.mul(avg).add(qty.mul(price)).div(total);
    } else if (newQty.lte(0)) {
      realized = realized.add(new Money(avg.sub(price).mul(qty), state.currency)).sub(fee);
    } else {
      realized = realized.add(new Money(avg.sub(price).mul(currentQty.abs()), state.currency)).sub(fee);
      avg = price;
    }
  } else {
    cash = cash.add(notional(price, qty, state.currency)).sub(fee);
    if (currentQty.lte(0)) {
      const total = currentQty.abs().add(qty);
      avg = total.isZero() ? new Qty(0) : currentQty.abs().mul(avg).add(qty.mul(price)).div(total);
    } else if (newQty.gte(0)) {
      realized = realized.add(new Money(price.sub(avg).mul(qty), state.currency)).sub(fee);
    } else {
      realized = realized.add(new Money(price.sub(avg).mul(currentQty), state.currency)).sub(fee);
      avg = price;
    }
  }

  if (newQty.isZero()) {
    delete positions[instrument];
  } else {
    positions[instrument] = {
      instrument,
      quantity: newQty.toString(),
      averagePrice: avg.toString(),
      realizedPnl: realized.amount.toString(),
    };
  }

  return {
    positions,
    cash: cash.amount.toString(),
    realizedPnl: new Money(state.realizedPnl, state.currency).add(realized).sub(new Money(existing.realizedPnl, state.currency)).amount.toString(),
  };
}

export function cancelPaperOrder(state: PaperAccountState, orderId: string, now: Date): PaperAccountState {
  const order = state.orders[orderId];
  if (!order) throw new Error("order not found");
  if (!isOpenOrder(order.status)) return state;
  return {
    ...state,
    orders: { ...state.orders, [orderId]: applyOrderTransition(order, "cancelled", now.toISOString()) },
  };
}

export function paperEquity(state: PaperAccountState, quotes: PaperQuote[]): Money {
  let equity = new Money(state.cash, state.currency);
  for (const pos of Object.values(state.positions)) {
    const quote = quotes.find((q) => q.instrument === pos.instrument);
    const price = quote ? new Qty(quote.last) : new Qty(pos.averagePrice);
    equity = equity.add(notional(price, pos.quantity, state.currency));
  }
  return equity;
}

export function executionQuality(order: UniversalOrder, fill: PaperFill): {
  expectedPrice: string;
  actualPrice: string;
  slippage: string;
  simulated: true;
} {
  const expected = new Qty(order.expectedPrice ?? fill.price);
  const actual = new Qty(fill.price);
  const slip = order.side === "buy" ? actual.sub(expected) : expected.sub(actual);
  return {
    expectedPrice: expected.toString(),
    actualPrice: actual.toString(),
    slippage: slip.toString(),
    simulated: true,
  };
}
