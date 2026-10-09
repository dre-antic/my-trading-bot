import { afterEach, describe, expect, it } from "vitest";
import { deliverExternal, notificationStatus, setNotificationFetch } from "@/server/notifications";

const event = { userId: "usr_test", kind: "risk_limit", title: "Rejected", body: "TRADE_RISK_LIMIT" };

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.DISCORD_WEBHOOK_URL;
  delete process.env.EMAIL_WEBHOOK_URL;
  delete process.env.ALERT_EMAIL_TO;
  delete process.env.VAPID_PUBLIC_KEY;
  setNotificationFetch(fetch);
});

describe("notification transports", () => {
  it("returns sent=false when channels are not configured", async () => {
    const results = await deliverExternal(event);
    expect(results.every((r) => r.sent === false)).toBe(true);
    expect(results.map((r) => r.channel).sort()).toEqual(["discord", "email", "telegram", "web_push"]);
    expect(notificationStatus().telegram).toBe("not-configured");
  });

  it("posts to configured webhook transports via injectable fetch", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "tok";
    process.env.TELEGRAM_CHAT_ID = "1";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.example/hook";
    process.env.EMAIL_WEBHOOK_URL = "https://mail.example/hook";
    process.env.ALERT_EMAIL_TO = "ops@example.com";
    const calls: string[] = [];
    setNotificationFetch(async (url) => {
      calls.push(String(url));
      return new Response("ok", { status: 200 });
    });
    const results = await deliverExternal(event);
    expect(results.filter((r) => r.channel !== "web_push").every((r) => r.sent)).toBe(true);
    expect(calls.some((u) => u.includes("api.telegram.org"))).toBe(true);
    expect(calls).toContain("https://discord.example/hook");
  });

  it("does not claim web-push success when only VAPID is present", async () => {
    process.env.VAPID_PUBLIC_KEY = "pk";
    const results = await deliverExternal(event);
    const push = results.find((r) => r.channel === "web_push");
    expect(push?.sent).toBe(false);
    expect(push?.reason).toMatch(/subscription store/);
  });
});
