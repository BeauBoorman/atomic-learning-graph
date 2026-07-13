// Graph invariants — written FIRST (TDD). These FAIL until Codex implements
// `./invariants` and the atomizer produces a valid `data/graph.json`.
//
// Capturing the RED -> GREEN transition (terminal output) is on-camera proof that
// GPT-5.6/Codex did non-trivial *structural* work, not just glue. Keep these green.
//
// Codex: implement the functions imported below in `src/graph/invariants.ts`, then
// make the real-graph suite pass by producing `data/graph.json` via `pnpm atomize`.

import { describe, it, expect } from "vitest";
import type { LearningGraph, Concept } from "../types";
import {
  hasCycle,
  findOrphans,
  danglingEdges,
  pathExists,
  invalidProvenance,
  isSingleConcept,
} from "./invariants";
import { loadGraph } from "./load"; // Codex: reads data/graph.json

// --- Small hand-built fixture so the invariant FUNCTIONS can be tested without the LLM ---
const fixture: LearningGraph = {
  goalId: "self-attention",
  concepts: (
    ["vectors", "dot-product", "softmax", "qkv", "self-attention"] as const
  ).map(
    (id, i): Concept => ({
      id,
      title: id,
      summary: `single concept: ${id}`,
      prerequisites: i === 0 ? [] : [["vectors", "dot-product", "softmax", "qkv"][i - 1]],
      related: [],
      provenance: { sourceId: "s1", startOffset: i * 100, endOffset: i * 100 + 80 },
      tags: ["llm"],
    })
  ),
  edges: [
    { from: "vectors", to: "dot-product", type: "prereq" },
    { from: "dot-product", to: "softmax", type: "prereq" },
    { from: "softmax", to: "qkv", type: "prereq" },
    { from: "qkv", to: "self-attention", type: "prereq" },
  ],
  renderings: [],
};

describe("invariant functions (fixture)", () => {
  it("1. every node is a single concept (no 'and')", () => {
    for (const c of fixture.concepts) expect(isSingleConcept(c)).toBe(true);
  });

  it("2. no orphan nodes (roots exempt)", () => {
    expect(findOrphans(fixture)).toEqual([]);
  });

  it("3. prerequisite graph is a DAG (no cycles)", () => {
    expect(hasCycle(fixture)).toBe(false);
  });

  it("4. the golden goal is reachable from a root", () => {
    expect(pathExists(fixture, fixture.goalId)).toBe(true);
  });

  it("5. all provenance is valid (start < end, resolvable source)", () => {
    expect(invalidProvenance(fixture)).toEqual([]);
  });

  it("6. no dangling edges", () => {
    expect(danglingEdges(fixture)).toEqual([]);
  });

  it("catches a cycle when one is introduced", () => {
    const cyclic: LearningGraph = {
      ...fixture,
      edges: [...fixture.edges, { from: "self-attention", to: "vectors", type: "prereq" }],
    };
    expect(hasCycle(cyclic)).toBe(true);
  });
});

// --- The real generated graph must satisfy every invariant (fails until `pnpm atomize` runs) ---
describe("generated data/graph.json", () => {
  // loadGraph() is called INSIDE each test, never in the describe body: a throw
  // during collection aborts the WHOLE file (fixture suite included) and vitest
  // reports "no tests" — which hides the RED -> GREEN signal we want on camera.

  it("is a DAG with no dangling edges", () => {
    const g = loadGraph();
    expect(hasCycle(g)).toBe(false);
    expect(danglingEdges(g)).toEqual([]);
  });

  it("has no orphans and valid provenance on every node", () => {
    const g = loadGraph();
    expect(findOrphans(g)).toEqual([]);
    expect(invalidProvenance(g)).toEqual([]);
  });

  it("reaches the demo goal 'self-attention'", () => {
    const g = loadGraph();
    expect(g.goalId).toBe("self-attention");
    expect(pathExists(g, "self-attention")).toBe(true);
  });
});
