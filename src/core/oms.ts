import type { OrderStatus, OrderType, TimeInForce } from "./types";

export interface UniversalOrder {
  orderId: string;
  clientOrderId: string;
  userId: string;
  accountId: string;
  broker: string;
  environment: "paper" | "live";
  strategyId?: string;
  strategyVersion?: number;
  candidateId?: string;
  instrument: string;
  side: "buy" | "sell";
  type: OrderType;
  timeInForce: TimeInForce;
  quantity: string;
  filledQuantity: string;
  limitPrice?: string;
  stopPrice?: string;
  reduceOnly?: boolean;
  status: OrderStatus;
  submittedAt: string;
  updatedAt: string;
  brokerOrderId?: string;
  rejectReason?: string;
  expectedPrice?: string;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  submitted: ["accepted", "rejected", "cancelled", "expired"],
  accepted: ["partially_filled", "filled", "cancelled", "rejected", "expired"],
  partially_filled: ["partially_filled", "filled", "cancelled", "expired"],
  filled: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function applyOrderTransition(order: UniversalOrder, to: OrderStatus, updatedAt: string, extra: Partial<UniversalOrder> = {}): UniversalOrder {
  if (!canTransitionOrder(order.status, to)) {
    throw new Error(`illegal order transition ${order.status} -> ${to}`);
  }
  return { ...order, ...extra, status: to, updatedAt };
}

export function remainingQuantity(order: UniversalOrder): number {
  return Number(order.quantity) - Number(order.filledQuantity);
}

export function isOpenOrder(status: OrderStatus): boolean {
  return status === "submitted" || status === "accepted" || status === "partially_filled";
}
