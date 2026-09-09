import { useEffect, useState } from "react";
import { api } from "../api";

export function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<any>("/api/settings").then((r) => {
      setData(r);
      const v: Record<string, string> = {};
      for (const [k, meta] of Object.entries(r.keys) as any) v[k] = meta.masked;
      setVals(v);
    });
  }, []);

  async function save() {
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(vals)) {
      if (v && !v.includes("•")) body[k] = v;
    }
    await api("/api/settings", { method: "POST", body: JSON.stringify(body) });
    setMsg("Saved. Full secrets are never shown again.");
    const r = await api<any>("/api/settings");
    setData(r);
  }

  if (!data) return <p>Loading…</p>;
  return (
    <>
      <h1>Settings</h1>
      <p className="lede">Keys stay on this machine in data/secrets.json. The browser never receives a full secret after save. Paid providers stay off unless you enable them in .env.</p>
      <div className="card">
        <p>Demo mode: {String(data.demoMode)}</p>
        <p>Paid providers allowed: {String(data.allowPaidProviders)}</p>
        <p>
          Spend today ${data.spentToday} / ${data.maxDailySpend} · month ${data.spentMonth} / ${data.maxMonthlySpend}
        </p>
      </div>
      {Object.entries(data.keys).map(([k, meta]: any) => (
        <label key={k} style={{ marginBottom: 12, display: "block" }}>
          {k} — {meta.configured ? "Configured" : "Not configured"} {meta.freeTier ? "· free tier" : "· paid"}
          <input
            type="password"
            autoComplete="off"
            placeholder={meta.configured ? "•••• saved" : "paste key"}
            value={vals[k] ?? ""}
            onChange={(e) => setVals((s) => ({ ...s, [k]: e.target.value }))}
            onFocus={() => {
              if ((vals[k] || "").includes("•")) setVals((s) => ({ ...s, [k]: "" }));
            }}
          />
        </label>
      ))}
      <div className="actions">
        <button className="primary" onClick={save}>
          Save keys
        </button>
      </div>
      {msg && <p className="ok">{msg}</p>}
      <div className="card">
        <h3>LLM providers</h3>
        {data.llm?.map((p: any) => (
          <p key={p.id}>
            {p.id} — {p.configured ? "ready" : "not configured"} — {p.free ? "free" : "paid"} — score{" "}
            {Math.round(
              (p.stats?.qualityScore ?? 0) +
                (p.stats?.availabilityScore ?? 0) +
                (p.stats?.freeQuotaScore ?? 0) +
                (p.stats?.speedScore ?? 0) -
                (p.stats?.costScore ?? 0),
            )}
          </p>
        ))}
      </div>
    </>
  );
}
