import { isOpenOrder, type UniversalOrder } from "./oms";

export interface BrokerView {
  orders: UniversalOrder[];
  positions: Array<{ instrument: string; quantity: string }>;
}

export interface ReconciliationReport {
  localOnlyOrders: string[];
  brokerOnlyOrders: string[];
  statusMismatches: Array<{ orderId: string; local: string; broker: string }>;
  positionMismatches: Array<{ instrument: string; local: string; broker: string }>;
  shouldRetrySubmit: string[];
  unknownFills: string[];
}

export function reconcile(local: BrokerView, broker: BrokerView): ReconciliationReport {
  const localByClient = new Map(local.orders.map((o) => [o.clientOrderId, o]));
  const brokerByClient = new Map(broker.orders.map((o) => [o.clientOrderId, o]));
  const localOnlyOrders: string[] = [];
  const brokerOnlyOrders: string[] = [];
  const statusMismatches: ReconciliationReport["statusMismatches"] = [];
  const shouldRetrySubmit: string[] = [];

  for (const [id, order] of localByClient) {
    const remote = brokerByClient.get(id);
    if (!remote) {
      localOnlyOrders.push(id);
      if (order.status === "submitted") {
        shouldRetrySubmit.push(id);
      }
      continue;
    }
    if (remote.status !== order.status) {
      statusMismatches.push({ orderId: id, local: order.status, broker: remote.status });
    }
  }
  for (const [id] of brokerByClient) {
    if (!localByClient.has(id)) brokerOnlyOrders.push(id);
  }

  const localPos = new Map(local.positions.map((p) => [p.instrument, p.quantity]));
  const brokerPos = new Map(broker.positions.map((p) => [p.instrument, p.quantity]));
  const instruments = new Set([...localPos.keys(), ...brokerPos.keys()]);
  const positionMismatches: ReconciliationReport["positionMismatches"] = [];
  for (const inst of instruments) {
    const a = localPos.get(inst) ?? "0";
    const b = brokerPos.get(inst) ?? "0";
    if (a !== b) positionMismatches.push({ instrument: inst, local: a, broker: b });
  }

  return {
    localOnlyOrders,
    brokerOnlyOrders,
    statusMismatches,
    positionMismatches,
    shouldRetrySubmit: shouldRetrySubmit.filter((id) => {
      const order = localByClient.get(id);
      return Boolean(order && isOpenOrder(order.status));
    }),
    unknownFills: [],
  };
}

export function timeoutDoesNotMeanFailure(report: ReconciliationReport, clientOrderId: string): boolean {
  return report.brokerOnlyOrders.includes(clientOrderId) || report.statusMismatches.some((m) => m.orderId === clientOrderId);
}
