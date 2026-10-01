"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function JournalPage() {
  const [data, setData] = useState<{ entries: Array<Record<string, string>>; patterns: string[] }>({ entries: [], patterns: [] });
  useEffect(() => {
    api<typeof data>("/api/journal").then(setData);
  }, []);
  return (
    <AppFrame>
      <h1>Trading journal</h1>
      <div className="card">
        <h3>Learning lab observations</h3>
        {data.patterns.map((p) => <p key={p}>{p}</p>)}
      </div>
      {data.entries.map((e) => (
        <div className="card" key={e.id}>
          <p><strong>{e.strategy_id}</strong> · {e.user_decision} · {e.result_kind}{e.simulated === "1" || Number(e.simulated) === 1 ? " · simulated" : ""}</p>
          <p className="muted">{e.thesis}</p>
          <p className="mono">in {e.entry_price} stop {e.stop_price} tgt {e.target_price} fill {e.actual_entry ?? "—"}</p>
          <p>{e.execution_quality}</p>
        </div>
      ))}
    </AppFrame>
  );
}
