"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Record<string, unknown>>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);
  const port = (data?.portfolio ?? {}) as Record<string, string>;
  const health = (data?.health ?? {}) as Record<string, unknown>;
  return (
    <AppFrame>
      <h1>Desk overview</h1>
      <p className="muted">What is happening, why it matters, and what you can do. Advanced numbers stay expandable.</p>
      {error ? <p className="neg">{error}</p> : null}
      <div className="grid stats">
        <Stat label="Portfolio value" value={port.equity} />
        <Stat label="Cash" value={port.cash} />
        <Stat label="Buying power" value={port.buyingPower} />
        <Stat label="Daily P/L" value={port.dailyPnl} signed />
        <Stat label="Unrealized" value={port.unrealizedPnl} signed />
        <Stat label="Realized" value={port.realizedPnl} signed />
        <Stat label="Drawdown" value={`${port.drawdown ?? "0"}%`} />
        <Stat label="Open orders" value={String(data?.openOrders ?? 0)} />
      </div>
      <div className="grid split" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Risk and bot status</h3>
          <p>Constitution is active. Risk Firewall is deterministic software. AI cannot disable it.</p>
          <p className="muted">Broker: paper · Market data: demo provider · AI paid services: {(health.ai as { paidServices?: boolean })?.paidServices ? "configured" : "off"}</p>
          <Link className="btn secondary" href="/opportunities">Review opportunities</Link>
        </div>
        <div className="card">
          <h3>Positions</h3>
          <p className="muted">{Array.isArray((data?.portfolio as { positions?: unknown[] })?.positions) ? (data?.portfolio as { positions: unknown[] }).positions.length : 0} open</p>
          <Link href="/positions">Manage positions</Link>
        </div>
      </div>
    </AppFrame>
  );
}

function Stat({ label, value, signed }: { label: string; value?: string; signed?: boolean }) {
  const n = Number(value ?? 0);
  const cls = signed ? (n < 0 ? "neg" : n > 0 ? "pos" : "") : "";
  const shown = value == null || value === "" || Number.isNaN(n) ? "—" : n.toFixed(2);
  return (
    <div className="card">
      <div className="stat">{label}</div>
      <div className={`value mono ${cls}`}>{shown}</div>
    </div>
  );
}
