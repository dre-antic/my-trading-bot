import { ids } from "@/core/ids";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { loadConfig } from "./config";

export type NotifyChannel = "in_app" | "email" | "telegram" | "discord" | "web_push";

export interface NotifyEvent {
  userId: string;
  kind: string;
  title: string;
  body: string;
}

export interface TransportResult {
  channel: NotifyChannel;
  sent: boolean;
  reason?: string;
}

let fetchImpl: typeof fetch = fetch;

export function setNotificationFetch(fn: typeof fetch): void {
  fetchImpl = fn;
}

export async function fanoutExternal(event: NotifyEvent): Promise<TransportResult[]> {
  const results = await deliverExternal(event);
  for (const result of results) persistDelivery(event.userId, result);
  return results;
}

export async function deliverExternal(event: NotifyEvent, fetchFn: typeof fetch = fetchImpl): Promise<TransportResult[]> {
  return [await telegram(event, fetchFn), await discord(event, fetchFn), await email(event, fetchFn), webPush()];
}

export async function dispatchNotification(event: NotifyEvent): Promise<TransportResult[]> {
  return [inApp(event), ...(await fanoutExternal(event))];
}

function inApp(event: NotifyEvent): TransportResult {
  getDb()
    .prepare("INSERT INTO alerts (id, user_id, kind, title, body, channel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(ids.alert(), event.userId, event.kind, event.title, event.body, "in_app", toIsoUtc());
  getDb()
    .prepare("INSERT INTO notifications (id, user_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(ids.notice(), event.userId, event.title, event.body, toIsoUtc());
  const result: TransportResult = { channel: "in_app", sent: true };
  persistDelivery(event.userId, result);
  return result;
}

async function telegram(event: NotifyEvent, fetchFn: typeof fetch): Promise<TransportResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { channel: "telegram", sent: false, reason: "Telegram is not configured" };
  const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: `${event.title}\n${event.body}` }),
  });
  return { channel: "telegram", sent: res.ok, reason: res.ok ? undefined : `telegram HTTP ${res.status}` };
}

async function discord(event: NotifyEvent, fetchFn: typeof fetch): Promise<TransportResult> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { channel: "discord", sent: false, reason: "Discord webhook is not configured" };
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `**${event.title}**\n${event.body}` }),
  });
  return { channel: "discord", sent: res.ok, reason: res.ok ? undefined : `discord HTTP ${res.status}` };
}

async function email(event: NotifyEvent, fetchFn: typeof fetch): Promise<TransportResult> {
  const hook = process.env.EMAIL_WEBHOOK_URL;
  const to = process.env.ALERT_EMAIL_TO;
  if (!hook || !to) return { channel: "email", sent: false, reason: "Email webhook is not configured" };
  const res = await fetchFn(hook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject: `[ATCC] ${event.title}`, text: event.body, app: loadConfig().appUrl }),
  });
  return { channel: "email", sent: res.ok, reason: res.ok ? undefined : `email HTTP ${res.status}` };
}

function webPush(): TransportResult {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return { channel: "web_push", sent: false, reason: "Web push is not configured" };
  }
  return {
    channel: "web_push",
    sent: false,
    reason: "VAPID is present but no push subscription store is implemented. Refusing to claim a send.",
  };
}

function persistDelivery(userId: string, result: TransportResult): void {
  try {
    getDb()
      .prepare(
        "INSERT INTO notification_deliveries (id, user_id, channel, sent, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(ids.delivery(), userId, result.channel, result.sent ? 1 : 0, result.reason ?? null, toIsoUtc());
  } catch {
    // Delivery history is best-effort; the transport result is still returned.
  }
}

export function notificationStatus(): Record<NotifyChannel, string> {
  return {
    in_app: "ready",
    telegram: process.env.TELEGRAM_BOT_TOKEN ? "configured" : "not-configured",
    discord: process.env.DISCORD_WEBHOOK_URL ? "configured" : "not-configured",
    email: process.env.EMAIL_WEBHOOK_URL ? "configured" : "not-configured",
    web_push: process.env.VAPID_PUBLIC_KEY ? "keys-present-store-missing" : "not-configured",
  };
}
