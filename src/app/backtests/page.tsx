"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useState } from "react";

export default function BacktestsPage() {
  const [id, setId] = useState("edu_trend_following");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      setResult(await api(`/api/strategies/${id}/backtest`, { method: "POST" }));
    } finally {
      setBusy(false);
    }
  }
  const full = result?.full as { metrics?: Record<string, string>; warnings?: string[]; trades?: unknown[] };
  return (
    <AppFrame>
      <h1>Backtesting lab</h1>
      <p className="muted">Historical simulation only. Out-of-sample, walk-forward, and Monte Carlo are included. This is not a live result.</p>
      <label>Strategy id</label>
      <input value={id} onChange={(e) => setId(e.target.value)} />
      <button className="btn" onClick={run} disabled={busy}>{busy ? "Running…" : "Run validation suite"}</button>
      {full?.metrics ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Full-sample backtest</h3>
          <p>Return {full.metrics.totalReturn}% · Sharpe {full.metrics.sharpe} · Max DD {full.metrics.maxDrawdown}% · Trades {full.metrics.trades}</p>
          <p className="muted">{full.warnings?.join(" ")}</p>
          <details className="expand"><summary>Out-of-sample / walk-forward / Monte Carlo</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ oos: result?.oos, wf: result?.wf, mc: result?.mc }, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </AppFrame>
  );
}
