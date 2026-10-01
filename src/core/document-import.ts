export type SourceKind = "pdf" | "docx" | "txt" | "md" | "image" | "note";

export interface ExtractedDocument {
  text: string;
  kind: SourceKind;
  warnings: string[];
}

export interface InterpretedRule {
  sourceText: string;
  interpretation: string;
  confidence: "stated" | "inferred" | "needs_clarification";
  field: "entry" | "exit" | "stop" | "target" | "filter" | "risk" | "example" | "other";
}

export interface StrategyImportDraft {
  concepts: string[];
  rules: InterpretedRule[];
  ambiguities: string[];
  disclaimer: string;
}

const HINTS: Array<{ re: RegExp; field: InterpretedRule["field"]; interpretation: string }> = [
  { re: /enter|buy|long|breakout/i, field: "entry", interpretation: "Possible entry language was found. Exact trigger is not assumed." },
  { re: /exit|sell|close the position/i, field: "exit", interpretation: "Possible exit language was found. Exact trigger is not assumed." },
  { re: /stop[-\s]?loss|invalidat/i, field: "stop", interpretation: "Possible stop/invalidation language was found." },
  { re: /target|take profit|reward/i, field: "target", interpretation: "Possible target language was found." },
  { re: /risk\s+\d+(\.\d+)?\s*%|position size/i, field: "risk", interpretation: "Possible risk or sizing language was found." },
];

export function interpretSourceText(text: string): StrategyImportDraft {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rules: InterpretedRule[] = [];
  const concepts = new Set<string>();
  for (const line of lines) {
    for (const hint of HINTS) {
      if (hint.re.test(line)) {
        concepts.add(hint.field);
        const precise = looksPrecise(line);
        rules.push({
          sourceText: line,
          interpretation: precise ? line : hint.interpretation,
          confidence: precise ? "stated" : "needs_clarification",
          field: hint.field,
        });
      }
    }
  }
  const ambiguities = rules.filter((r) => r.confidence !== "stated").map((r) => r.sourceText);
  if (/\bbreakout\b/i.test(text) && !/(percent|%|close|volume|timeframe)/i.test(text)) {
    ambiguities.push("The word breakout appears without percentage, candle-close, volume, or timeframe definitions.");
  }
  return {
    concepts: [...concepts],
    rules,
    ambiguities: [...new Set(ambiguities)],
    disclaimer:
      "SOURCE TEXT is shown separately from SYSTEM INTERPRETATION. Unclear rules are marked NEEDS CLARIFICATION. Nothing is activated until a human reviews a versioned strategy.",
  };
}

function looksPrecise(line: string): boolean {
  return /(\d+(\.\d+)?\s*%|rsi\s*\d+|sma\s*\d+|close above|close below|atr)/i.test(line);
}

export function extractPlainText(buffer: Buffer, filename: string): ExtractedDocument {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return { text: buffer.toString("utf8"), kind: lower.endsWith(".md") ? "md" : "txt", warnings: [] };
  }
  return {
    text: "",
    kind: lower.endsWith(".pdf") ? "pdf" : lower.endsWith(".docx") ? "docx" : "note",
    warnings: ["Use the server document parser for PDF/DOCX. This helper only reads plain text."],
  };
}
