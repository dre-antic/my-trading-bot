export type AiProviderId = "openai" | "anthropic" | "gemini" | "openai_compatible" | "local" | "none";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiCompletion {
  provider: AiProviderId;
  model: string;
  text: string;
  toolCalls: AiToolCall[];
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: string;
  usedLlm: boolean;
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly displayName: string;
  complete(req: {
    model: string;
    messages: AiMessage[];
    tools?: Array<{ name: string; description: string }>;
    maxTokens?: number;
    timeoutMs?: number;
  }): Promise<AiCompletion>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  tools: string[];
  permissions: Array<"read" | "propose" | "never_execute">;
  structuredOutput: string;
  evidenceRequired: boolean;
  defaultProvider: AiProviderId;
  defaultModel: string;
  tokenLimit: number;
  costLimitUsd: string;
  timeoutMs: number;
  retry: { attempts: number; backoffMs: number };
}

export const AGENT_CATALOG: AgentDefinition[] = [
  {
    id: "market_scout",
    name: "Market Scout",
    role: "Continuously identify candidates from scanners and strategy conditions.",
    tools: ["list_instruments", "get_bars", "evaluate_strategy"],
    permissions: ["read"],
    structuredOutput: "candidate_list",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-scout",
    tokenLimit: 2000,
    costLimitUsd: "0.05",
    timeoutMs: 20_000,
    retry: { attempts: 1, backoffMs: 500 },
  },
  {
    id: "strategy_interpreter",
    name: "Strategy Interpreter",
    role: "Convert source text into structured rules without inventing missing conditions.",
    tools: ["read_document", "draft_dsl"],
    permissions: ["read", "propose"],
    structuredOutput: "strategy_draft",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-interpreter",
    tokenLimit: 4000,
    costLimitUsd: "0.10",
    timeoutMs: 30_000,
    retry: { attempts: 1, backoffMs: 500 },
  },
  {
    id: "technical_analyst",
    name: "Technical Analyst",
    role: "Compute and explain indicators as evidence, not as automatic trades.",
    tools: ["get_bars", "indicators"],
    permissions: ["read"],
    structuredOutput: "technical_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-ta",
    tokenLimit: 2000,
    costLimitUsd: "0.05",
    timeoutMs: 15_000,
    retry: { attempts: 1, backoffMs: 400 },
  },
  {
    id: "fundamental_analyst",
    name: "Fundamental Analyst",
    role: "Attach dated fundamental evidence for supported assets.",
    tools: ["fundamentals"],
    permissions: ["read"],
    structuredOutput: "fundamental_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-fa",
    tokenLimit: 2000,
    costLimitUsd: "0.05",
    timeoutMs: 15_000,
    retry: { attempts: 1, backoffMs: 400 },
  },
  {
    id: "news_macro_analyst",
    name: "News/Macro Analyst",
    role: "Assess relevance of news and macro events. Sentiment alone cannot trigger trades.",
    tools: ["news"],
    permissions: ["read"],
    structuredOutput: "news_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-news",
    tokenLimit: 2000,
    costLimitUsd: "0.05",
    timeoutMs: 15_000,
    retry: { attempts: 1, backoffMs: 400 },
  },
  {
    id: "market_regime_analyst",
    name: "Market Regime Analyst",
    role: "Classify regime with confidence and evidence. Never treat as absolute truth.",
    tools: ["get_bars", "classify_regime"],
    permissions: ["read"],
    structuredOutput: "regime_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-regime",
    tokenLimit: 1200,
    costLimitUsd: "0.02",
    timeoutMs: 10_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "bull_analyst",
    name: "Bull Analyst",
    role: "Construct the strongest evidence supporting a setup without fabricating facts.",
    tools: ["read_candidate"],
    permissions: ["read"],
    structuredOutput: "bull_case",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-debate",
    tokenLimit: 1500,
    costLimitUsd: "0.04",
    timeoutMs: 12_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "bear_analyst",
    name: "Bear Analyst",
    role: "Construct the strongest evidence against a setup without fabricating facts.",
    tools: ["read_candidate"],
    permissions: ["read"],
    structuredOutput: "bear_case",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-debate",
    tokenLimit: 1500,
    costLimitUsd: "0.04",
    timeoutMs: 12_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "strategy_compliance_agent",
    name: "Strategy Compliance Agent",
    role: "State which rules a candidate satisfies or fails, including ambiguity.",
    tools: ["evaluate_strategy"],
    permissions: ["read"],
    structuredOutput: "compliance_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-compliance",
    tokenLimit: 1200,
    costLimitUsd: "0.02",
    timeoutMs: 10_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "portfolio_analyst",
    name: "Portfolio Analyst",
    role: "Measure concentration, correlation, and whether a trade is acceptable in context.",
    tools: ["portfolio"],
    permissions: ["read"],
    structuredOutput: "portfolio_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-portfolio",
    tokenLimit: 1500,
    costLimitUsd: "0.03",
    timeoutMs: 10_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "risk_analyst",
    name: "Risk Analyst",
    role: "Explain Risk Firewall output. Cannot override, modify, or disable the firewall.",
    tools: ["risk_firewall"],
    permissions: ["read"],
    structuredOutput: "risk_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-risk",
    tokenLimit: 1200,
    costLimitUsd: "0.02",
    timeoutMs: 10_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "execution_analyst",
    name: "Execution Analyst",
    role: "Comment on spread, hours, and expected slippage. Cannot submit orders.",
    tools: ["quotes", "orders"],
    permissions: ["read"],
    structuredOutput: "execution_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-exec",
    tokenLimit: 1200,
    costLimitUsd: "0.02",
    timeoutMs: 10_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "trade_committee",
    name: "Trade Committee",
    role: "Weigh bull and bear evidence and produce a proposal, never an execution.",
    tools: ["read_candidate"],
    permissions: ["read", "propose"],
    structuredOutput: "committee_decision",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-committee",
    tokenLimit: 2000,
    costLimitUsd: "0.05",
    timeoutMs: 15_000,
    retry: { attempts: 1, backoffMs: 400 },
  },
  {
    id: "post_trade_analyst",
    name: "Post-Trade Analyst",
    role: "Separate process failure from normal variance after a completed trade.",
    tools: ["journal", "execution_quality"],
    permissions: ["read"],
    structuredOutput: "post_trade_report",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-post",
    tokenLimit: 1500,
    costLimitUsd: "0.03",
    timeoutMs: 12_000,
    retry: { attempts: 1, backoffMs: 300 },
  },
  {
    id: "learning_lab_agent",
    name: "Learning Lab Agent",
    role: "Propose testable hypotheses. Cannot modify live strategies.",
    tools: ["journal", "backtests"],
    permissions: ["read", "propose"],
    structuredOutput: "hypothesis",
    evidenceRequired: true,
    defaultProvider: "none",
    defaultModel: "deterministic-learn",
    tokenLimit: 2000,
    costLimitUsd: "0.05",
    timeoutMs: 15_000,
    retry: { attempts: 1, backoffMs: 400 },
  },
];

export function agentById(id: string): AgentDefinition {
  const found = AGENT_CATALOG.find((a) => a.id === id);
  if (!found) throw new Error(`unknown agent: ${id}`);
  return found;
}

export function sanitizeForLlm(text: string): string {
  return text
    .replace(/(api[_-]?key|secret|password|token)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/sk-[A-Za-z0-9]{10,}/g, "[REDACTED]")
    .slice(0, 20_000);
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): string {
  const table: Record<string, { in: number; out: number }> = {
    "gpt-4o-mini": { in: 0.15 / 1_000_000, out: 0.6 / 1_000_000 },
    "claude-3-5-haiku": { in: 0.8 / 1_000_000, out: 4 / 1_000_000 },
    deterministic: { in: 0, out: 0 },
  };
  const rates = table[model] ?? { in: 0, out: 0 };
  return (inputTokens * rates.in + outputTokens * rates.out).toFixed(6);
}
