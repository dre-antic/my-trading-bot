"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Array<Record<string, string>>>([]);
  useEffect(() => {
    api<{ alerts: Array<Record<string, string>> }>("/api/alerts").then((d) => setAlerts(d.alerts));
  }, []);
  return (
    <AppFrame>
      <h1>Alerts</h1>
      <p className="muted">In-app channel is implemented. Email/SMS/Telegram/Discord transports are architected, not connected.</p>
      {alerts.map((a) => (
        <div className="card" key={a.id}>
          <div className="stat">{a.kind} · {a.channel}</div>
          <strong>{a.title}</strong>
          <p>{a.body}</p>
          <p className="mono muted">{a.created_at}</p>
        </div>
      ))}
    </AppFrame>
  );
}
