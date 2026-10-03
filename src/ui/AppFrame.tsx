"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";

const LINKS = [
  ["/terminal", "Terminal"],
  ["/dashboard", "Dashboard"],
  ["/opportunities", "Opportunities"],
  ["/positions", "Positions"],
  ["/orders", "Orders"],
  ["/strategies", "Strategies"],
  ["/backtests", "Backtests"],
  ["/laboratory", "Laboratory"],
  ["/research", "Research"],
  ["/ai", "AI Desk"],
  ["/journal", "Journal"],
  ["/brokers", "Brokers"],
  ["/alerts", "Alerts"],
  ["/status", "System"],
  ["/settings", "Settings"],
];

export function AppFrame({ children, dense }: { children: React.ReactNode; dense?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{
    flags?: { display_mode: string; trading_mode: string };
    portfolio?: { equity: string; currency: string };
    live?: { envLiveEnabled: boolean; control: { liveEnabled: boolean; armedUntil: string | null; halted: boolean } };
  } | null>(null);

  const [healNote, setHealNote] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ flags: { display_mode: string; trading_mode: string }; portfolio: { equity: string; currency: string } }>("/api/auth/me"),
      api<{ envLiveEnabled: boolean; control: { liveEnabled: boolean; armedUntil: string | null; halted: boolean } }>("/api/live").catch(() => null),
      api<{ actions: Array<{ applied: boolean; detail: string }> }>("/api/heal", { method: "POST", body: JSON.stringify({}) }).catch(() => null),
    ])
      .then(([auth, live, heal]) => {
        setMe({ ...auth, live: live ?? undefined });
        const fixed = heal?.actions.filter((a) => a.applied) ?? [];
        if (fixed.length) setHealNote(`Self-heal repaired ${fixed.length} item(s). LIVE was not touched.`);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const mode = me?.flags?.display_mode ?? "demo";
  const liveOn = Boolean(me?.live?.control.liveEnabled);
  const armed = Boolean(me?.live?.control.armedUntil && new Date(me.live.control.armedUntil).getTime() > Date.now());

  async function kill() {
    await api("/api/emergency", { method: "POST", body: JSON.stringify({ action: "DISARM_LIVE", confirmPhrase: "DISARM LIVE" }) });
    await api("/api/emergency", { method: "POST", body: JSON.stringify({ action: "STOP_NEW_TRADES", confirmPhrase: "STOP NEW TRADES" }) });
    window.location.reload();
  }

  return (
    <div className={`app-shell ${dense ? "dense" : ""}`}>
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
      <main className={`main ${dense ? "terminal-main" : ""}`}>
        <div className={`mode-banner ${mode}`}>
          <div>
            <span className={`chip ${mode}`}>{mode}</span>
            <span className="chip">{me?.flags?.trading_mode ?? "assisted"}</span>
            <span className={`chip ${liveOn ? "live" : "paper"}`}>LIVE {liveOn ? (armed ? "armed" : "on") : "off"}</span>
            {healNote ? <span className="chip paper">{healNote}</span> : null}
          </div>
          <div className="row">
            <div className="mono muted">
              Equity {me?.portfolio?.equity ?? "—"} {me?.portfolio?.currency ?? ""} · Autonomous off
            </div>
            <button className="btn danger" onClick={kill}>Kill switch</button>
          </div>
        </div>
        {children}
      </main>
      <nav className="bottom-nav">
        {[["/terminal", "Terminal"], ...LINKS.slice(1, 5)].map(([href, label]) => (
          <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
