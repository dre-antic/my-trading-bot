import type { BrokerAdapter, BrokerAccount, BrokerHealth, BrokerPosition, SubmitOrderRequest } from "@/core/broker";
import { assertPaperOrAuthorizedLive } from "@/core/broker";
import { assertDistinctLiveKeys, assertLiveBrokerUrl, LIVE_HOSTS } from "@/core/live-safety";
import type { UniversalOrder } from "@/core/oms";
import { loadConfig } from "./config";

function mapAlpacaStatus(status: string): UniversalOrder["status"] {
  if (status === "new" || status === "accepted") return "accepted";
  if (status === "partially_filled") return "partially_filled";
  if (status === "filled") return "filled";
  if (status === "canceled" || status === "cancelled") return "cancelled";
  if (status === "rejected") return "rejected";
  if (status === "expired") return "expired";
  return "submitted";
}

/** Live Alpaca. Host is pinned to api.alpaca.markets. Paper keys/hosts are refused. */
export class AlpacaLiveAdapter implements BrokerAdapter {
  readonly id = "alpaca_live";
  readonly displayName = "Alpaca Live";
  readonly readiness = "integration_untested" as const;
  readonly capabilities = {
    market: true,
    limit: true,
    stop: true,
    stopLimit: true,
    bracket: true,
    reduceOnly: true,
    paper: false,
    live: true,
  };

  constructor(
    private readonly key = process.env.ALPACA_LIVE_KEY,
    private readonly secret = process.env.ALPACA_LIVE_SECRET,
    private readonly baseUrl = process.env.ALPACA_LIVE_BASE_URL ?? LIVE_HOSTS.alpacaLive,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    assertDistinctLiveKeys(loadConfig().alpacaPaperKey, this.key);
    if (!this.secret) throw new Error("Alpaca live secret is not configured. Refusing to invent a live order.");
    assertLiveBrokerUrl(this.baseUrl);
    return {
      "APCA-API-KEY-ID": this.key as string,
      "APCA-API-SECRET-KEY": this.secret,
      "Content-Type": "application/json",
    };
  }

  async connect(): Promise<void> {
    assertPaperOrAuthorizedLive("live", loadConfig().liveEnabled);
    await this.healthCheck();
  }

  async disconnect(): Promise<void> {
    return;
  }

  async healthCheck(): Promise<BrokerHealth> {
    const started = Date.now();
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v2/clock`, { headers: this.headers() });
      return {
        ok: res.ok,
        latencyMs: Date.now() - started,
        message: res.ok ? "alpaca live reachable" : `alpaca live HTTP ${res.status}`,
        paper: false,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "alpaca live unreachable",
        paper: false,
      };
    }
  }

  async getAccount(): Promise<BrokerAccount> {
    const res = await this.fetchImpl(`${this.baseUrl}/v2/account`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca live account error ${res.status}`);
    const data = (await res.json()) as {
      id: string;
      currency: string;
      cash: string;
      equity: string;
      buying_power: string;
      pattern_day_trader: boolean;
    };
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
    const res = await this.fetchImpl(`${this.baseUrl}/v2/positions`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca live positions error ${res.status}`);
    const data = (await res.json()) as Array<{ symbol: string; qty: string; avg_entry_price: string; current_price: string }>;
    return data.map((p) => ({
      instrument: p.symbol,
      quantity: p.qty,
      averagePrice: p.avg_entry_price,
      marketPrice: p.current_price,
    }));
  }

  async getOrders(): Promise<UniversalOrder[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/v2/orders?status=all&limit=50`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca live orders error ${res.status}`);
    const data = (await res.json()) as Array<Record<string, string>>;
    return data.map((o) => this.toOrder(o));
  }

  async getMarketData(): Promise<{ bid: string; ask: string; last: string; timestamp: string }> {
    throw new Error("Use the market-data resolver. Alpaca live adapter does not invent quotes.");
  }

  async submitOrder(req: SubmitOrderRequest): Promise<UniversalOrder> {
    assertPaperOrAuthorizedLive("live", loadConfig().liveEnabled);
    const body: Record<string, unknown> = {
      symbol: req.instrument,
      qty: req.quantity,
      side: req.side,
      type: req.type === "stop_limit" ? "stop_limit" : req.type,
      time_in_force: req.timeInForce,
      limit_price: req.limitPrice,
      stop_price: req.stopPrice,
      client_order_id: req.clientOrderId,
    };
    if (req.takeProfitPrice && req.stopLossPrice) {
      body.order_class = "bracket";
      body.take_profit = { limit_price: req.takeProfitPrice };
      body.stop_loss = { stop_price: req.stopLossPrice };
    }
    const res = await this.fetchImpl(`${this.baseUrl}/v2/orders`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Alpaca live submit rejected (${res.status}): ${text}`);
    }
    return this.toOrder((await res.json()) as Record<string, string>);
  }

  async cancelOrder(brokerOrderId: string): Promise<UniversalOrder> {
    const res = await this.fetchImpl(`${this.baseUrl}/v2/orders/${brokerOrderId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 204) throw new Error(`Alpaca live cancel error ${res.status}`);
    return this.getOrderStatus(brokerOrderId);
  }

  async modifyOrder(): Promise<UniversalOrder> {
    throw new Error("Alpaca live modify is disabled until marked production-ready.");
  }

  async getOrderStatus(brokerOrderId: string): Promise<UniversalOrder> {
    const res = await this.fetchImpl(`${this.baseUrl}/v2/orders/${brokerOrderId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Alpaca live order status error ${res.status}`);
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
      userId: "alpaca_live",
      accountId: "alpaca_live",
      broker: "alpaca_live",
      environment: "live",
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
