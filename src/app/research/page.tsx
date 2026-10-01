"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function ResearchPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api<Record<string, unknown>>("/api/research").then(setData);
  }, []);
  const report = data?.report as Record<string, string> | undefined;
  return (
    <AppFrame>
      <h1>Research report</h1>
      <p className="muted">Deterministic desk output. Not LLM market prediction.</p>
      {report ? (
        <div className="list">
          {Object.entries(report).filter(([k]) => k !== "agents").map(([k, v]) => (
            <div className="card" key={k}>
              <div className="stat">{k}</div>
              <p>{typeof v === "string" ? v : JSON.stringify(v)}</p>
            </div>
          ))}
        </div>
      ) : <p>No report yet.</p>}
    </AppFrame>
  );
}
