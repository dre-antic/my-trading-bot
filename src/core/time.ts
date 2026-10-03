export const UTC_TZ = "UTC";

export function nowUtc(): Date {
  return new Date();
}

export function toIsoUtc(date: Date = nowUtc()): string {
  return date.toISOString();
}

export function parseUtc(value: string | number | Date): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("invalid date");
    return value;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid timestamp: ${String(value)}`);
  return d;
}

export function formatInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function isStale(dataTimestamp: Date, now: Date, maxAgeMs: number): boolean {
  return now.getTime() - dataTimestamp.getTime() > maxAgeMs;
}

export function weekdayUtc(date: Date): number {
  return date.getUTCDay();
}
