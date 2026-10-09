import { weekdayUtc } from "./time";
import type { AssetClass } from "./types";

const US_EQUITY_HOLIDAYS = new Set([
  "2024-01-01",
  "2024-01-15",
  "2024-02-19",
  "2024-03-29",
  "2024-05-27",
  "2024-06-19",
  "2024-07-04",
  "2024-09-02",
  "2024-11-28",
  "2024-12-25",
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
]);

export function isWeekendUtc(date: Date): boolean {
  const d = weekdayUtc(date);
  return d === 0 || d === 6;
}

export function ymdUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isMarketOpen(assetClass: AssetClass, date: Date): boolean {
  if (assetClass === "crypto") return true;
  if (isWeekendUtc(date)) return false;
  if (assetClass === "equity" || assetClass === "etf") {
    return !US_EQUITY_HOLIDAYS.has(ymdUtc(date));
  }
  if (assetClass === "forex") return !isWeekendUtc(date);
  return !isWeekendUtc(date);
}

export function sessionLabel(date: Date, assetClass: AssetClass): string {
  if (assetClass === "crypto") return "crypto-24x7";
  const hour = date.getUTCHours();
  if (assetClass === "forex") {
    if (hour < 7) return "asia";
    if (hour < 13) return "london";
    return "new-york";
  }
  if (hour >= 13 && hour < 20) return "us-rth";
  return "us-closed";
}
