"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewStrategyPage() {
  const router = useRouter();
  const [name, setName] = useState("My breakout");
  const [description, setDescription] = useState("User-authored draft. Rules must be explicit.");
  const [msg, setMsg] = useState("");

  async function save() {
    await api("/api/strategies", {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        assetClass: "etf",
        instruments: ["SPY"],
        timeframe: "1d",
        direction: "long",
        entry: { op: "cmp", left: { kind: "indicator", name: "close" }, cmp: ">", right: { kind: "indicator", name: "resistance" } },
        exit: { op: "cmp", left: { kind: "indicator", name: "close" }, cmp: "<", right: { kind: "indicator", name: "sma", period: 20 } },
        stop: { kind: "percent", value: "2" },
        target: { kind: "rr", value: "2" },
        positionSizing: { method: "percent_account_risk", riskPct: "0.5" },
        compatibleRegimes: ["any"],
        lifecycle: "DRAFT",
        sourceDocumentIds: [],
        educational: false,
      }),
    });
    setMsg("Version stored as DRAFT. It is not live.");
    router.push("/strategies");
  }

  return (
    <AppFrame>
      <h1>New strategy version</h1>
      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <label>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      <p className="muted">This form writes an explicit DSL version. AI-generated rules are never silently activated.</p>
      <button className="btn" onClick={save}>Save draft version</button>
      {msg ? <p>{msg}</p> : null}
    </AppFrame>
  );
}
