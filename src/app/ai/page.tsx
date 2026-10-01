"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useState } from "react";

const PROMPTS = [
  "What is the market doing?",
  "Find setups matching my strategy.",
  "Why did you reject this?",
  "Show me today’s candidates.",
  "What mistakes have I been making?",
];

export default function AiPage() {
  const [q, setQ] = useState(PROMPTS[0]);
  const [a, setA] = useState("");
  async function ask() {
    const res = await api<{ answer: string; disclaimer: string }>("/api/ai/ask", { method: "POST", body: JSON.stringify({ question: q }) });
    setA(`${res.answer}\n\n${res.disclaimer}`);
  }
  return (
    <AppFrame>
      <h1>AI Desk</h1>
      <p className="muted">Answers reference system data. The desk has no broker execution tools.</p>
      <div className="row">
        {PROMPTS.map((p) => <button key={p} className="btn secondary" onClick={() => setQ(p)}>{p}</button>)}
      </div>
      <textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn" onClick={ask}>Ask</button>
      {a ? <pre className="card" style={{ whiteSpace: "pre-wrap" }}>{a}</pre> : null}
    </AppFrame>
  );
}
