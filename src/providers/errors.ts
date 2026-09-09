import type { ErrorClass } from "../types/index.js";

export class ProviderError extends Error {
  constructor(
    message: string,
    public providerId: string,
    public errorClass: ErrorClass,
    public retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function retryBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 400;
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = String(err instanceof Error ? err.message : err).toLowerCase();
      const retryable = msg.includes("timeout") || msg.includes("429") || msg.includes("503") || msg.includes("econn");
      if (!retryable || i === retries) throw err;
      await sleep(base * 2 ** i + Math.floor(Math.random() * 120));
    }
  }
  throw last;
}

export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<any> {
  const timeoutMs = init.timeoutMs ?? 20_000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new ProviderError(
        `HTTP ${res.status} ${url} ${body.slice(0, 200)}`,
        "http",
        res.status === 429 ? "QUOTA" : res.status === 401 || res.status === 403 ? "AUTHENTICATION" : "PROVIDER_FAILURE",
        res.status === 429 || res.status >= 500,
      );
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}
