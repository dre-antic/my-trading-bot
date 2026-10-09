"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, uploadForm } from "@/ui/api";
import { MT5_TIMEFRAMES, type Mt5Timeframe } from "@/core/timeframes";
import { LightweightChart, type ChartStyle } from "./LightweightChart";
import "./mt5.css";

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
  timeframe?: string;
  watch: WatchRow[];
  chart: { last: string; bid: string; ask: string; provider: string; bars: Array<{ t: string; o: string; h: string; l: string; c: string; v?: string }> };
  portfolio: { equity: string; cash: string; currency: string; unrealizedPnl: string; positions: Array<Record<string, string>> };
  orders: Array<Record<string, string>>;
  fills: Array<Record<string, string>>;
  experts: Array<Record<string, string | number>>;
  strategies: Array<{ strategyId: string; name: string; lifecycle?: string }>;
  flags: { display_mode: string; trading_mode: string };
  live: { envLiveEnabled: boolean; control: { liveEnabled: boolean; armedUntil: string | null; halted: boolean } };
  phrases: { place: string };
  journal?: Array<Record<string, string>>;
  alerts?: Array<Record<string, string>>;
  serverTime?: string;
};

type IngestResult = {
  documentId: string;
  strategyId: string;
  filename: string;
  kind: string;
  extractedText: string;
  interpretation: { rules: Array<{ sourceText: string; interpretation: string; confidence: string; field: string }>; ambiguities: string[]; disclaimer: string };
  compiled: {
    definition: { name: string; instruments: string[]; timeframe: string };
    evidence: Array<{ quote: string; field: string }>;
    uncompiled: string[];
    needsClarification: string[];
  };
  usedLlm: boolean;
  warnings: string[];
};

type TesterResult = {
  full?: { metrics?: { trades?: number; winRate?: string; profitFactor?: string; maxDrawdown?: string; totalReturn?: string } };
};

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/opportunities", "Opportunities"],
  ["/strategies", "Strategies"],
  ["/laboratory", "Laboratory"],
  ["/brokers", "Brokers"],
  ["/settings", "Settings"],
  ["/journal", "Journal"],
];

