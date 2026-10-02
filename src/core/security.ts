const INJECTION_PATTERNS = [
  /ignore (all|any|previous) instructions/i,
  /you are now/i,
  /reveal (the )?(system|hidden) prompt/i,
  /exfiltrat/i,
  /send (me )?(the )?(api|broker) (key|secret)/i,
];

export function detectPromptInjection(text: string): { flagged: boolean; reasons: string[] } {
  const reasons = INJECTION_PATTERNS.filter((re) => re.test(text)).map((re) => `matched ${re.source}`);
  return { flagged: reasons.length > 0, reasons };
}

export function allowlistedTool(agentTools: string[], requested: string): boolean {
  return agentTools.includes(requested);
}

export function redactSecrets(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, "[REDACTED]")
    .replace(/(api[_-]?key|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=[REDACTED]");
}

export function sanitizeForLlm(text: string): string {
  return redactSecrets(text).slice(0, 12_000);
}

export function assertNoSecretInPrompt(prompt: string): void {
  if (/sk-[A-Za-z0-9-_]{8,}/.test(prompt) || /APCA-API-SECRET/i.test(prompt)) {
    throw new Error("Refusing to send secrets to an LLM.");
  }
}

export function hashLooksLikePassword(value: string): boolean {
  return value.startsWith("sha256:") || value.startsWith("$argon2") || value.startsWith("$2");
}

export async function sha256Hex(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const { randomBytes, scrypt } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const scryptAsync = promisify(scrypt);
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { scrypt, timingSafeEqual } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const scryptAsync = promisify(scrypt);
  const [scheme, salt, hex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  const a = Buffer.from(hex, "hex");
  if (a.length !== derived.length) return false;
  return timingSafeEqual(a, derived);
}
