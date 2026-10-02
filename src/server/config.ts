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
  alpacaLiveKey?: string;
  alpacaLiveSecret?: string;
  alpacaLiveBaseUrl: string;
  oandaToken?: string;
  oandaAccountId?: string;
  oandaEnv: "practice" | "live";
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
    alpacaLiveKey: process.env.ALPACA_LIVE_KEY,
    alpacaLiveSecret: process.env.ALPACA_LIVE_SECRET,
    alpacaLiveBaseUrl: process.env.ALPACA_LIVE_BASE_URL ?? "https://api.alpaca.markets",
    oandaToken: process.env.OANDA_API_TOKEN,
    oandaAccountId: process.env.OANDA_ACCOUNT_ID,
    oandaEnv: process.env.OANDA_ENV === "live" ? "live" : "practice",
    openaiKey: process.env.OPENAI_API_KEY,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
  };
}
