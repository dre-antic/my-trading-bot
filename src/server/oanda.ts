import type { BrokerAdapter, BrokerAccount, BrokerHealth, BrokerPosition, SubmitOrderRequest } from "@/core/broker";
import { assertPaperOrAuthorizedLive } from "@/core/broker";
import { assertLiveBrokerUrl, LIVE_HOSTS } from "@/core/live-safety";
import type { UniversalOrder } from "@/core/oms";
import { loadConfig } from "./config";

export function oandaInstrument(symbol: string): string {
  if (symbol.includes("_")) return symbol;
  if (symbol.length === 6 && /^[A-Z]+$/.test(symbol)) return `${symbol.slice(0, 3)}_${symbol.slice(3)}`;
  if (symbol === "EURUSD") return "EUR_USD";
  return symbol.replace("-", "_");
}

export class OandaAdapter implements BrokerAdapter {
  readonly id: "oanda_practice" | "oanda_live";
  readonly displayName: string;
  readonly readiness = "integration_untested" as const;
  readonly capabilities = {
    market: true,
    limit: true,
    stop: true,
    stopLimit: false,
    bracket: true,
    reduceOnly: true,
    paper: true,
    live: false,
  };

  constructor(
    private readonly environment: "practice" | "live" = (process.env.OANDA_ENV as "practice" | "live") ?? "practice",
    private readonly token = process.env.OANDA_API_TOKEN,
    private readonly accountId = process.env.OANDA_ACCOUNT_ID,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.id = environment === "live" ? "oanda_live" : "oanda_practice";
    this.displayName = environment === "live" ? "OANDA Live" : "OANDA Practice";
    this.capabilities.paper = environment !== "live";
    this.capabilities.live = environment === "live";
  }

  private baseUrl(): string {
    return this.environment === "live" ? LIVE_HOSTS.oandaLive : LIVE_HOSTS.oandaPractice;
  }

