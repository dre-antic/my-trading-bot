"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function PositionsPage() {
  const [port, setPort] = useState<{ positions: Array<Record<string, string>> } | null>(null);
  useEffect(() => {
    api<{ portfolio: { positions: Array<Record<string, string>> } }>("/api/positions").then((d) => setPort(d.portfolio));
  }, []);
  async function close(instrument: string) {
    await api("/api/positions/close", { method: "POST", body: JSON.stringify({ instrument }) });
    const d = await api<{ portfolio: { positions: Array<Record<string, string>> } }>("/api/positions");
    setPort(d.portfolio);
  }
  return (
    <AppFrame>
      <h1>Positions</h1>
      <p className="muted">Paper/demo values only. Closing submits a reduce-only paper market order.</p>
      <table className="table">
        <thead><tr><th>Instrument</th><th>Qty</th><th>Avg</th><th>Mkt</th><th>uP/L</th><th></th></tr></thead>
        <tbody>
          {(port?.positions ?? []).map((p) => (
            <tr key={p.instrument}>
              <td>{p.instrument}</td>
              <td className="mono">{p.quantity}</td>
              <td className="mono">{p.averagePrice}</td>
              <td className="mono">{p.marketPrice}</td>
              <td className={Number(p.unrealizedPnl) < 0 ? "neg" : "pos"}>{p.unrealizedPnl}</td>
              <td><button className="btn danger" onClick={() => close(p.instrument)}>Close</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!port?.positions?.length ? <p className="muted">No open positions.</p> : null}
    </AppFrame>
  );
}
