import { useEffect, useState } from "react";
import { api } from "../api";

export function LicensesPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<{ licenses: any[] }>("/api/licenses").then((r) => setRows(r.licenses));
  }, []);
  return (
    <>
      <h1>Licenses</h1>
      <p className="lede">Every dependency and API is recorded. Flagged items need a human before commercial SaaS use.</p>
      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="row">
            <strong>{r.component}</strong>
            {r.flagged ? <span className="pill">needs review</span> : <span className="pill">ok</span>}
          </div>
          <p>{r.license}</p>
          <p>{r.commercial}</p>
          {r.notes && <p className="lede">{r.notes}</p>}
        </div>
      ))}
    </>
  );
}