  private headers(): Record<string, string> {
    if (!this.token || !this.accountId) {
      throw new Error("OANDA token/account are not configured. Refusing to invent an order.");
    }
    if (this.environment === "live") assertLiveBrokerUrl(this.baseUrl());
    return { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" };
  }

  async connect(): Promise<void> {
    if (this.environment === "live") assertPaperOrAuthorizedLive("live", loadConfig().liveEnabled);
    await this.healthCheck();
  }

  async disconnect(): Promise<void> {
    return;
  }

  async healthCheck(): Promise<BrokerHealth> {
    const started = Date.now();
    try {
      const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/summary`, { headers: this.headers() });
      return {
        ok: res.ok,
        latencyMs: Date.now() - started,
        message: res.ok ? `oanda ${this.environment} reachable` : `oanda HTTP ${res.status}`,
        paper: this.environment !== "live",
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        message: error instanceof Error ? error.message : "oanda unreachable",
        paper: this.environment !== "live",
      };
    }
  }

  async getAccount(): Promise<BrokerAccount> {
    const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/summary`, { headers: this.headers() });
    if (!res.ok) throw new Error(`OANDA account error ${res.status}`);
    const body = (await res.json()) as { account: { id: string; currency: string; balance: string; NAV: string; marginAvailable: string } };
    return {
      brokerAccountId: body.account.id,
      currency: body.account.currency,
      cash: body.account.balance,
      equity: body.account.NAV,
      buyingPower: body.account.marginAvailable,
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/openPositions`, { headers: this.headers() });
    if (!res.ok) throw new Error(`OANDA positions error ${res.status}`);
    const body = (await res.json()) as {
      positions: Array<{ instrument: string; long: { units: string; averagePrice: string }; short: { units: string; averagePrice: string } }>;
    };
    return (body.positions ?? []).map((p) => {
      const longQty = Number(p.long.units);
      const shortQty = Number(p.short.units);
      const qty = longQty !== 0 ? p.long.units : p.short.units;
      const px = longQty !== 0 ? p.long.averagePrice : p.short.averagePrice;
      return { instrument: p.instrument.replace("_", ""), quantity: qty, averagePrice: px || "0", marketPrice: px || "0" };
    }).filter((p) => Number(p.quantity) !== 0);
  }

  async getOrders(): Promise<UniversalOrder[]> {
    const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/orders`, { headers: this.headers() });
    if (!res.ok) throw new Error(`OANDA orders error ${res.status}`);
    const body = (await res.json()) as { orders: Array<Record<string, string>> };
    return (body.orders ?? []).map((o) => this.toOrder(o));
  }

  async getMarketData(instrument: string): Promise<{ bid: string; ask: string; last: string; timestamp: string }> {
    const ins = oandaInstrument(instrument);
    const res = await this.fetchImpl(
      `${this.baseUrl()}/v3/accounts/${this.accountId}/pricing?instruments=${encodeURIComponent(ins)}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`OANDA pricing error ${res.status}`);
    const body = (await res.json()) as { prices: Array<{ bids?: Array<{ price: string }>; asks?: Array<{ price: string }>; time: string }> };
    const p = body.prices[0];
    const bid = p?.bids?.[0]?.price ?? "0";
    const ask = p?.asks?.[0]?.price ?? "0";
    return { bid, ask, last: ask || bid, timestamp: p?.time ?? new Date().toISOString() };
  }

  async submitOrder(req: SubmitOrderRequest): Promise<UniversalOrder> {
    if (this.environment === "live") assertPaperOrAuthorizedLive("live", loadConfig().liveEnabled);
    const units = req.side === "sell" ? `-${req.quantity}` : req.quantity;
    const order: Record<string, unknown> = {
      type: req.type === "limit" ? "LIMIT" : req.type === "stop" ? "STOP" : "MARKET",
      instrument: oandaInstrument(req.instrument),
      units,
      timeInForce: "FOK",
      positionFill: "DEFAULT",
    };
    if (req.limitPrice) order.price = req.limitPrice;
    if (req.stopPrice) order.priceBound = req.stopPrice;
    if (req.stopLossPrice) order.stopLossOnFill = { price: req.stopLossPrice };
    if (req.takeProfitPrice) order.takeProfitOnFill = { price: req.takeProfitPrice };
    const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/orders`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ order }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OANDA submit rejected (${res.status}): ${text}`);
    }
    const body = (await res.json()) as { orderCreateTransaction?: Record<string, string>; orderFillTransaction?: Record<string, string> };
    const tx = body.orderFillTransaction ?? body.orderCreateTransaction ?? {};
    return this.toOrder({ ...tx, instrument: oandaInstrument(req.instrument), units, type: String(order.type) });
  }

  async cancelOrder(brokerOrderId: string): Promise<UniversalOrder> {
    const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/orders/${brokerOrderId}/cancel`, {
      method: "PUT",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`OANDA cancel error ${res.status}`);
    return this.getOrderStatus(brokerOrderId);
  }

  async modifyOrder(): Promise<UniversalOrder> {
    throw new Error("OANDA modify is disabled until marked production-ready.");
  }

  async getOrderStatus(brokerOrderId: string): Promise<UniversalOrder> {
    const res = await this.fetchImpl(`${this.baseUrl()}/v3/accounts/${this.accountId}/orders/${brokerOrderId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`OANDA order status error ${res.status}`);
    const body = (await res.json()) as { order: Record<string, string> };
    return this.toOrder(body.order);
  }

  async reconcile() {
    const [orders, positions] = await Promise.all([this.getOrders(), this.getPositions()]);
    return { orders, positions };
  }

  private toOrder(o: Record<string, string>): UniversalOrder {
    const units = o.units ?? "0";
    const side: "buy" | "sell" = String(units).startsWith("-") ? "sell" : "buy";
    return {
      orderId: o.id ?? o.orderID ?? "unknown",
      clientOrderId: o.clientExtensions ?? o.id ?? "unknown",
      userId: "oanda",
      accountId: this.accountId ?? "oanda",
      broker: this.id,
      environment: this.environment === "live" ? "live" : "paper",
      instrument: (o.instrument ?? "").replace("_", ""),
      side,
      type: "market",
      timeInForce: "fok",
      quantity: String(Math.abs(Number(units))),
      filledQuantity: o.units ? String(Math.abs(Number(units))) : "0",
      status: o.state === "FILLED" || o.id ? "filled" : "submitted",
      submittedAt: o.time ?? new Date().toISOString(),
      updatedAt: o.time ?? new Date().toISOString(),
      brokerOrderId: o.id,
    };
  }
}
