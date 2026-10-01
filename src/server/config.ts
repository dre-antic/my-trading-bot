export interface AppConfig {
  nodeEnv: string;
  appUrl: string;
  sessionSecret: string;
  displayModeDefault: "demo" | "paper" | "live";
  liveEnabled: boolean;
  autonomousEnabled: boolean;
  aiDailyLimitUsd: string;
  aiMonthlyLimitUsd: string;
  alpacaPaperKey?: string;
  alpacaPaperSecret?: string;
  alpacaPaperBaseUrl: string;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
}

export function loadConfig(): AppConfig {
  const liveEnabled = process.env.ATCC_LIVE_ENABLED === "true";
  const autonomousEnabled = process.env.ATCC_AUTONOMOUS_ENABLED === "true";
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    appUrl: process.env.APP_URL ?? "http://127.0.0.1:3000",
    sessionSecret: process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me-32ch",
    displayModeDefault: (process.env.ATCC_DISPLAY_MODE as AppConfig["displayModeDefault"]) ?? "demo",
    liveEnabled,
    autonomousEnabled,
    aiDailyLimitUsd: process.env.AI_DAILY_LIMIT_USD ?? "0",
    aiMonthlyLimitUsd: process.env.AI_MONTHLY_LIMIT_USD ?? "0",
    alpacaPaperKey: process.env.ALPACA_PAPER_KEY,
    alpacaPaperSecret: process.env.ALPACA_PAPER_SECRET,
    alpacaPaperBaseUrl: process.env.ALPACA_PAPER_BASE_URL ?? "https://paper-api.alpaca.markets",
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
  };
}
