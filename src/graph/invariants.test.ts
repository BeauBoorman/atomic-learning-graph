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
//
// Relations live ONLY in `edges[]` (Concept carries none — see types.ts). Provenance is
// quote-primary: each concept quotes SOURCE_TEXT verbatim, and the invariant's job is to prove
// the quote is really there. Note the deliberate whitespace variety in SOURCE_TEXT (a newline
// mid-sentence): a byte-exact substring match FAILS on that, so this fixture forces the
// implementer to normalize whitespace before matching. That is the intended lesson.
const SOURCE_TEXT = [
  "A vector is an ordered list of numbers.",
  "The dot product multiplies two vectors elementwise and sums the result.",
  "Softmax turns a vector of scores into\na probability distribution that sums to one.",
  "Query, key and value are three learned projections of the same input.",
  "Self-attention scores every token against every other token.",
].join(" ");

const QUOTES: Record<string, string> = {
  vectors: "A vector is an ordered list of numbers.",
  "dot-product": "The dot product multiplies two vectors elementwise and sums the result.",
  // Quoted with collapsed whitespace on purpose — the source has a newline inside it.
  softmax: "Softmax turns a vector of scores into a probability distribution that sums to one.",
  qkv: "Query, key and value are three learned projections of the same input.",
  "self-attention": "Self-attention scores every token against every other token.",
};

const fixture: LearningGraph = {
  goalId: "self-attention",
  sources: [
    { id: "s1", title: "How LLMs work (primer)", license: "CC-BY-SA 4.0", text: SOURCE_TEXT },
  ],
  concepts: (
    ["vectors", "dot-product", "softmax", "qkv", "self-attention"] as const
  ).map(
    (id): Concept => ({
      id,
      title: id,
      summary: `single concept: ${id}`,
      provenance: { sourceId: "s1", quotedText: QUOTES[id] },
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

  // Without this, `isSingleConcept = () => true` passes everything above — every fixture summary
  // is "single concept: X", so the invariant is unfalsifiable and proves nothing. This is the
  // negative case that gives it teeth. If a real definition of "one concept" cannot be written,
  // DELETE this invariant and ship five honest ones rather than six with a fake.
  it("catches a MULTI-concept summary (otherwise the invariant is unfalsifiable)", () => {
    const twoThings: Concept = { ...fixture.concepts[0], summary: "vectors and matrices" };
    expect(isSingleConcept(twoThings)).toBe(false);
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

  it("5. all provenance is valid (every quote really occurs in its source)", () => {
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

  // --- Provenance must have TEETH. Without these, an implementation that always returns []
  // passes every test above, and the demo's whole credibility claim is unfalsifiable. ---

  it("catches a FABRICATED quote (the hallucination case — this is the pitch)", () => {
    const fabricated: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "softmax"
          ? { ...c, provenance: { ...c.provenance, quotedText: "Softmax was invented in 1817." } }
          : c
      ),
    };
    expect(invalidProvenance(fabricated)).toEqual(["softmax"]);
  });

  it("catches provenance pointing at a source that does not exist", () => {
    const unresolvable: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "qkv" ? { ...c, provenance: { ...c.provenance, sourceId: "nope" } } : c
      ),
    };
    expect(invalidProvenance(unresolvable)).toEqual(["qkv"]);
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
