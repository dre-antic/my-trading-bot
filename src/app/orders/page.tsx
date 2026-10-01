"use client";

import { AppFrame } from "@/ui/AppFrame";
import { api } from "@/ui/api";
import { useEffect, useState } from "react";

export default function OrdersPage() {
  const [data, setData] = useState<{ orders: Array<Record<string, string>>; fills: Array<Record<string, string>> }>({ orders: [], fills: [] });
  useEffect(() => {
    api<typeof data>("/api/orders").then(setData);
  }, []);
  return (
    <AppFrame>
      <h1>Orders</h1>
      <table className="table">
        <thead><tr><th>When</th><th>Instrument</th><th>Side</th><th>Qty</th><th>Status</th><th>Broker</th></tr></thead>
        <tbody>
          {data.orders.map((o) => (
            <tr key={o.id}>
              <td className="mono">{o.submitted_at}</td>
              <td>{o.instrument}</td>
              <td>{o.side}</td>
              <td className="mono">{o.quantity}</td>
              <td>{o.status}</td>
              <td>{o.broker} / {o.environment}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Fills</h2>
      <table className="table">
        <thead><tr><th>When</th><th>Instrument</th><th>Price</th><th>Qty</th><th>Simulated</th></tr></thead>
        <tbody>
          {data.fills.map((f) => (
            <tr key={f.id}>
              <td className="mono">{f.filled_at}</td>
              <td>{f.instrument}</td>
              <td className="mono">{f.price}</td>
              <td className="mono">{f.quantity}</td>
              <td>{String(f.simulated) === "1" ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppFrame>
  );
}
