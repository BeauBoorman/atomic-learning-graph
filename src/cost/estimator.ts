/**
 * Offline atomization cost estimates.
 *
 * These constants intentionally approximate a complete multi-call course build rather than one
 * prompt. The Mill calibration run used about 41,000 source characters, 18,700 billed input
 * tokens, 11,600 billed output tokens, and produced 10 concepts. No tokenizer or model is called.
 */

/** Deterministic source-token heuristic: JavaScript UTF-16 code units divided by four. */
export const CHARS_PER_SOURCE_TOKEN = 4;

/**
 * A full run repeats source-derived material across inventory, relationship, translation, and
 * enrichment calls. This calibration maps the Mill run's 41k characters to its 18.7k total billed
 * input tokens after first applying the four-characters-per-source-token heuristic.
 */
export const ATOMIZATION_INPUT_MULTIPLIER = 18_700 / (41_000 / CHARS_PER_SOURCE_TOKEN);

/** Mill run calibration: about 11.6k output tokens / 18.7k input tokens. */
export const OUTPUT_INPUT_TOKEN_RATIO = 0.62;

/** Mill run calibration: about 10 concepts / 41k source characters. */
export const CONCEPTS_PER_1K_CHARS = 10 / 41;

export interface ModelPricing {
  model: string;
  inputUsdPer1MTokens: number;
  outputUsdPer1MTokens: number;
}

// Source: OpenAI API pricing, verified 2026-07-18: https://openai.com/api/pricing/
// Add a model by appending one row; the estimator and CLI enumerate this table directly.
export const PRICING_TABLE: readonly ModelPricing[] = [
  { model: "gpt-5.6-sol", inputUsdPer1MTokens: 5, outputUsdPer1MTokens: 30 },
  { model: "gpt-5.6-terra", inputUsdPer1MTokens: 2.5, outputUsdPer1MTokens: 15 },
  { model: "gpt-5.6-luna", inputUsdPer1MTokens: 1, outputUsdPer1MTokens: 6 },
];

export interface AtomizationCostEstimate {
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedConcepts: number;
  estimatedUsdTotal: number;
  estimatedUsdPerConcept: number;
}

/** Estimate a complete atomization run using only deterministic arithmetic over the input text. */
export function estimateAtomizationCosts(text: string): AtomizationCostEstimate[] {
  const estimatedInputTokens = Math.ceil(
    (text.length / CHARS_PER_SOURCE_TOKEN) * ATOMIZATION_INPUT_MULTIPLIER,
  );
  const estimatedOutputTokens = Math.ceil(
    estimatedInputTokens * OUTPUT_INPUT_TOKEN_RATIO,
  );
  const estimatedConcepts = (text.length / 1_000) * CONCEPTS_PER_1K_CHARS;

  return PRICING_TABLE.map((pricing) => {
    const estimatedUsdTotal =
      (estimatedInputTokens * pricing.inputUsdPer1MTokens +
        estimatedOutputTokens * pricing.outputUsdPer1MTokens) /
      1_000_000;
    return {
      model: pricing.model,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedConcepts,
      estimatedUsdTotal,
      estimatedUsdPerConcept:
        estimatedConcepts === 0 ? 0 : estimatedUsdTotal / estimatedConcepts,
    };
  });
}
