import { ids } from "@/core/ids";
import { hashPassword, verifyPassword } from "@/core/security";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { seed } from "@/db/seed";
import { audit } from "./audit";

export async function ensureSeeded(): Promise<void> {
  await seed();
}

export async function login(email: string, password: string): Promise<{ userId: string; email: string; displayName: string }> {
  await ensureSeeded();
  const db = getDb();
  const user = db.prepare("SELECT id, email, password_hash, display_name FROM users WHERE email = ?").get(email) as
    | { id: string; email: string; password_hash: string; display_name: string }
    | undefined;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    audit({ action: "auth.failed", entity: "user", payload: { email } });
    throw new Error("invalid credentials");
  }
  audit({ userId: user.id, action: "auth.login", entity: "user", entityId: user.id });
  return { userId: user.id, email: user.email, displayName: user.display_name };
}

export async function register(email: string, password: string, displayName: string): Promise<{ userId: string; email: string }> {
  await ensureSeeded();
  const db = getDb();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) throw new Error("email already registered");
  const userId = ids.user();
  db.prepare("INSERT INTO users (id, email, password_hash, display_name, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    userId,
    email,
    await hashPassword(password),
    displayName,
    "UTC",
    toIsoUtc(),
  );
  db.prepare(
    "INSERT INTO runtime_flags (user_id, display_mode, trading_mode, live_enabled, autonomous_enabled, stop_new_trades, stop_automation) VALUES (?, 'demo', 'assisted', 0, 0, 0, 0)",
  ).run(userId);
  audit({ userId, action: "auth.register", entity: "user", entityId: userId });
  return { userId, email };
}
