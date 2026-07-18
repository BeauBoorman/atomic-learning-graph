// Deterministic cost-estimate target. Reads only a supplied file or stdin, then performs pure
// arithmetic over committed constants. It never calls a model, reaches the network, or tokenizes.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATOMIZATION_INPUT_MULTIPLIER,
  CHARS_PER_SOURCE_TOKEN,
  CONCEPTS_PER_1K_CHARS,
  OUTPUT_INPUT_TOKEN_RATIO,
  estimateAtomizationCosts,
} from "../src/cost/estimator";

function inputText(args: readonly string[]): string {
  const positional = args[0] === "--" ? args.slice(1) : args;
  if (positional.length > 1) {
    throw new Error("usage: pnpm estimate:cost -- [file|-] (omit file to read stdin)");
  }
  const path = positional[0];
  return path && path !== "-" ? readFileSync(resolve(path), "utf8") : readFileSync(0, "utf8");
}

function table(rows: readonly string[][]): string {
  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => row[column].length)),
  );
  return rows
    .map((row, index) => {
      const line = row.map((cell, column) => cell.padEnd(widths[column])).join("  ");
      if (index !== 0) return line;
      const divider = widths.map((width) => "-".repeat(width)).join("  ");
      return `${line}\n${divider}`;
    })
    .join("\n");
}

export function formatCostEstimate(text: string): string {
  const estimates = estimateAtomizationCosts(text);
  const rows = [
    ["MODEL", "INPUT TOKENS", "OUTPUT TOKENS", "TOTAL USD", "USD / CONCEPT"],
    ...estimates.map((estimate) => [
      estimate.model,
      String(estimate.estimatedInputTokens),
      String(estimate.estimatedOutputTokens),
      estimate.estimatedUsdTotal.toFixed(6),
      estimate.estimatedUsdPerConcept.toFixed(6),
    ]),
  ];
  const estimatedConcepts = (text.length / 1_000) * CONCEPTS_PER_1K_CHARS;
  const assumptions =
    `${CHARS_PER_SOURCE_TOKEN} chars/source-token; ` +
    `${ATOMIZATION_INPUT_MULTIPLIER.toFixed(5)}x full-run input; ` +
    `${OUTPUT_INPUT_TOKEN_RATIO} output/input; ` +
    `${CONCEPTS_PER_1K_CHARS.toFixed(5)} concepts/1k chars`;
  return [
    `Characters: ${text.length}`,
    `Estimated concepts: ${estimatedConcepts.toFixed(6)}`,
    `Assumptions: ${assumptions}`,
    "",
    table(rows),
  ].join("\n");
}

function main(args: readonly string[] = process.argv.slice(2)): void {
  console.log(formatCostEstimate(inputText(args)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
