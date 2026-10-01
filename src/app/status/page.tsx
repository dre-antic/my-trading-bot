"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function StatusPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api<Record<string, unknown>>("/api/status").then(setData);
  }, []);
  return (
    <AppFrame>
      <h1>System status</h1>
      <pre className="card" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
    </AppFrame>
  );
}
