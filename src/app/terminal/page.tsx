"use client";

import { AppFrame } from "@/ui/AppFrame";
import { CandleChart } from "@/ui/CandleChart";
import { api } from "@/ui/api";
import { useCallback, useEffect, useState } from "react";

type WatchRow = {
  symbol: string;
  assetClass: string;
  last: string;
  bid: string;
  ask: string;
  changePct: string;
};

type TerminalData = {
  symbol: string;
  watch: WatchRow[];
  chart: { last: string; bid: string; ask: string; provider: string; bars: Array<{ t: string; o: string; h: string; l: string; c: string }> };
  portfolio: { equity: string; cash: string; currency: string; unrealizedPnl: string; positions: Array<Record<string, string>> };
  orders: Array<Record<string, string>>;
  fills: Array<Record<string, string>>;
  experts: Array<Record<string, string | number>>;
  strategies: Array<{ strategyId: string; name: string }>;
  flags: { display_mode: string; trading_mode: string };
  live: { envLiveEnabled: boolean; control: { liveEnabled: boolean; armedUntil: string | null; halted: boolean }; brokers: Record<string, unknown> };
  phrases: { place: string };
};

export default function TerminalPage() {
  const [symbol, setSymbol] = useState("SPY");
  const [tab, setTab] = useState<"trade" | "history" | "experts">("trade");
  const [data, setData] = useState<TerminalData | null>(null);
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [qty, setQty] = useState("1");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [livePhrase, setLivePhrase] = useState("");
  const [execution, setExecution] = useState<"paper" | "live">("paper");
  const [msg, setMsg] = useState("");
  const [expertStrategy, setExpertStrategy] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (sym = symbol) => {
    const next = await api<TerminalData>(`/api/terminal?symbol=${encodeURIComponent(sym)}`);
    setData(next);
    setSymbol(next.symbol);
    if (!expertStrategy && next.strategies[0]) setExpertStrategy(next.strategies[0].strategyId);
    return next;
  }, [symbol, expertStrategy]);

  useEffect(() => {
    load("SPY").catch((e) => setMsg(e instanceof Error ? e.message : "load failed"));
    const t = setInterval(() => {
      load(symbol).catch(() => undefined);
    }, 12_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(sym: string) {
    setSymbol(sym);
    setMsg("");
    await load(sym);
  }

  async function submit(nextSide: "buy" | "sell", oneClick = false) {
    setBusy(true);
    setMsg("");
    try {
      const last = data?.chart.last ?? "0";
      const payload = {
        instrument: symbol,
        side: nextSide,
        type: oneClick ? "market" : type,
        quantity: qty,
        stopLoss: stopLoss || undefined,
        takeProfit: takeProfit || undefined,
        limitPrice: type === "limit" && !oneClick ? limitPrice || last : undefined,
        stopPrice: type === "stop" && !oneClick ? limitPrice || last : undefined,
        execution: oneClick ? "paper" : execution,
        livePhrase: execution === "live" && !oneClick ? livePhrase : undefined,
      };
      const res = await api<{ resultKind: string; orderId?: string; status?: string }>("/api/ticket", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMsg(`${res.resultKind} ${nextSide} ${symbol} · ${res.status ?? "submitted"}`);
      setLivePhrase("");
      await load(symbol);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "order failed");
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    if (!expertStrategy) return;
    await api("/api/experts", { method: "POST", body: JSON.stringify({ action: "attach", strategyId: expertStrategy, symbol }) });
    await load(symbol);
  }

  async function runExperts() {
    const res = await api<{ candidates: unknown[] }>("/api/experts", { method: "POST", body: JSON.stringify({ action: "run", symbol }) });
    setMsg(`Experts produced ${res.candidates.length} candidate(s). Review Opportunities to approve.`);
    await load(symbol);
  }

  const last = data?.chart.last ?? "—";
  const liveArmed = Boolean(data?.live.control.armedUntil && new Date(data.live.control.armedUntil).getTime() > Date.now());

  return (
    <AppFrame dense>
      <div className="terminal">
        <aside className="terminal-watch card">
          <h3>Market Watch</h3>
          <table className="table compact">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {(data?.watch ?? []).map((w) => (
                <tr key={w.symbol} className={w.symbol === symbol ? "selected" : ""} onClick={() => pick(w.symbol)}>
                  <td>
                    <strong>{w.symbol}</strong>
                    <div className="muted">{w.assetClass}</div>
                  </td>
                  <td className="mono">{w.bid}</td>
                  <td className="mono">{w.ask}</td>
                  <td className={Number(w.changePct) < 0 ? "neg" : "pos"}>{w.changePct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </aside>

        <section className="terminal-chart card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>{symbol} · {last}</h3>
              <p className="muted">
                Bid {data?.chart.bid ?? "—"} / Ask {data?.chart.ask ?? "—"} · {data?.chart.provider ?? "…"} · one-click live disabled
              </p>
            </div>
            <div className="row">
              <button className="btn buy" disabled={busy} onClick={() => submit("buy", true)}>Buy {qty}</button>
              <button className="btn sell" disabled={busy} onClick={() => submit("sell", true)}>Sell {qty}</button>
            </div>
          </div>
          <CandleChart bars={data?.chart.bars ?? []} />
        </section>

        <aside className="terminal-ticket card">
          <h3>Order Ticket</h3>
          <label>Volume</label>
          <input value={qty} onChange={(e) => setQty(e.target.value)} />
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
          </select>
          {type !== "market" ? (
            <>
              <label>Price</label>
              <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={last} />
            </>
          ) : null}
          <label>Stop Loss</label>
          <input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="required by constitution" />
          <label>Take Profit</label>
          <input value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
          <label>Execution</label>
          <select value={execution} onChange={(e) => setExecution(e.target.value as typeof execution)}>
            <option value="paper">Paper (simulated)</option>
            <option value="live">Live (real money)</option>
          </select>
          {execution === "live" ? (
            <>
              <p className="neg">Live requires env flag, ENABLE LIVE TRADING, ARM LIVE SESSION, and this phrase. One-click live is off.</p>
              <label>Type PLACE LIVE ORDER</label>
              <input value={livePhrase} onChange={(e) => setLivePhrase(e.target.value)} autoComplete="off" />
              <p className="muted">Armed: {liveArmed ? "yes" : "no"} · Halted: {data?.live.control.halted ? "yes" : "no"}</p>
            </>
          ) : (
            <p className="muted">Paper fills are labeled simulated. Chart Buy/Sell is paper-only one-click.</p>
          )}
          <div className="row">
            <button className="btn buy" disabled={busy} onClick={() => void submit("buy")}>Buy by Market</button>
            <button className="btn sell" disabled={busy} onClick={() => void submit("sell")}>Sell by Market</button>
          </div>
          {msg ? <p className={msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("not") ? "neg" : "pos"}>{msg}</p> : null}
        </aside>

        <section className="terminal-bottom card">
          <div className="row terminal-tabs">
            <button className={tab === "trade" ? "btn" : "btn secondary"} onClick={() => setTab("trade")}>Trade</button>
            <button className={tab === "history" ? "btn" : "btn secondary"} onClick={() => setTab("history")}>History</button>
            <button className={tab === "experts" ? "btn" : "btn secondary"} onClick={() => setTab("experts")}>Experts</button>
            <span className="muted mono">Equity {data?.portfolio.equity ?? "—"} {data?.portfolio.currency ?? ""} · uP/L {data?.portfolio.unrealizedPnl ?? "0"}</span>
          </div>
          {tab === "trade" ? (
            <table className="table compact">
              <thead>
                <tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Mkt</th><th>uP/L</th></tr>
              </thead>
              <tbody>
                {(data?.portfolio.positions ?? []).map((p) => (
                  <tr key={p.instrument}>
                    <td>{p.instrument}</td>
                    <td className="mono">{p.quantity}</td>
                    <td className="mono">{p.averagePrice}</td>
                    <td className="mono">{p.marketPrice}</td>
                    <td className={Number(p.unrealizedPnl) < 0 ? "neg" : "pos"}>{p.unrealizedPnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === "history" ? (
            <table className="table compact">
              <thead>
                <tr><th>When</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Status</th><th>Env</th></tr>
              </thead>
              <tbody>
                {(data?.orders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.submitted_at}</td>
                    <td>{o.instrument}</td>
                    <td>{o.side}</td>
                    <td className="mono">{o.quantity}</td>
                    <td>{o.status}</td>
                    <td>{o.broker}/{o.environment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === "experts" ? (
            <div>
              <p className="muted">Attach a strategy to this chart. Run produces candidates for human approval. Experts never place live orders.</p>
              <div className="row">
                <select value={expertStrategy} onChange={(e) => setExpertStrategy(e.target.value)}>
                  {(data?.strategies ?? []).map((s) => (
                    <option key={s.strategyId} value={s.strategyId}>{s.name}</option>
                  ))}
                </select>
                <button className="btn secondary" onClick={attach}>Attach to {symbol}</button>
                <button className="btn" onClick={runExperts}>Run experts</button>
              </div>
              <table className="table compact">
                <thead><tr><th>Strategy</th><th>Symbol</th><th>On</th></tr></thead>
                <tbody>
                  {(data?.experts ?? []).map((e) => (
                    <tr key={String(e.id)}>
                      <td className="mono">{String(e.strategy_id)}</td>
                      <td>{String(e.symbol)}</td>
                      <td>{Number(e.enabled) ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </AppFrame>
  );
}
