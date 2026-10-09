"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function OpportunitiesPage() {
  const [candidates, setCandidates] = useState<Array<Record<string, string>>>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ candidates: Array<Record<string, string>> }>("/api/candidates").then((d) => setCandidates(d.candidates));
  }, []);

  async function scan() {
    setBusy(true);
    try {
      const d = await api<{ candidates: Array<Record<string, string>> }>("/api/candidates", { method: "POST", body: JSON.stringify({}) });
      setCandidates(d.candidates.concat(candidates));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Opportunities</h1>
        <button className="btn" onClick={scan} disabled={busy}>{busy ? "Scanning…" : "Scan educational strategies"}</button>
      </div>
      <p className="muted">Candidates are proposals. They are not orders. Approval still goes through the Risk Firewall.</p>
      <div className="list">
        {candidates.map((c) => (
          <Link key={c.candidateId} href={`/opportunities/${c.candidateId}`} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{c.instrument}</strong>
              <span className="chip">{c.status}</span>
            </div>
            <p className="muted">{c.strategyId} · {c.direction} · entry {c.entry} / stop {c.stop} / target {c.target}</p>
            <p>Risk {c.riskAmount} · R:R {c.riskReward}</p>
          </Link>
        ))}
        {!candidates.length ? <p className="muted">No candidates yet. Run a scan.</p> : null}
      </div>
    </AppFrame>
  );
}
