import { describe, expect, it } from "vitest";
import { AlpacaPaperAdapter } from "@/server/alpaca";
import { AlpacaDataProvider } from "@/server/providers/alpaca-data";

function fixtureFetch(routes: Record<string, { status: number; body: unknown }>): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response("missing fixture", { status: 404 });
    const hit = routes[key];
    if (init?.method === "POST" && key === "/v2/orders" && typeof hit.body === "object" && hit.body) {
      return new Response(JSON.stringify(hit.body), { status: hit.status });
    }
    return new Response(typeof hit.body === "string" ? hit.body : JSON.stringify(hit.body), { status: hit.status });
  };
}

const clock = { timestamp: "2026-01-02T15:00:00Z", is_open: true };
const account = {
  id: "acct_paper",
  currency: "USD",
  cash: "100000",
  equity: "100000",
  buying_power: "200000",
  pattern_day_trader: false,
};
const submitted = {
  id: "ord_1",
  client_order_id: "clord_1",
  symbol: "SPY",
  side: "buy",
  type: "market",
  time_in_force: "day",
  qty: "1",
  filled_qty: "0",
  status: "accepted",
  submitted_at: "2026-01-02T15:00:00Z",
  updated_at: "2026-01-02T15:00:00Z",
};

describe("Alpaca paper adapter contract", () => {
  it("maps fixture account, clock, and order JSON", async () => {
    const adapter = new AlpacaPaperAdapter("key", "secret", "https://paper-api.alpaca.markets", fixtureFetch({
      "/v2/clock": { status: 200, body: clock },
      "/v2/account": { status: 200, body: account },
      "/v2/orders": { status: 200, body: submitted },
    }));
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.paper).toBe(true);
    const acct = await adapter.getAccount();
    expect(acct.equity).toBe("100000");
    const order = await adapter.submitOrder({
      instrument: "SPY",
      side: "buy",
      type: "market",
      timeInForce: "day",
      quantity: "1",
      clientOrderId: "clord_1",
    });
    expect(order.status).toBe("accepted");
    expect(order.environment).toBe("paper");
    expect(order.broker).toBe("alpaca_paper");
  });

  it("does not invent success on HTTP errors or missing keys", async () => {
    const failing = new AlpacaPaperAdapter("key", "secret", "https://paper-api.alpaca.markets", fixtureFetch({
      "/v2/account": { status: 401, body: { message: "unauthorized" } },
      "/v2/orders": { status: 422, body: { message: "rejected" } },
    }));
    await expect(failing.getAccount()).rejects.toThrow(/401/);
    await expect(
      failing.submitOrder({
        instrument: "SPY",
        side: "buy",
        type: "market",
        timeInForce: "day",
        quantity: "1",
        clientOrderId: "clord_x",
      }),
    ).rejects.toThrow(/422/);

    const unconfigured = new AlpacaPaperAdapter(undefined, undefined, "https://paper-api.alpaca.markets", fetch);
    const health = await unconfigured.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.message).toMatch(/not configured/);
  });
});

describe("Alpaca data provider", () => {
  it("refuses to invent bars without keys", async () => {
    const provider = new AlpacaDataProvider(undefined, undefined, "https://data.alpaca.markets", fetch);
    await expect(provider.getBars({ instrument: "SPY", assetClass: "etf", timeframe: "1d" })).rejects.toThrow(/Refusing to invent bars/);
  });

  it("maps fixture bar JSON", async () => {
    const provider = new AlpacaDataProvider("key", "secret", "https://data.alpaca.markets", async () =>
      new Response(
        JSON.stringify({ bars: [{ t: "2026-01-02T00:00:00Z", o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }] }),
        { status: 200 },
      ),
    );
    const bars = await provider.getBars({ instrument: "SPY", assetClass: "etf", timeframe: "1d" });
    expect(bars[0].close).toBe("1.5");
    expect(bars[0].provenance.provider).toBe("alpaca_data");
  });
});
