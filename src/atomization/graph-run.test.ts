import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");

describe("generated graph run log", () => {
  it("matches the exact committed data/graph.json bytes", () => {
    const graph = readFileSync(resolve(repoRoot, "data", "graph.json"));
    const run = JSON.parse(readFileSync(resolve(repoRoot, "data", "graph.run.json"), "utf8")) as {
      graphSha256?: string;
    };
    expect(createHash("sha256").update(graph).digest("hex")).toBe(run.graphSha256);
  });

  it("matches the exact committed data/oer/sources.json bytes", () => {
    const manifest = readFileSync(resolve(repoRoot, "data", "oer", "sources.json"));
    const run = JSON.parse(readFileSync(resolve(repoRoot, "data", "graph.run.json"), "utf8")) as {
      manifestSha256?: string;
    };
    expect(createHash("sha256").update(manifest).digest("hex")).toBe(run.manifestSha256);
  });

  it("records the strict three-phase translation prompt", () => {
    const run = JSON.parse(readFileSync(resolve(repoRoot, "data", "graph.run.json"), "utf8")) as {
      promptVersion?: string;
      strictStructuredOutputs?: boolean;
    };
    expect(run.promptVersion).toBe("atomizer-v4-full-spine-one-claim-steps");
    expect(run.strictStructuredOutputs).toBe(true);
  });
});
