import { describe, expect, it } from "vitest";
import { buildRunCostReceipt } from "./run-receipt";

describe("atomization run cost receipt", () => {
  it("prices actual accumulated usage and divides by the landed concept count", () => {
    const receipt = buildRunCostReceipt(
      "gpt-5.6-sol",
      { input: 125, output: 50, total: 175 },
      10,
    );

    expect(receipt.usageTokens).toEqual({ input: 125, output: 50, total: 175 });
    expect(receipt.costUsd).toBe(0.002125);
    expect(receipt.costPerConcept).toBe(receipt.costUsd / 10);
  });

  it("refuses to guess a cost for a model missing from the shared pricing table", () => {
    expect(() =>
      buildRunCostReceipt(
        "gpt-unpriced",
        { input: 1, output: 1, total: 2 },
        1,
      ),
    ).toThrow(/no pricing configured.*gpt-unpriced/i);
  });
});
