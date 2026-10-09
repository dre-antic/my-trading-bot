"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Array<Record<string, string>>>([]);
  useEffect(() => {
    api<{ strategies: Array<Record<string, string>> }>("/api/strategies").then((d) => setStrategies(d.strategies));
  }, []);
  return (
    <AppFrame>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Strategies</h1>
        <div className="row">
          <Link className="btn secondary" href="/strategies/import">Import notes</Link>
          <Link className="btn" href="/strategies/new">New version</Link>
        </div>
      </div>
      <p className="muted">Educational examples are infrastructure tests. They are not claimed profitable. Changes create a new version.</p>
      <div className="list">
        {strategies.map((s) => (
          <div key={s.strategyId} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{s.name}</strong>
              <span className="chip">{s.lifecycle}</span>
            </div>
            <p className="muted">{s.description}</p>
            <p className="mono">{s.assetClass} · {s.timeframe} · v{s.version}</p>
            <div className="row">
              <button className="btn secondary" onClick={() => api(`/api/strategies/${s.strategyId}/scan`, { method: "POST" })}>Scan</button>
              <button className="btn secondary" onClick={() => api(`/api/strategies/${s.strategyId}/backtest`, { method: "POST" })}>Backtest</button>
            </div>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}
