import fs from "node:fs";
import path from "node:path";
import { pino } from "pino";
import { config, ensureDirs } from "../config/index.js";
import type { ErrorClass, JobEvent, Stage } from "../types/index.js";

ensureDirs();

const pretty = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      "req.headers.authorization",
      "apiKey",
      "api_key",
      "secret",
      "token",
      "password",
      "*.apiKey",
      "*.token",
    ],
    censor: "[redacted]",
  },
  transport: pretty
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
    : undefined,
});

const SECRET_RE =
  /(api[_-]?key|authorization|bearer\s+[a-z0-9._-]+|sk-[a-z0-9]+|token=)[^\s"]*/gi;

export function redact(text: string): string {
  return text.replace(SECRET_RE, "[redacted]");
}

export function logJob(event: JobEvent): void {
  const row = { ...event, message: redact(event.message) };
  logger.info(row, row.message);
  appendAudit(row);
}

export function appendAudit(event: JobEvent): void {
  const file = path.join(config.dataDir, "audit.jsonl");
  fs.appendFileSync(file, JSON.stringify(event) + "\n");
}

export function makeEvent(
  jobId: string,
  stage: Stage,
  message: string,
  extra: Partial<JobEvent> = {},
): JobEvent {
  return {
    ts: new Date().toISOString(),
    jobId,
    stage,
    message: redact(message),
    ...extra,
  };
}

export function classifyError(err: unknown): ErrorClass {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  if (msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) return "QUOTA";
  if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("api key"))
    return "AUTHENTICATION";
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("503") || msg.includes("502"))
    return "TEMPORARY";
  if (msg.includes("license")) return "LICENSE_FAILURE";
  if (msg.includes("quality")) return "QUALITY_FAILURE";
  if (msg.includes("invalid")) return "INVALID_REQUEST";
  return "UNKNOWN";
}
