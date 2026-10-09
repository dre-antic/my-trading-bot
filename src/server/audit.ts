import { ids } from "@/core/ids";
import { redactSecrets } from "@/core/security";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";

export function audit(input: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: unknown;
}): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO audit_events (id, user_id, action, entity, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    ids.audit(),
    input.userId ?? null,
    input.action,
    input.entity,
    input.entityId ?? null,
    redactSecrets(JSON.stringify(input.payload ?? {})),
    toIsoUtc(),
  );
}

export function addAlert(userId: string, kind: string, title: string, body: string, channel = "in_app"): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO alerts (id, user_id, kind, title, body, channel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(ids.alert(), userId, kind, title, body, channel, toIsoUtc());
  void import("./notifications").then((n) => n.fanoutExternal({ userId, kind, title, body }));
}
