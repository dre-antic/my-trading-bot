import type { BrokerAdapter, BrokerAccount, BrokerHealth, BrokerPosition, SubmitOrderRequest } from "@/core/broker";
import { assertPaperOrAuthorizedLive } from "@/core/broker";
import type { UniversalOrder } from "@/core/oms";
import { loadConfig } from "./config";

export class AlpacaPaperAdapter implements BrokerAdapter {
  readonly id = "alpaca_paper";
  readonly displayName = "Alpaca Paper";
  readonly readiness = "integration_untested" as const;
  readonly capabilities = {
    market: true,
    limit: true,
    stop: true,
    stopLimit: true,
    bracket: true,
    reduceOnly: false,
    paper: true,
    live: false,
  };

  constructor(
    private readonly key = loadConfig().alpacaPaperKey,
    private readonly secret = loadConfig().alpacaPaperSecret,
    private readonly baseUrl = loadConfig().alpacaPaperBaseUrl,
  ) {}

  private headers(): Record<string, string> {
    if (!this.key || !this.secret) {
      throw new Error("Alpaca paper keys are not configured. The adapter will not invent a successful response.");
    }
    return {
      "APCA-API-KEY-ID": this.key,
      "APCA-API-SECRET-KEY": this.secret,
      "Content-Type": "application/json",
    };
  }

  async connect(): Promise<void> {
    assertPaperOrAuthorizedLive("paper", false);
    await this.healthCheck();
  }

  async disconnect(): Promise<void> {
    return;
  }

  async healthCheck(): Promise<BrokerHealth> {
    const started = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/v2/clock`, { headers: this.headers() });
      return {
        ok: res.ok,
        latencyMs: Date.now() - started,
        message: res.ok ? "alpaca paper reachable" : `alpaca paper HTTP ${res.status}`,
        paper: true,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "alpaca unreachable",
        paper: true,
      };
    }
  }

  async getAccount(): Promise<BrokerAccount> {
    const res = await fetch(`${this.baseUrl}/v2/account`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca account error ${res.status}`);
    const data = (await res.json()) as { id: string; currency: string; cash: string; equity: string; buying_power: string; pattern_day_trader: boolean };
    return {
      brokerAccountId: data.id,
      currency: data.currency,
      cash: data.cash,
      equity: data.equity,
      buyingPower: data.buying_power,
      patternDayTrader: data.pattern_day_trader,
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await fetch(`${this.baseUrl}/v2/positions`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca positions error ${res.status}`);
    const data = (await res.json()) as Array<{ symbol: string; qty: string; avg_entry_price: string; current_price: string }>;
    return data.map((p) => ({
      instrument: p.symbol,
      quantity: p.qty,
      averagePrice: p.avg_entry_price,
      marketPrice: p.current_price,
    }));
  }

  async getOrders(): Promise<UniversalOrder[]> {
    const res = await fetch(`${this.baseUrl}/v2/orders?status=all&limit=50`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca orders error ${res.status}`);
    const data = (await res.json()) as Array<Record<string, string>>;
    return data.map((o) => this.toOrder(o));
  }

  async getMarketData(): Promise<{ bid: string; ask: string; last: string; timestamp: string }> {
    throw new Error("Alpaca market data requires a data subscription and is not enabled in this build.");
  }

  async submitOrder(req: SubmitOrderRequest): Promise<UniversalOrder> {
    assertPaperOrAuthorizedLive("paper", false);
    const res = await fetch(`${this.baseUrl}/v2/orders`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        symbol: req.instrument,
        qty: req.quantity,
        side: req.side,
        type: req.type.replace("_", "_"),
        time_in_force: req.timeInForce,
        limit_price: req.limitPrice,
        stop_price: req.stopPrice,
        client_order_id: req.clientOrderId,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Alpaca submit rejected (${res.status}): ${body}`);
    }
    return this.toOrder((await res.json()) as Record<string, string>);
  }

  async cancelOrder(brokerOrderId: string): Promise<UniversalOrder> {
    const res = await fetch(`${this.baseUrl}/v2/orders/${brokerOrderId}`, { method: "DELETE", headers: this.headers() });
    if (!res.ok && res.status !== 204) throw new Error(`Alpaca cancel error ${res.status}`);
    return this.getOrderStatus(brokerOrderId);
  }

  async modifyOrder(): Promise<UniversalOrder> {
    throw new Error("Alpaca order modify is not marked production-ready and is disabled.");
  }

  async getOrderStatus(brokerOrderId: string): Promise<UniversalOrder> {
    const res = await fetch(`${this.baseUrl}/v2/orders/${brokerOrderId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca order status error ${res.status}`);
    return this.toOrder((await res.json()) as Record<string, string>);
  }

  async reconcile() {
    const [orders, positions] = await Promise.all([this.getOrders(), this.getPositions()]);
    return { orders, positions };
  }

  private toOrder(o: Record<string, string>): UniversalOrder {
    return {
      orderId: o.id,
      clientOrderId: o.client_order_id,
      userId: "alpaca",
      accountId: "alpaca",
      broker: "alpaca_paper",
      environment: "paper",
      instrument: o.symbol,
      side: o.side as "buy" | "sell",
      type: (o.type as UniversalOrder["type"]) ?? "market",
      timeInForce: (o.time_in_force as UniversalOrder["timeInForce"]) ?? "day",
      quantity: o.qty,
      filledQuantity: o.filled_qty ?? "0",
      limitPrice: o.limit_price,
      stopPrice: o.stop_price,
      status: mapAlpacaStatus(o.status),
      submittedAt: o.submitted_at ?? new Date().toISOString(),
      updatedAt: o.updated_at ?? new Date().toISOString(),
      brokerOrderId: o.id,
    };
  }
}

function mapAlpacaStatus(status: string): UniversalOrder["status"] {
  if (status === "new" || status === "accepted") return "accepted";
  if (status === "partially_filled") return "partially_filled";
  if (status === "filled") return "filled";
  if (status === "canceled" || status === "cancelled") return "cancelled";
  if (status === "rejected") return "rejected";
  if (status === "expired") return "expired";
  return "submitted";
}
