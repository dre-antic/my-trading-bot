import { afterEach, describe, expect, it } from "vitest";
import { AlpacaLiveAdapter } from "@/server/alpaca-live";
import { OandaAdapter, oandaInstrument } from "@/server/oanda";
import { LIVE_HOSTS } from "@/core/live-safety";

function fixtureFetch(assertUrl?: (url: string) => void): typeof fetch {
  return async (input) => {
    const url = String(input);
    assertUrl?.(url);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  };
}

describe("live broker adapters refuse paper paths", () => {
  const prevPaper = process.env.ALPACA_PAPER_KEY;
  const prevLiveUrl = process.env.ALPACA_LIVE_BASE_URL;

  afterEach(() => {
    if (prevPaper === undefined) delete process.env.ALPACA_PAPER_KEY;
    else process.env.ALPACA_PAPER_KEY = prevPaper;
    if (prevLiveUrl === undefined) delete process.env.ALPACA_LIVE_BASE_URL;
    else process.env.ALPACA_LIVE_BASE_URL = prevLiveUrl;
  });
  it("Alpaca live refuses a paper host", async () => {
    delete process.env.ALPACA_PAPER_KEY;
    const adapter = new AlpacaLiveAdapter("live-key", "live-secret", LIVE_HOSTS.alpacaPaper, fixtureFetch());
    await expect(adapter.getAccount()).rejects.toThrow(/paper/i);
  });

  it("Alpaca live refuses missing keys instead of inventing an order", async () => {
    const adapter = new AlpacaLiveAdapter(undefined, undefined, LIVE_HOSTS.alpacaLive, fixtureFetch());
    await expect(adapter.getAccount()).rejects.toThrow(/not configured/i);
  });

  it("Alpaca live pins allowlisted host when fetch is invoked", async () => {
    const seen: string[] = [];
    const adapter = new AlpacaLiveAdapter("live-key", "live-secret", LIVE_HOSTS.alpacaLive, fixtureFetch((url) => seen.push(url)));
    await adapter.getAccount().catch(() => undefined);
    expect(seen[0]).toContain("api.alpaca.markets");
    expect(seen[0]).not.toContain("paper-api");
  });

  it("OANDA live uses fxtrade and never fxpractice", async () => {
    const seen: string[] = [];
    process.env.OANDA_API_TOKEN = "token";
    process.env.OANDA_ACCOUNT_ID = "acct";
    const adapter = new OandaAdapter("live", "token", "acct", fixtureFetch((url) => seen.push(url)));
    await adapter.getAccount();
    expect(seen[0]).toContain("api-fxtrade.oanda.com");
    expect(seen[0]).not.toContain("fxpractice");
  });

  it("maps EURUSD to OANDA instrument form", () => {
    expect(oandaInstrument("EURUSD")).toBe("EUR_USD");
  });
});
