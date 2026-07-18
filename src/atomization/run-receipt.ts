import { PRICING_TABLE } from "../cost/estimator";

export interface RunUsageTokens {
  input: number;
  output: number;
  total: number;
}

export interface RunCostReceipt {
  usageTokens: RunUsageTokens;
  costUsd: number;
  costPerConcept: number;
}

export function buildRunCostReceipt(
  model: string,
  usageTokens: RunUsageTokens,
  conceptCount: number,
): RunCostReceipt {
  const pricing = PRICING_TABLE.find((candidate) => candidate.model === model);
  if (!pricing) {
    throw new Error(`no pricing configured for atomization model ${JSON.stringify(model)}`);
  }
  if (!Number.isSafeInteger(conceptCount) || conceptCount <= 0) {
    throw new Error("atomization concept count must be a positive integer");
  }

  const costUsd =
    (usageTokens.input * pricing.inputUsdPer1MTokens +
      usageTokens.output * pricing.outputUsdPer1MTokens) /
    1_000_000;
  return {
    usageTokens: { ...usageTokens },
    costUsd,
    costPerConcept: costUsd / conceptCount,
  };
}
