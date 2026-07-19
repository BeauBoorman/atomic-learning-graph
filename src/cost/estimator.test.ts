import { describe, expect, it } from "vitest";
import {
  ATOMIZATION_INPUT_MULTIPLIER,
  CHARS_PER_SOURCE_TOKEN,
  CONCEPTS_PER_1K_CHARS,
  OUTPUT_INPUT_TOKEN_RATIO,
  PRICING_TABLE,
  estimateAtomizationCosts,
} from "./estimator";

describe("atomization cost estimator", () => {
  it("pins the documented heuristic and verified pricing inputs", () => {
    expect(CHARS_PER_SOURCE_TOKEN).toBe(4);
    expect(ATOMIZATION_INPUT_MULTIPLIER).toBe(18_700 / (41_000 / 4));
    expect(OUTPUT_INPUT_TOKEN_RATIO).toBe(0.62);
    expect(CONCEPTS_PER_1K_CHARS).toBe(10 / 41);
    expect(PRICING_TABLE).toEqual([
      { model: "gpt-5.6-sol", inputUsdPer1MTokens: 5, outputUsdPer1MTokens: 30 },
      { model: "gpt-5.6-terra", inputUsdPer1MTokens: 2.5, outputUsdPer1MTokens: 15 },
      { model: "gpt-5.6-luna", inputUsdPer1MTokens: 1, outputUsdPer1MTokens: 6 },
    ]);
  });

  it("reproduces the calibration scale from 41k source characters", () => {
    const estimates = estimateAtomizationCosts("x".repeat(41_000));

    expect(estimates.map(({ model }) => model)).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
    ]);
    for (const estimate of estimates) {
      expect(estimate.estimatedInputTokens).toBe(18_700);
      expect(estimate.estimatedOutputTokens).toBe(11_594);
      expect(estimate.estimatedConcepts).toBe(10);
    }

    expect(estimates[0].estimatedUsdTotal).toBeCloseTo(0.44132, 10);
    expect(estimates[0].estimatedUsdPerConcept).toBeCloseTo(0.044132, 10);
    expect(estimates[1].estimatedUsdTotal).toBeCloseTo(0.22066, 10);
    expect(estimates[2].estimatedUsdTotal).toBeCloseTo(0.088264, 10);
  });

  it("charges output tokens at the model's output price", () => {
    const [sol] = estimateAtomizationCosts("x".repeat(41_000));
    const inputPriceForEveryToken =
      ((sol.estimatedInputTokens + sol.estimatedOutputTokens) * 5) / 1_000_000;

    expect(sol.estimatedUsdTotal).not.toBeCloseTo(inputPriceForEveryToken, 10);
    expect(sol.estimatedUsdTotal).toBeCloseTo(
      (sol.estimatedInputTokens * 5 + sol.estimatedOutputTokens * 30) / 1_000_000,
      10,
    );
  });

  it("is deterministic and returns finite zero estimates for empty text", () => {
    const first = estimateAtomizationCosts("");
    const second = estimateAtomizationCosts("");

    expect(first).toEqual(second);
    expect(first).toHaveLength(PRICING_TABLE.length);
    for (const estimate of first) {
      expect(estimate).toMatchObject({
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedConcepts: 0,
        estimatedUsdTotal: 0,
        estimatedUsdPerConcept: 0,
      });
      expect(Number.isFinite(estimate.estimatedUsdPerConcept)).toBe(true);
    }
  });
});
