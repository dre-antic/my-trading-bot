"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/opportunities", "Opportunities"],
  ["/positions", "Positions"],
  ["/orders", "Orders"],
  ["/strategies", "Strategies"],
  ["/backtests", "Backtests"],
  ["/research", "Research"],
  ["/ai", "AI Desk"],
  ["/journal", "Journal"],
  ["/brokers", "Brokers"],
  ["/alerts", "Alerts"],
  ["/status", "System"],
  ["/settings", "Settings"],
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ flags?: { display_mode: string; trading_mode: string }; portfolio?: { equity: string; currency: string } } | null>(null);

  useEffect(() => {
    api<{ flags: { display_mode: string; trading_mode: string }; portfolio: { equity: string; currency: string } }>("/api/auth/me")
      .then(setMe)
      .catch(() => router.push("/login"));
  }, [router]);

  const mode = me?.flags?.display_mode ?? "demo";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <small>Command Center</small>
          <strong>AI Trading Desk</strong>
        </div>
        <nav className="nav">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className={`mode-banner ${mode}`}>
          <div>
            <span className={`chip ${mode}`}>{mode}</span>
            <span className="chip">{me?.flags?.trading_mode ?? "assisted"}</span>
          </div>
          <div className="mono muted">
            Equity {me?.portfolio?.equity ?? "—"} {me?.portfolio?.currency ?? ""} · LIVE off · Autonomous off
          </div>
        </div>
        {children}
      </main>
      <nav className="bottom-nav">
        {LINKS.slice(0, 5).map(([href, label]) => (
          <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
