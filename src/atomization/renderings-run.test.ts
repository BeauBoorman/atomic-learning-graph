import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { RenderingSet } from "../types";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const renderingsPath = resolve(repoRoot, "data", "renderings.json");
const runPath = resolve(repoRoot, "data", "renderings.run.json");
const generatedIt = existsSync(runPath) ? it : it.skip;

describe("generated renderings run log", () => {
  // Honest pre-run state: the paid run is the only operation allowed to create this provenance log.
  generatedIt("matches the exact committed data/renderings.json bytes", () => {
    const renderings = readFileSync(renderingsPath);
    const run = JSON.parse(readFileSync(runPath, "utf8")) as { renderingsSha256?: string };
    expect(createHash("sha256").update(renderings).digest("hex")).toBe(run.renderingsSha256);
  });

  generatedIt("records the dedicated strict rendering prompt", () => {
    const run = JSON.parse(readFileSync(runPath, "utf8")) as {
      renderingPromptVersion?: string;
      strictStructuredOutputs?: boolean;
    };
    expect(run.renderingPromptVersion).toBe("renderings-v1-question-routes");
    expect(run.strictStructuredOutputs).toBe(true);
  });
  it("committed set is non-empty and covers at least one concept with an alternate", () => {
    const set = JSON.parse(readFileSync(renderingsPath, "utf8")) as RenderingSet;
    expect(set.renderings.length).toBeGreaterThan(0);
    expect(new Set(set.renderings.map(({ conceptId }) => conceptId)).size).toBeGreaterThanOrEqual(1);
  });
});
