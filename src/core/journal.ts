export interface JournalEntryDraft {
  userId: string;
  accountId: string;
  candidateId?: string;
  orderId?: string;
  strategyId?: string;
  strategyVersion?: number;
  thesis: string;
  entry: string;
  stop: string;
  target: string;
  actualEntry?: string;
  actualExit?: string;
  result?: string;
  regime?: string;
  aiReasoning: string;
  userDecision?: string;
  executionQuality?: string;
  userNotes?: string;
  resultKind: "historical" | "backtest" | "paper" | "live";
  simulated: boolean;
}

export function draftJournalFromTrade(input: JournalEntryDraft): JournalEntryDraft {
  return {
    ...input,
    aiReasoning: input.aiReasoning || "No LLM reasoning was used. Deterministic engine output only.",
  };
}

export function classifyMistakePatterns(
  entries: Array<{ result?: string; regime?: string; executionQuality?: string; thesis: string }>,
): string[] {
  const notes: string[] = [];
  const losses = entries.filter((e) => Number(e.result ?? "0") < 0);
  const highVolLosses = losses.filter((e) => e.regime?.includes("high_volatility"));
  if (highVolLosses.length >= 3) {
    notes.push("Observation: several losses occurred in high-volatility regimes. Hypothesis: test a volatility filter. This is not a live strategy change.");
  }
  const slip = entries.filter((e) => (e.executionQuality ?? "").includes("slippage") && Number(e.result ?? "0") < 0);
  if (slip.length >= 2) {
    notes.push("Observation: losses coincided with noted slippage. Hypothesis: review liquidity and session filters.");
  }
  if (!notes.length) {
    notes.push("No statistically meaningful mistake pattern yet. The learning lab will not invent one.");
  }
  return notes;
}
