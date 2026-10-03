"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useCallback, useEffect, useState } from "react";

type HealReport = {
  checkedAt: string;
  healthy: boolean;
  findings: Array<{ code: string; severity: string; message: string; auto: boolean }>;
  actions: Array<{ code: string; applied: boolean; detail: string }>;
  refused: string[];
};

export default function StatusPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [heal, setHeal] = useState<HealReport | null>(null);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    const [status, report] = await Promise.all([
      api<Record<string, unknown>>("/api/status"),
      api<HealReport>("/api/heal", { method: "POST", body: JSON.stringify({}) }),
    ]);
    setData(status);
    setHeal(report);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setMsg(e instanceof Error ? e.message : "status failed"));
  }, [refresh]);

  return (
    <AppFrame>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>System status</h1>
        <button className="btn" onClick={() => refresh().catch((e) => setMsg(e instanceof Error ? e.message : "heal failed"))}>
          Repair now
        </button>
      </div>
      <p className="muted">
        The desk watches for broken schema, corrupt paper books, stuck jobs, orphan experts, and LIVE drift.
        It repairs those automatically. It will never enable live, arm a session, reset the circuit breaker, or place an order.
      </p>
      {heal ? (
        <div className="card">
          <h3>Self-heal {heal.healthy ? "ok" : "needs attention"}</h3>
          <p className="muted">Checked {heal.checkedAt}</p>
          {heal.actions.length ? (
            <ul>
              {heal.actions.map((a, i) => (
                <li key={i}>{a.applied ? "Fixed" : "Skipped"}: {a.detail}</li>
              ))}
            </ul>
          ) : (
            <p className="pos">No automatic repairs were required.</p>
          )}
          {heal.findings.length ? (
            <ul>
              {heal.findings.map((f, i) => (
                <li key={i} className={f.severity === "needs_human" ? "neg" : ""}>
                  {f.code}: {f.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {msg ? <p className="neg">{msg}</p> : null}
      <pre className="card" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
    </AppFrame>
  );
}
