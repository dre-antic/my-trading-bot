"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [qty, setQty] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<Record<string, unknown>>(`/api/candidates/${id}`).then((d) => {
      setData(d);
      const c = d.candidate as { positionSize: string };
      setQty(c.positionSize);
    });
  }, [id]);

  async function decide(decision: "APPROVE" | "REJECT" | "WATCH") {
    setMsg("");
    try {
      const res = await api<{ candidate: { status: string }; orderId?: string }>(`/api/candidates/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, quantity: qty }),
      });
      setMsg(`${decision} → ${res.candidate.status}${res.orderId ? ` · order ${res.orderId}` : ""}`);
      setData(await api(`/api/candidates/${id}`));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    }
  }

  const c = (data?.candidate ?? {}) as Record<string, unknown>;
  const risk = data?.risk as { decision?: string; violations?: Array<{ code: string; message: string }> };
  const sizing = data?.sizing as Record<string, string>;
  const match = c.strategyMatch as { matched?: boolean; satisfied?: Array<{ rule: string }>; failed?: Array<{ rule: string }>; clarifications?: string[] };

  return (
    <AppFrame>
      <h1>{String(c.instrument ?? "Candidate")}</h1>
      <p className="muted">Strategy {String(c.strategyId)} v{String(c.strategyVersion)} · {String(c.status)}</p>
      <div className="grid stats">
        <div className="card"><div className="stat">Entry</div><div className="value mono">{String(c.entry ?? "")}</div></div>
        <div className="card"><div className="stat">Stop</div><div className="value mono">{String(c.stop ?? "")}</div></div>
        <div className="card"><div className="stat">Target</div><div className="value mono">{String(c.target ?? "")}</div></div>
        <div className="card"><div className="stat">Risk</div><div className="value mono">{String(c.riskAmount ?? "")}</div></div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Position size (server-calculated)</h3>
        <p className="muted">Editing quantity re-runs the Risk Firewall. Frontend math is never final.</p>
        <label>Quantity</label>
        <input value={qty} onChange={(e) => setQty(e.target.value)} className="mono" />
        {sizing ? <p className="mono muted">Risk {sizing.totalRisk} · notional {sizing.notional} · fees {sizing.estimatedFees} · slip {sizing.estimatedSlippage}</p> : null}
        <p>Firewall: {risk?.decision ?? "—"}</p>
        {risk?.violations?.map((v) => <p key={v.code} className="neg">{v.code}: {v.message}</p>)}
        <div className="row">
          <button className="btn" onClick={() => decide("APPROVE")}>Approve paper trade</button>
          <button className="btn secondary" onClick={() => decide("WATCH")}>Watch</button>
          <button className="btn danger" onClick={() => decide("REJECT")}>Reject</button>
        </div>
        {msg ? <p>{msg}</p> : null}
      </div>
      <details className="expand" open>
        <summary>Strategy match and evidence</summary>
        <p>Match: {match?.matched ? "yes" : "no"}</p>
        <p>Satisfied: {match?.satisfied?.map((s) => s.rule).join(" · ") || "none"}</p>
        <p>Failed: {match?.failed?.map((s) => s.rule).join(" · ") || "none"}</p>
        <p>Bull: {String(c.bullCase ?? "")}</p>
        <p>Bear: {String(c.bearCase ?? "")}</p>
        <p>Regime: {JSON.stringify(c.marketRegime)}</p>
      </details>
    </AppFrame>
  );
}
