"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function BrokersPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api<Record<string, unknown>>("/api/brokers").then(setData);
  }, []);
  const accounts = (data?.accounts ?? []) as Array<Record<string, string>>;
  const registry = (data?.registry ?? []) as Array<Record<string, string>>;
  return (
    <AppFrame>
      <h1>Brokers</h1>
      <p className="muted">Secrets are never shown. Live credentials are refused unless LIVE is explicitly enabled.</p>
      {accounts.map((a) => (
        <div className="card" key={a.id}>
          <strong>{a.displayName}</strong>
          <p>{a.broker} · {a.environment} · last sync {a.lastSync ?? "n/a"}</p>
        </div>
      ))}
      <h2>Adapter registry</h2>
      <table className="table">
        <thead><tr><th>Broker</th><th>Readiness</th><th>Notes</th></tr></thead>
        <tbody>
          {registry.map((r) => (
            <tr key={r.id}><td>{r.displayName}</td><td>{r.readiness}</td><td>{r.notes}</td></tr>
          ))}
        </tbody>
      </table>
    </AppFrame>
  );
}
