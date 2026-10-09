"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useState } from "react";

export default function ImportPage() {
  const [text, setText] = useState("Enter after breakout. Use a stop. Risk 1%.");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  return (
    <AppFrame>
      <h1>Import source material</h1>
      <p className="muted">Paste notes from a book or PDF extract. SOURCE TEXT stays separate from SYSTEM INTERPRETATION.</p>
      <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn" onClick={async () => setResult(await api("/api/documents", { method: "POST", body: JSON.stringify({ filename: "notes.txt", text }) }))}>
        Extract rules
      </button>
      {result ? (
        <pre className="card" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>
      ) : null}
    </AppFrame>
  );
}