export function Mt5Terminal() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<Mt5Timeframe>("H1");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candle");
  const [data, setData] = useState<TerminalData | null>(null);
  const [qty, setQty] = useState("0.10");
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showWatch, setShowWatch] = useState(true);
  const [showNav, setShowNav] = useState(true);
  const [showBox, setShowBox] = useState(true);
  const [showTester, setShowTester] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showIngest, setShowIngest] = useState(false);
  const [watchTab, setWatchTab] = useState<"symbols" | "details" | "trading">("symbols");
  const [boxTab, setBoxTab] = useState<"trade" | "exposure" | "history" | "news" | "alerts" | "experts" | "journal">("trade");
  const [expertStrategy, setExpertStrategy] = useState("");
  const [ingest, setIngest] = useState<IngestResult | null>(null);
  const [paste, setPaste] = useState("");
  const [tester, setTester] = useState<TesterResult | null>(null);
  const [clock, setClock] = useState("");

  const load = useCallback(async (sym = symbol, tf = timeframe) => {
    const next = await api<TerminalData>(`/api/terminal?symbol=${encodeURIComponent(sym)}&timeframe=${encodeURIComponent(tf)}`);
    setData(next);
    setSymbol(next.symbol);
    if (!expertStrategy && next.strategies[0]) setExpertStrategy(next.strategies[0].strategyId);
    return next;
  }, [symbol, timeframe, expertStrategy]);

  useEffect(() => {
    api("/api/auth/me").catch(() => router.push("/login"));
    load("EURUSD", "H1").catch((e) => setMsg(e instanceof Error ? e.message : "load failed"));
    const poll = setInterval(() => {
      load(symbol, timeframe).catch(() => undefined);
    }, 12_000);
    const tickClock = () => setClock(new Date().toISOString().slice(11, 19));
    tickClock();
    const tick = setInterval(tickClock, 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "m") { e.preventDefault(); setShowWatch((v) => !v); }
      if (k === "n") { e.preventDefault(); setShowNav((v) => !v); }
      if (k === "t") { e.preventDefault(); setShowBox((v) => !v); }
      if (k === "r") { e.preventDefault(); setShowTester((v) => !v); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function pick(sym: string) {
    setSymbol(sym);
    setMsg("");
    if (data?.watch.find((w) => w.symbol === sym)?.assetClass === "forex") setQty("0.10");
    else setQty("1");
    await load(sym, timeframe);
  }

  async function changeTf(tf: Mt5Timeframe) {
    setTimeframe(tf);
    await load(symbol, tf);
  }

  async function submit(nextSide: "buy" | "sell", oneClick = false) {
    setBusy(true);
    setMsg("");
    try {
      const last = data?.chart.last ?? "0";
      const res = await api<{ resultKind: string; orderId?: string; status?: string }>("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          instrument: symbol,
          side: nextSide,
          type: oneClick ? "market" : type,
          quantity: qty,
          stopLoss: stopLoss || undefined,
          takeProfit: takeProfit || undefined,
          limitPrice: type === "limit" && !oneClick ? limitPrice || last : undefined,
          stopPrice: type === "stop" && !oneClick ? limitPrice || last : undefined,
          execution: "paper",
        }),
      });
      setMsg(`${res.resultKind} ${nextSide} ${symbol} · ${res.status ?? "submitted"}`);
      await load(symbol, timeframe);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "order failed");
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    if (!expertStrategy) return;
    await api("/api/experts", { method: "POST", body: JSON.stringify({ action: "attach", strategyId: expertStrategy, symbol }) });
    await load(symbol, timeframe);
    setMsg(`Expert attached to ${symbol}`);
  }

  async function runExperts() {
    const res = await api<{ candidates: unknown[] }>("/api/experts", { method: "POST", body: JSON.stringify({ action: "run", symbol }) });
    setMsg(`Experts produced ${res.candidates.length} candidate(s). Review Opportunities to approve.`);
    await load(symbol, timeframe);
  }

  async function onUpload(file: File | null) {
    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      if (paste) {
        form.append("text", paste);
        form.append("filename", file?.name ?? "pasted.txt");
      }
      const result = await uploadForm<IngestResult>("/api/strategies/ingest", form);
      setIngest(result);
      setExpertStrategy(result.strategyId);
      setMsg(`Draft expert ${result.compiled.definition.name} ready for review.`);
      await load(symbol, timeframe);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "ingest failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft(attachExpert = true) {
    if (!ingest) return;
    const res = await api<{ strategyId: string }>("/api/strategies/ingest/confirm", {
      method: "POST",
      body: JSON.stringify({ documentId: ingest.documentId, attach: attachExpert, symbol }),
    });
    setMsg(`Confirmed ${res.strategyId}${attachExpert ? ` · attached to ${symbol}` : ""}`);
    setShowIngest(false);
    await load(symbol, timeframe);
  }

  async function runTester() {
    if (!expertStrategy) return;
    setBusy(true);
    try {
      const res = await api<TesterResult>(`/api/strategies/${expertStrategy}/backtest`, { method: "POST" });
      setTester(res);
      setMsg("Strategy Tester finished (historical simulation, not a live result).");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "tester failed");
    } finally {
      setBusy(false);
    }
  }

  async function kill() {
    await api("/api/emergency", { method: "POST", body: JSON.stringify({ action: "DISARM_LIVE", confirmPhrase: "DISARM LIVE" }) });
    await api("/api/emergency", { method: "POST", body: JSON.stringify({ action: "STOP_NEW_TRADES", confirmPhrase: "STOP NEW TRADES" }) });
    window.location.reload();
  }

  const last = data?.chart.last ?? "—";
  const selectedWatch = data?.watch.find((w) => w.symbol === symbol);
  const leftClass = useMemo(() => {
    if (showWatch && showNav) return "";
    if (showWatch) return "watch-only";
    if (showNav) return "nav-only";
    return "";
  }, [showWatch, showNav]);
  const showLeft = showWatch || showNav;

  return (
    <div className="mt5-root">
      <div className="mt5-title">
        <strong>1001: Demo Operator — Trading Terminal — {symbol},{timeframe}</strong>
        <div className="mt5-winbtns"><span>_</span><span>□</span><span>✕</span></div>
      </div>

      <nav className="mt5-menu">
        <Menu label="File">
          <button type="button" onClick={() => setShowOrder(true)}>New Order</button>
          <button type="button" onClick={() => setShowIngest(true)}>Open Strategy File…</button>
          <Link href="/brokers">Accounts</Link>
          <hr />
          <button
            type="button"
            onClick={async () => {
              await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              router.push("/login");
            }}
          >
            Exit
          </button>
        </Menu>
        <Menu label="View">
          <button type="button" onClick={() => setShowWatch((v) => !v)}>Market Watch{"\u00a0"}Ctrl+M</button>
          <button type="button" onClick={() => setShowNav((v) => !v)}>Navigator{"\u00a0"}Ctrl+N</button>
          <button type="button" onClick={() => setShowBox((v) => !v)}>Toolbox{"\u00a0"}Ctrl+T</button>
          <button type="button" onClick={() => setShowTester((v) => !v)}>Strategy Tester{"\u00a0"}Ctrl+R</button>
        </Menu>
        <Menu label="Insert">
          <button type="button" onClick={() => setChartStyle("candle")}>Candlesticks</button>
          <button type="button" onClick={() => setMsg("Crosshair is on. Trendlines are display-only in v1.")}>Trendline</button>
        </Menu>
        <Menu label="Charts">
          <button type="button" onClick={() => setChartStyle("candle")}>Candlesticks</button>
          <button type="button" onClick={() => setChartStyle("bar")}>Bars</button>
          <button type="button" onClick={() => setChartStyle("line")}>Line</button>
        </Menu>
        <Menu label="Tools">
          <button type="button" onClick={() => setShowOrder(true)}>New Order</button>
          <button type="button" onClick={() => setShowTester(true)}>Strategy Tester</button>
          <Link href="/settings">Options</Link>
          <Link href="/laboratory">Laboratory</Link>
        </Menu>
        <Menu label="Window">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </Menu>
        <Menu label="Help">
          <button type="button" onClick={() => setMsg("Paper terminal inspired by the public MetaTrader 5 layout. Not affiliated with MetaQuotes. Not financial advice.")}>About</button>
        </Menu>
      </nav>

      <div className="mt5-toolbars">
        <div className="mt5-tb">
          <button type="button" onClick={() => setShowOrder(true)}>New Order</button>
          <button type="button" onClick={() => setShowWatch((v) => !v)} className={showWatch ? "active" : ""}>Watch</button>
          <button type="button" onClick={() => setShowNav((v) => !v)} className={showNav ? "active" : ""}>Navigator</button>
          <button type="button" onClick={() => setShowBox((v) => !v)} className={showBox ? "active" : ""}>Toolbox</button>
        </div>
        <div className="mt5-tb">
          <button type="button" className={chartStyle === "bar" ? "active" : ""} onClick={() => setChartStyle("bar")}>OHLC</button>
          <button type="button" className={chartStyle === "candle" ? "active" : ""} onClick={() => setChartStyle("candle")}>Candles</button>
          <button type="button" className={chartStyle === "line" ? "active" : ""} onClick={() => setChartStyle("line")}>Line</button>
        </div>
        <div className="mt5-tb">
          {MT5_TIMEFRAMES.map((tf) => (
            <button key={tf} type="button" className={tf === timeframe ? "active" : ""} onClick={() => void changeTf(tf)}>{tf}</button>
          ))}
        </div>
      </div>

      <div className={`mt5-body ${showLeft ? "" : "no-left"}`}>
        {showLeft ? (
          <aside className={`mt5-left ${leftClass}`}>
            {showWatch ? (
              <section className="mt5-pane">
                <div className="mt5-pane-h"><h3 style={{ margin: 0, fontSize: 12 }}>Market Watch</h3><span className="muted">{data?.flags.display_mode ?? "demo"}</span></div>
                <div className="mt5-tabs">
                  <button type="button" className={watchTab === "symbols" ? "on" : ""} onClick={() => setWatchTab("symbols")}>Symbols</button>
                  <button type="button" className={watchTab === "details" ? "on" : ""} onClick={() => setWatchTab("details")}>Details</button>
                  <button type="button" className={watchTab === "trading" ? "on" : ""} onClick={() => setWatchTab("trading")}>Trading</button>
                </div>
                <div className="mt5-scroll">
                  {watchTab === "symbols" ? (
                    <table className="mt5-table">
                      <thead><tr><th>Symbol</th><th>Bid</th><th>Ask</th></tr></thead>
                      <tbody>
                        {(data?.watch ?? []).map((w) => (
                          <tr key={w.symbol} className={w.symbol === symbol ? "sel" : ""} onClick={() => void pick(w.symbol)}>
                            <td>{w.symbol}</td>
                            <td className="mt5-bid mt5-quote">{w.bid}</td>
                            <td className="mt5-ask mt5-quote">{w.ask}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                  {watchTab === "details" && selectedWatch ? (
                    <div className="mt5-tree">
                      <p>{selectedWatch.symbol} · {selectedWatch.assetClass}</p>
                      <p>Last {selectedWatch.last} · {selectedWatch.changePct}%</p>
                      <p>Provider {data?.chart.provider}</p>
                    </div>
                  ) : null}
                  {watchTab === "trading" ? (
                    <div className="mt5-tree">
                      <p>One-click trading is paper-only.</p>
                      <div className="mt5-oct">
                        <button type="button" className="sell" disabled={busy} onClick={() => void submit("sell", true)}>Sell {data?.chart.bid}</button>
                        <button type="button" className="buy" disabled={busy} onClick={() => void submit("buy", true)}>Buy {data?.chart.ask}</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
            {showNav ? (
              <section className="mt5-pane">
                <div className="mt5-pane-h"><span>Navigator</span></div>
                <div className="mt5-scroll mt5-tree">
                  <details open>
                    <summary>Accounts</summary>
                    <button type="button" className="link">Internal Paper 1001</button>
                  </details>
                  <details>
                    <summary>Indicators</summary>
                    <button type="button" className="link">Moving Average</button>
                    <button type="button" className="link">RSI</button>
                    <button type="button" className="link">MACD</button>
                    <button type="button" className="link">Bollinger Bands</button>
                  </details>
                  <details open>
                    <summary>Expert Advisors</summary>
                    <button type="button" className="link" onClick={() => setShowIngest(true)}>New… (audio, video, file)</button>
                    {(data?.strategies ?? []).map((s) => (
                      <button
                        key={s.strategyId}
                        type="button"
                        className="link"
                        onClick={() => { setExpertStrategy(s.strategyId); setBoxTab("experts"); }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </details>
                  <details>
                    <summary>Scripts</summary>
                    <button type="button" className="link" onClick={() => setShowTester(true)}>Run Strategy Tester</button>
                  </details>
                </div>
              </section>
            ) : null}
          </aside>
        ) : null}

        <section className={`mt5-center ${showBox ? "" : "no-box"}`}>
          <div className="mt5-chart">
            <div className="mt5-chart-bar">
              <div>
                <strong>{symbol}, {timeframe}</strong>
                <span className="mt5-quote"> · {last} · Bid {data?.chart.bid ?? "—"} / Ask {data?.chart.ask ?? "—"} · {data?.chart.provider}</span>
              </div>
              <div className="mt5-oct">
                <button type="button" className="sell" disabled={busy} onClick={() => void submit("sell")}>Sell by Market</button>
                <input aria-label="Volume" value={qty} onChange={(e) => setQty(e.target.value)} />
                <button type="button" className="buy" disabled={busy} onClick={() => void submit("buy")}>Buy by Market</button>
              </div>
            </div>
            <LightweightChart bars={data?.chart.bars ?? []} bid={data?.chart.bid} ask={data?.chart.ask} style={chartStyle} />
            <div className="mt5-chart-tabs">
              <button type="button" className="on">{symbol},{timeframe}</button>
            </div>
          </div>
          {showTester ? (
            <div className="mt5-tester">
              <div className="mt5-pane-h">
                <span>Strategy Tester</span>
                <button type="button" className="mt5-btn" onClick={() => setShowTester(false)}>Hide</button>
              </div>
              <div className="mt5-tree">
                <div className="mt5-form-row">
                  <label>Expert</label>
                  <select value={expertStrategy} onChange={(e) => setExpertStrategy(e.target.value)}>
                    {(data?.strategies ?? []).map((s) => (
                      <option key={s.strategyId} value={s.strategyId}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mt5-form-row">
                  <label>Model</label>
                  <select defaultValue="open"><option value="open">Open prices only</option></select>
                </div>
                <button type="button" className="mt5-btn" disabled={busy} onClick={() => void runTester()}>Start</button>
                {tester?.full?.metrics ? (
                  <p>
                    Trades {tester.full.metrics.trades ?? 0} · Win {tester.full.metrics.winRate ?? "—"} · PF {tester.full.metrics.profitFactor ?? "—"} · MaxDD {tester.full.metrics.maxDrawdown ?? "—"} · Return {tester.full.metrics.totalReturn ?? "—"}
                  </p>
                ) : <p>Historical simulation using cached/demo bars. Not a live result.</p>}
              </div>
            </div>
          ) : null}
          {showBox ? (
            <section className="mt5-toolbox">
              <div className="mt5-tabs">
                {(["trade", "exposure", "history", "news", "alerts", "experts", "journal"] as const).map((tab) => (
                  <button key={tab} type="button" className={boxTab === tab ? "on" : ""} onClick={() => setBoxTab(tab)}>
                    {tab === "trade" ? "Trade" : tab[0].toUpperCase() + tab.slice(1)}
                  </button>
                ))}
                <span style={{ marginLeft: "auto", padding: "4px 10px" }} className="mt5-quote">
                  Equity {data?.portfolio.equity ?? "—"} {data?.portfolio.currency} · uP/L {data?.portfolio.unrealizedPnl ?? "0"}
                </span>
              </div>
              <div className="mt5-scroll">
                {boxTab === "trade" ? (
                  <table className="mt5-table">
                    <thead><tr><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>S/L</th><th>T/P</th><th>Profit</th></tr></thead>
                    <tbody>
                      {(data?.portfolio.positions ?? []).map((p) => (
                        <tr key={p.instrument}>
                          <td>{p.instrument}</td>
                          <td>{Number(p.quantity) >= 0 ? "buy" : "sell"}</td>
                          <td className="mt5-quote">{p.quantity}</td>
                          <td className="mt5-quote">{p.averagePrice}</td>
                          <td>—</td>
                          <td>—</td>
                          <td className={Number(p.unrealizedPnl) < 0 ? "mt5-bid" : "mt5-ask"}>{p.unrealizedPnl}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {boxTab === "exposure" ? (
                  <p style={{ padding: 8 }}>Net exposure is paper-only. Open positions: {(data?.portfolio.positions ?? []).length}.</p>
                ) : null}
                {boxTab === "history" ? (
                  <table className="mt5-table">
                    <thead><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Status</th><th>Comment</th></tr></thead>
                    <tbody>
                      {(data?.orders ?? []).map((o) => (
                        <tr key={o.id}>
                          <td>{o.submitted_at}</td>
                          <td>{o.instrument}</td>
                          <td>{o.side}</td>
                          <td>{o.quantity}</td>
                          <td>{o.status}</td>
                          <td>{o.broker}/{o.environment}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {boxTab === "news" ? <p style={{ padding: 8 }}>News feed is not connected in this paper terminal.</p> : null}
                {boxTab === "alerts" ? (
                  <table className="mt5-table">
                    <thead><tr><th>Time</th><th>Alert</th></tr></thead>
                    <tbody>
                      {(data?.alerts ?? []).map((a, i) => (
                        <tr key={i}><td>{a.created_at}</td><td>{a.title} — {a.body}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {boxTab === "experts" ? (
                  <div className="mt5-tree">
                    <p>Attach a compiled strategy to this chart. Run produces candidates for human approval. Experts never place live orders.</p>
                    <div className="mt5-oct">
                      <select value={expertStrategy} onChange={(e) => setExpertStrategy(e.target.value)}>
                        {(data?.strategies ?? []).map((s) => (
                          <option key={s.strategyId} value={s.strategyId}>{s.name}</option>
                        ))}
                      </select>
                      <button type="button" className="mt5-btn" onClick={() => void attach()}>Attach to {symbol}</button>
                      <button type="button" className="mt5-btn" onClick={() => void runExperts()}>Run experts</button>
                      <button type="button" className="mt5-btn" onClick={() => setShowIngest(true)}>New from file/audio/video</button>
                    </div>
                    <table className="mt5-table">
                      <thead><tr><th>Strategy</th><th>Symbol</th><th>On</th></tr></thead>
                      <tbody>
                        {(data?.experts ?? []).map((e) => (
                          <tr key={String(e.id)}>
                            <td>{String(e.strategy_id)}</td>
                            <td>{String(e.symbol)}</td>
                            <td>{Number(e.enabled) ? "yes" : "no"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {boxTab === "journal" ? (
                  <table className="mt5-table">
                    <thead><tr><th>Time</th><th>Message</th></tr></thead>
                    <tbody>
                      {(data?.journal ?? []).map((j, i) => (
                        <tr key={i}><td>{j.created_at}</td><td>{j.action} {j.entity}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            </section>
          ) : null}
        </section>
      </div>

      <div className="mt5-status">
        <span>{data?.flags.display_mode ?? "demo"} · paper · LIVE off · {data?.chart.provider ?? "…"} · {msg ? msg : "Ready"}</span>
        <span className="mt5-quote">{clock} UTC · Autonomous off <button type="button" className="kill" onClick={() => void kill()}>Kill switch</button></span>
      </div>

      {msg ? <div className={`mt5-msg ${msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("reject") ? "bad" : "ok"}`} style={{ position: "absolute", left: 8, bottom: 24 }}>{msg}</div> : null}

      {showOrder ? (
        <div className="mt5-modal" role="dialog" aria-label="New Order">
          <div className="mt5-dialog narrow">
            <h2>New Order — {symbol}</h2>
            <div className="body">
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
              <input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
              <label>Take Profit</label>
              <input value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
              <p>Paper fills are labeled simulated. Live one-click is off.</p>
              <div className="mt5-actions">
                <button type="button" onClick={() => setShowOrder(false)}>Cancel</button>
                <button type="button" className="sell" onClick={() => void submit("sell")}>Sell by Market</button>
                <button type="button" className="primary" onClick={() => void submit("buy")}>Buy by Market</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showIngest ? (
        <div className="mt5-modal" role="dialog" aria-label="New Expert">
          <div className="mt5-dialog">
            <h2>New Expert — audio, video, or file</h2>
            <div className="body">
              <p>Upload a strategy recording, PDF, DOCX, Markdown, or JSON. The desk extracts SOURCE text, compiles INTERPRETATION into rules, and never lets an LLM place trades.</p>
              <label htmlFor="strategy-file">Strategy file</label>
              <input
                id="strategy-file"
                aria-label="Strategy file"
                type="file"
                accept=".md,.txt,.pdf,.docx,.json,.mp3,.wav,.m4a,.mp4,.webm,.mov"
                onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
              />
              <label>Or paste rules</label>
              <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Buy EURUSD on H1 when RSI 14 is below 30…" />
              <div className="mt5-actions">
                <button type="button" onClick={() => setShowIngest(false)}>Close</button>
                <button type="button" className="primary" disabled={busy || !paste} onClick={() => void onUpload(null)}>Compile pasted text</button>
              </div>
              {ingest ? (
                <div>
                  <h3 style={{ fontSize: 13, fontFamily: "inherit" }}>{ingest.compiled.definition.name}</h3>
                  <p>Used LLM: {ingest.usedLlm ? "yes" : "no"} · Kind: {ingest.kind}</p>
                  {ingest.warnings.map((w) => <p key={w} className="mt5-msg bad">{w}</p>)}
                  <p><strong>SOURCE</strong></p>
                  <pre style={{ whiteSpace: "pre-wrap", background: "#111", padding: 8, maxHeight: 120, overflow: "auto" }}>{ingest.extractedText || "(empty)"}</pre>
                  <p><strong>INTERPRETATION</strong></p>
                  <ul>
                    {ingest.compiled.evidence.map((ev, i) => (
                      <li key={i}>{ev.field}: {ev.quote}</li>
                    ))}
                  </ul>
                  {ingest.compiled.needsClarification.map((c) => <p key={c} className="mt5-msg bad">{c}</p>)}
                  <div className="mt5-actions">
                    <button type="button" onClick={() => void confirmDraft(false)}>Save draft only</button>
                    <button type="button" className="primary" onClick={() => void confirmDraft(true)}>Confirm and attach to {symbol}</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt5-menu-item">
      <button type="button">{label}</button>
      <div className="mt5-dropdown">{children}</div>
    </div>
  );
}
