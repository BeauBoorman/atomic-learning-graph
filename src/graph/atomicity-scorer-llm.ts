// Opt-in, build-time semantic atomicity judge. This module has no UI import path and receives its
// ResponsesClient-shaped dependency from the atomizer, keeping tests offline and request-time code
// model-free. Every failure returns the fail-open advisory result; this scorer is never a gate.

import type { JsonObject, TranslationRequestOptions } from "../atomization/translate";
import type { Concept } from "../types";
import type { AtomicityScorer, AtomicitySignal } from "./atomicity-report";

const JUDGE_SIGNALS = [
  "single-idea",
  "bundled-operations",
  "multiple-defined-terms",
  "multiple-outcomes",
  "unclear-scope",
] as const satisfies readonly AtomicitySignal[];

const judgeSignalSet = new Set<AtomicitySignal>(JUDGE_SIGNALS);

export const ATOMICITY_JUDGE_INSTRUCTIONS = `Judge whether the supplied concept summary expresses exactly ONE atomic idea that should fit on one learning-graph node, or bundles several independently teachable ideas. Judge semantics, not punctuation. A process is non-atomic when understanding the summary requires teaching multiple distinct operations, definitions, or outcomes. Return only the strict JSON object. If atomic is false, include the strongest applicable non-single-idea signal.`;

export const atomicityJudgeSchema: JsonObject = {
  type: "object",
  properties: {
    atomic: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    signals: {
      type: "array",
      minItems: 1,
      maxItems: JUDGE_SIGNALS.length,
      uniqueItems: true,
      items: { type: "string", enum: [...JUDGE_SIGNALS] },
    },
  },
  required: ["atomic", "confidence", "signals"],
  additionalProperties: false,
};

export interface AtomicityJudgeClient {
  request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options?: Partial<TranslationRequestOptions>,
  ): Promise<JsonObject>;
}

export interface AsyncAtomicityScorer extends AtomicityScorer {
  score(concept: Concept): Promise<{
    atomic: boolean;
    confidence: number;
    signals: AtomicitySignal[];
  }>;
}

export interface LlmJudgeAtomicityOptions {
  timeoutMs?: number;
}

const FAIL_OPEN_RESULT = { atomic: true, confidence: 0, signals: [] } as const;

function parseJudgeResult(raw: JsonObject): {
  atomic: boolean;
  confidence: number;
  signals: AtomicitySignal[];
} {
  if (typeof raw.atomic !== "boolean") throw new Error("atomic must be boolean");
  if (
    typeof raw.confidence !== "number" ||
    !Number.isFinite(raw.confidence) ||
    raw.confidence < 0 ||
    raw.confidence > 1
  ) {
    throw new Error("confidence must be a finite number from 0 to 1");
  }
  if (
    !Array.isArray(raw.signals) ||
    raw.signals.length === 0 ||
    raw.signals.some(
      (signal) => typeof signal !== "string" || !judgeSignalSet.has(signal as AtomicitySignal),
    )
  ) {
    throw new Error("signals must contain only known atomicity judge signals");
  }
  return {
    atomic: raw.atomic,
    confidence: raw.confidence,
    signals: raw.signals as AtomicitySignal[],
  };
}

async function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("atomicity judge request timed out")), timeoutMs);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Creates an opt-in GPT-5.6 atomicity scorer over the existing ResponsesClient request contract.
 * It is build-time only, uses strict Structured Outputs, and resolves fail-open on every error.
 */
export function llmJudgeAtomicityScorer(
  client: AtomicityJudgeClient,
  options: LlmJudgeAtomicityOptions = {},
): AsyncAtomicityScorer {
  const requestedTimeout = options.timeoutMs ?? 30_000;
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? requestedTimeout
    : 30_000;

  return {
    async score(concept) {
      try {
        const raw = await withTimeout(
          client.request(
            ATOMICITY_JUDGE_INSTRUCTIONS,
            `CONCEPT_TITLE=${concept.title}\nCONCEPT_SUMMARY=${concept.summary}`,
            atomicityJudgeSchema,
            "atomicity_judge",
            { forceStrict: true, maxOutputTokens: 3000 },
          ),
          timeoutMs,
        );
        return parseJudgeResult(raw);
      } catch {
        return { ...FAIL_OPEN_RESULT, signals: [...FAIL_OPEN_RESULT.signals] };
      }
    },
  };
}
