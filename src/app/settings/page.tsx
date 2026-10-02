"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [constitution, setConstitution] = useState<Record<string, unknown> | null>(null);
  const [phrase, setPhrase] = useState("");
  const [msg, setMsg] = useState("");
  const [symbol, setSymbol] = useState("SPY");
  const [engine, setEngine] = useState<Record<string, unknown> | null>(null);
  const [market, setMarket] = useState<Record<string, unknown> | null>(null);
  const [live, setLive] = useState<Record<string, unknown> | null>(null);
  const [livePhrase, setLivePhrase] = useState("");
  useEffect(() => {
    api<{ constitution: Record<string, unknown> }>("/api/constitution").then((d) => setConstitution(d.constitution));
    api<Record<string, unknown>>("/api/engine").then(setEngine);
    api<Record<string, unknown>>("/api/market-data").then(setMarket);
    api<Record<string, unknown>>("/api/live").then(setLive);
  }, []);
  async function emergency(action: string, confirm: string) {
    try {
      await api("/api/emergency", { method: "POST", body: JSON.stringify({ action, confirmPhrase: confirm }) });
      setMsg(`${action} executed`);
      setLive(await api<Record<string, unknown>>("/api/live"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    }
  }
  async function liveAction(action: string) {
    try {
      const confirmPhrase =
        action === "disarm" ? "DISARM LIVE" : action === "disable" ? "DISABLE LIVE TRADING" : livePhrase;
      await api("/api/live", { method: "POST", body: JSON.stringify({ action, confirmPhrase }) });
      setLive(await api<Record<string, unknown>>("/api/live"));
      setMsg(`${action} ok`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "live action failed");
    }
  }
  async function refreshBars() {
    try {
      const res = await api<{ symbol: string; bars: number; provider?: string; source?: string; note?: string }>("/api/market-data/refresh", {
        method: "POST",
        body: JSON.stringify({ symbol, assetClass: symbol === "BTC-USD" ? "crypto" : symbol === "EURUSD" ? "forex" : "etf" }),
      });
      setMsg(`Refreshed ${res.symbol}: ${res.bars} bars from ${res.provider ?? "unknown"} (${res.source ?? "n/a"})${res.note ? ` — ${res.note}` : ""}`);
      setMarket(await api<Record<string, unknown>>("/api/market-data"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "refresh failed");
    }
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <AppFrame>
      <h1>Settings</h1>
      <div className="card">
        <h3>Trading Constitution v{String(constitution?.version ?? "")}</h3>
        <p className="muted">AI agents cannot change this document. A new version requires your authorization.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(constitution, null, 2)}</pre>
      </div>
      <div className="card">
        <h3>Market data</h3>
        <p className="muted">Demo mode can use labeled synthetic bars. Paper/live refuse silent synthetic substitution. Stooq is the no-key historical alternative.</p>
        <p className="muted">Provider: {String((market?.provider as { displayName?: string } | undefined)?.displayName ?? "…")} · mode {String(market?.mode ?? "")}</p>
        <label>Instrument</label>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          <option value="SPY">SPY</option>
          <option value="AAPL">AAPL</option>
          <option value="EURUSD">EURUSD</option>
          <option value="BTC-USD">BTC-USD</option>
        </select>
        <button className="btn" onClick={refreshBars}>Refresh bars</button>
      </div>
      <div className="card">
        <h3>Trading engine</h3>
        <p className="muted">Native TypeScript engine is the default. LEAN CLI is probed only; missing or unconfigured CLI never invents LEAN results.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(engine, null, 2)}</pre>
      </div>
      <div className="card">
        <h3>Live trading (fail-closed)</h3>
        <p className="muted">
          Real-money orders stay blocked until ATCC_LIVE_ENABLED=true, SESSION_SECRET is not the example value,
          you type ENABLE LIVE TRADING, display is live, you type ARM LIVE SESSION (15 minutes), and each ticket
          types PLACE LIVE ORDER. AI cannot skip this. Brokers are not marked production-ready.
        </p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(live, null, 2)}</pre>
        <label>Type the exact live phrase (ENABLE LIVE TRADING / ARM LIVE SESSION / DISABLE LIVE TRADING / ARM reset: RESET CIRCUIT BREAKER)</label>
        <input value={livePhrase} onChange={(e) => setLivePhrase(e.target.value)} autoComplete="off" />
        <div className="row">
          <button className="btn" onClick={() => liveAction("enable")}>Enable live</button>
          <button className="btn" onClick={() => liveAction("arm")}>Arm 15 min</button>
          <button className="btn secondary" onClick={() => liveAction("disarm")}>Disarm</button>
          <button className="btn danger" onClick={() => liveAction("disable")}>Disable live</button>
          <button className="btn secondary" onClick={() => liveAction("reset_breaker")}>Reset breaker</button>
        </div>
      </div>
      <div className="card">
        <h3>Emergency controls</h3>
        <p className="muted">High-risk actions require the exact confirmation phrase. Kill switch also sits in the top banner.</p>
        <div className="row">
          <button className="btn secondary" onClick={() => emergency("STOP_NEW_TRADES", "STOP NEW TRADES")}>Stop new trades</button>
          <button className="btn secondary" onClick={() => emergency("STOP_AUTOMATION", "STOP AUTOMATION")}>Stop automation</button>
          <button className="btn secondary" onClick={() => emergency("CANCEL_OPEN_ORDERS", "CANCEL OPEN ORDERS")}>Cancel open orders</button>
          <button className="btn danger" onClick={() => emergency("DISARM_LIVE", "DISARM LIVE")}>Disarm live</button>
          <button className="btn danger" onClick={() => emergency("DISABLE_LIVE", "DISABLE LIVE TRADING")}>Disable live</button>
        </div>
        <label>Type CLOSE ALL POSITIONS to flatten paper book</label>
        <input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        <button className="btn danger" onClick={() => emergency("CLOSE_ALL_POSITIONS", phrase)}>Close all positions</button>
        {msg ? <p>{msg}</p> : null}
      </div>
      <button className="btn secondary" onClick={logout}>Sign out</button>
    </AppFrame>
  );
}
