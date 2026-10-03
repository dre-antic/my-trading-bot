"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

type Experiment = {
  id: string;
  champion_strategy_id: string;
  challenger_strategy_id: string;
  status: string;
  notes?: string;
};

export default function LaboratoryPage() {
  const [data, setData] = useState<{ strategies: Array<{ strategyId: string; name: string; lifecycle: string }>; experiments: Experiment[] }>({
    strategies: [],
    experiments: [],
  });
  const [champion, setChampion] = useState("");
  const [challenger, setChallenger] = useState("");
  const [msg, setMsg] = useState("");

  async function reload() {
    const d = await api<typeof data>("/api/laboratory");
    setData(d);
    setChampion((current) => current || d.strategies[0]?.strategyId || "");
    setChallenger((current) => current || d.strategies[1]?.strategyId || "");
  }

  useEffect(() => {
    void api<typeof data>("/api/laboratory").then((d) => {
      setData(d);
      setChampion((current) => current || d.strategies[0]?.strategyId || "");
      setChallenger((current) => current || d.strategies[1]?.strategyId || "");
    });
  }, []);

  return (
    <AppFrame>
      <h1>Strategy laboratory</h1>
      <p className="muted">
        Champion vs challenger. A challenger never becomes LIVE. Promotion requires robustness gates plus the exact phrase PROMOTE CHALLENGER, and the winner is marked APPROVED only.
      </p>
      <div className="card">
        <label>Champion</label>
        <select value={champion} onChange={(e) => setChampion(e.target.value)}>
          {data.strategies.map((s) => (
            <option key={s.strategyId} value={s.strategyId}>{s.name} ({s.lifecycle})</option>
          ))}
        </select>
        <label>Challenger</label>
        <select value={challenger} onChange={(e) => setChallenger(e.target.value)}>
          {data.strategies.map((s) => (
            <option key={s.strategyId} value={s.strategyId}>{s.name} ({s.lifecycle})</option>
          ))}
        </select>
        <button className="btn" onClick={async () => { await api("/api/laboratory", { method: "POST", body: JSON.stringify({ championStrategyId: champion, challengerStrategyId: challenger }) }); await reload(); }}>
          Create experiment
        </button>
      </div>
      {data.experiments.map((e) => {
        const parsed = parseNotes(e.notes);
        return (
          <div className="card" key={e.id}>
            <p><strong>{e.champion_strategy_id}</strong> vs <strong>{e.challenger_strategy_id}</strong> · {e.status}</p>
            {parsed ? (
              <div>
                <p className="muted">Robustness: {parsed.robustness?.passed ? "passed" : "failed"} · Promotion gate: {parsed.gate?.passed ? "passed" : "blocked"}</p>
                {(parsed.robustness?.failures ?? parsed.gate?.failures ?? []).map((f) => <p key={f} className="muted">{f}</p>)}
              </div>
            ) : (
              <p className="muted">{e.notes}</p>
            )}
            <div className="row">
              <button className="btn secondary" onClick={async () => {
                const res = await api(`/api/laboratory/${e.id}/evaluate`, { method: "POST", body: JSON.stringify({ userApproved: false }) });
                setMsg(JSON.stringify(res, null, 2));
                await reload();
              }}>Evaluate gates</button>
              <button className="btn" onClick={async () => {
                try {
                  setMsg(JSON.stringify(await api(`/api/laboratory/${e.id}/promote`, { method: "POST", body: JSON.stringify({ confirmPhrase: "PROMOTE CHALLENGER" }) }), null, 2));
                  await reload();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "blocked");
                }
              }}>Promote (human gated)</button>
            </div>
          </div>
        );
      })}
      {msg ? <pre className="card" style={{ whiteSpace: "pre-wrap" }}>{msg}</pre> : null}
    </AppFrame>
  );
}

function parseNotes(notes?: string): { gate?: { passed: boolean; failures: string[] }; robustness?: { passed: boolean; failures: string[] } } | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { gate?: { passed: boolean; failures: string[] }; robustness?: { passed: boolean; failures: string[] } };
    if (parsed.gate || parsed.robustness) return parsed;
    return null;
  } catch {
    return null;
  }
}
