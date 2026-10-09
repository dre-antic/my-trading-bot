import { compileStrategyFromText, tryParseStrategyJson, type CompiledStrategyDraft } from "@/core/strategy-compiler";
import { interpretSourceText } from "@/core/document-import";
import { MAX_UPLOAD_BYTES } from "@/core/media";
import { ids } from "@/core/ids";
import { toIsoUtc } from "@/core/time";
import { getDb } from "@/db/client";
import { extractMedia } from "./extract-media";
import { createStrategyVersion, getStrategy } from "./trading-service";
import { attachExpert } from "./ticket";
import { audit } from "./audit";
import { loadConfig } from "./config";
import { selectLlmProvider } from "./providers/llm";
import { canSpend } from "@/core/cost";
import { sanitizeForLlm } from "@/core/security";

export interface IngestResult {
  documentId: string;
  strategyId: string;
  filename: string;
  kind: string;
  extractedText: string;
  source: string;
  interpretation: ReturnType<typeof interpretSourceText>;
  compiled: CompiledStrategyDraft;
  usedLlm: boolean;
  warnings: string[];
}

export async function ingestStrategyUpload(
  userId: string,
  filename: string,
  buffer: Buffer,
  pastedText?: string,
): Promise<IngestResult> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("File is larger than 40MB.");
  }
  const extracted = pastedText
    ? { text: pastedText, kind: "txt" as const, warnings: [] as string[], transcriptionModel: undefined }
    : await extractMedia(buffer, filename);

  const text = extracted.text.trim();
  const warnings = [...extracted.warnings];
  if (!text) {
    warnings.push("No source text was extracted. Clarify the strategy in text or configure transcription keys.");
  }

  let compiled = tryParseStrategyJson(text) ?? compileStrategyFromText(text || filename, { sourceKind: extracted.kind, filename });
  let usedLlm = false;
  const llmText = await maybeLlmRewrite(userId, text);
  if (llmText) {
    usedLlm = true;
    compiled = compileStrategyFromText(llmText, { usedLlm: true, sourceKind: extracted.kind, filename });
    warnings.push("LLM rewrote the source into a spec; quotes below still come from extract + compiler.");
  }

  compiled.usedLlm = usedLlm;
  const interpretation = interpretSourceText(text || compiled.definition.description);
  const created = createStrategyVersion(userId, {
    ...compiled.definition,
    sourceDocumentIds: [],
    lifecycle: "DRAFT",
  });
  compiled.definition.sourceDocumentIds = [created.strategyId];

  const documentId = ids.document();
  getDb()
    .prepare(
      "INSERT INTO strategy_documents (id, user_id, strategy_id, filename, kind, extracted_text, interpretation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      documentId,
      userId,
      created.strategyId,
      filename,
      extracted.kind,
      text,
      JSON.stringify({
        interpretation,
        compiled,
        warnings,
        usedLlm,
        transcriptionModel: extracted.transcriptionModel ?? null,
      }),
      toIsoUtc(),
    );
  getDb()
    .prepare("UPDATE strategies SET description = ? WHERE id = ?")
    .run(created.description, created.strategyId);
  audit({
    userId,
    action: "strategy.ingested",
    entity: "document",
    entityId: documentId,
    payload: { filename, strategyId: created.strategyId, usedLlm, kind: extracted.kind },
  });
  return {
    documentId,
    strategyId: created.strategyId,
    filename,
    kind: extracted.kind,
    extractedText: text,
    source: text,
    interpretation,
    compiled,
    usedLlm,
    warnings,
  };
}

export function confirmIngest(
  userId: string,
  documentId: string,
  opts: { attach?: boolean; symbol?: string },
): { strategyId: string; attached?: { id: string }; symbol?: string } {
  const row = getDb()
    .prepare("SELECT id, strategy_id, filename FROM strategy_documents WHERE id = ? AND user_id = ?")
    .get(documentId, userId) as { id: string; strategy_id: string | null; filename: string } | undefined;
  if (!row?.strategy_id) throw new Error("ingest document not found");
  const strategy = getStrategy(userId, row.strategy_id);
  let attached: { id: string } | undefined;
  const symbol = opts.symbol ?? strategy.instruments[0];
  if (opts.attach) {
    attached = attachExpert(userId, strategy.strategyId, symbol);
  }
  audit({
    userId,
    action: "strategy.ingest_confirmed",
    entity: "strategy",
    entityId: strategy.strategyId,
    payload: { documentId, attached: Boolean(attached), symbol },
  });
  return { strategyId: strategy.strategyId, attached, symbol };
}

async function maybeLlmRewrite(userId: string, text: string): Promise<string | null> {
  if (!text.trim()) return null;
  const cfg = loadConfig();
  const llm = selectLlmProvider();
  const paid = Boolean(llm) && (Number(cfg.aiDailyLimitUsd) > 0 || Number(cfg.aiMonthlyLimitUsd) > 0);
  if (!paid || !llm) return null;
  const spend = canSpend(
    [],
    { dailyUsd: cfg.aiDailyLimitUsd, monthlyUsd: cfg.aiMonthlyLimitUsd, perAgentUsd: "1", paidServicesEnabled: true },
    "strategy_interpreter",
    "0.05",
    new Date(),
  );
  if (!spend.allowed) return null;
  const model = llm.id === "anthropic" ? "claude-3-5-haiku-latest" : llm.id === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini";
  const completion = await llm.complete({
    model,
    maxTokens: 800,
    messages: [
      {
        role: "system",
        content:
          "Extract mechanical trading rules. Preserve numbers. Quote evidence. Do not invent missing stops, RSI levels, or symbols. Output plain English sections: Symbols, Timeframe, Entry, Exit, Stop, Target, Unclear.",
      },
      { role: "user", content: sanitizeForLlm(text).slice(0, 12_000) },
    ],
  });
  audit({ userId, action: "strategy.llm_spec", entity: "user", entityId: userId, payload: { model } });
  return completion.text || null;
}
