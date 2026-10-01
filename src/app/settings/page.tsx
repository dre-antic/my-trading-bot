"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [constitution, setConstitution] = useState<Record<string, unknown> | null>(null);
  const [phrase, setPhrase] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api<{ constitution: Record<string, unknown> }>("/api/constitution").then((d) => setConstitution(d.constitution));
  }, []);
  async function emergency(action: string, confirm: string) {
    try {
      await api("/api/emergency", { method: "POST", body: JSON.stringify({ action, confirmPhrase: confirm }) });
      setMsg(`${action} executed`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    }
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <AppFrame>
      <h1>Settings</h1>
      <div className="card">
        <h3>Trading Constitution v{String(constitution?.version ?? "")}</h3>
        <p className="muted">AI agents cannot change this document. A new version requires your authorization.</p>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(constitution, null, 2)}</pre>
      </div>
      <div className="card">
        <h3>Emergency controls</h3>
        <p className="muted">High-risk actions require the exact confirmation phrase.</p>
        <div className="row">
          <button className="btn secondary" onClick={() => emergency("STOP_NEW_TRADES", "STOP NEW TRADES")}>Stop new trades</button>
          <button className="btn secondary" onClick={() => emergency("STOP_AUTOMATION", "STOP AUTOMATION")}>Stop automation</button>
          <button className="btn secondary" onClick={() => emergency("CANCEL_OPEN_ORDERS", "CANCEL OPEN ORDERS")}>Cancel open orders</button>
        </div>
        <label>Type CLOSE ALL POSITIONS to flatten paper book</label>
        <input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
        <button className="btn danger" onClick={() => emergency("CLOSE_ALL_POSITIONS", phrase)}>Close all positions</button>
        {msg ? <p>{msg}</p> : null}
      </div>
      <button className="btn secondary" onClick={logout}>Sign out</button>
    </AppFrame>
  );
}
