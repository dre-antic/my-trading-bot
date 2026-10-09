"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/ui/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@local");
  const [password, setPassword] = useState("CommandCenter!demo");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then(() => router.replace("/terminal"))
      .catch(() => undefined);
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push("/terminal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <p className="muted" style={{ letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 11 }}>
          Personal trading desk
        </p>
        <h1>AI Trading Command Center</h1>
        <p className="muted">
          Research, strategy compliance, deterministic risk, and a Market Watch / chart / ticket desk. Paper by default. Not a chatbot with a buy button.
        </p>
        <form onSubmit={onSubmit} className="grid">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error ? <p className="neg">{error}</p> : null}
          <button className="btn" type="submit">
            Enter desk
          </button>
        </form>
        <p className="muted">Demo operator is pre-seeded. LIVE trading is disabled.</p>
      </div>
    </div>
  );
}
