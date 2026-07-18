import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emitCourseReceipt,
  type AtomicityReceiptFacts,
  type GraphRunReceiptFacts,
  type SourceReceiptFacts,
} from "../../scripts/emit-receipt";
import type { LearningGraph } from "../types";

const repoRoot = resolve(import.meta.dirname, "..", "..");

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(resolve(repoRoot, ...segments), "utf8")) as T;
}

describe("course receipt", () => {
  const graph = readJson<LearningGraph>("data", "graph.json");
  const run = readJson<GraphRunReceiptFacts>("data", "graph.run.json");
  const manifest = readJson<SourceReceiptFacts>("data", "oer", "sources.json");
  const atomicityReport = readJson<AtomicityReceiptFacts>("data", "atomicity-report.json");
  const committedBytes = readFileSync(resolve(repoRoot, "data", "course.receipt.json"), "utf8");
  const receipt = JSON.parse(committedBytes) as {
    generation: { runtimeModelCalls: number };
    verification: { graphHash: string };
  };

  it("matches the exact committed data/course.receipt.json bytes", () => {
    expect(emitCourseReceipt(graph, run, manifest, atomicityReport)).toBe(committedBytes);
  });

  it("records the graph hash from the committed run log", () => {
    expect(receipt.verification.graphHash).toBe(run.graphSha256);
  });

  it("records zero runtime model calls", () => {
    expect(receipt.generation.runtimeModelCalls).toBe(0);
  });
});
