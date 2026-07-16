import { describe, expect, it } from "vitest";
import type { Concept, LearningGraph } from "../types";
import { fixtureGraph } from "../graph/fixture-graph";
import {
  GOLDEN_PATH,
  GraphConvergenceError,
  GoldenGraphHalt,
  MAX_ATTEMPTS,
  convergeGraph,
} from "./repair";

const clone = (graph: LearningGraph): LearningGraph => JSON.parse(JSON.stringify(graph));

const extraConcept = (id: string): Concept => ({
  id,
  title: id,
  summary: `A single concept named ${id}.`,
  provenance: {
    sourceId: "s1",
    quotedText: "A vector is an ordered list of numbers.",
  },
  tags: ["test"],
});

describe("Gate-6 repair harness", () => {
  it("drops a broken non-golden subgraph without dropping protected golden nodes or edges", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts.push(extraConcept("junk"));
    const repaired = await convergeGraph(graph, { minConcepts: 5 });

    expect(repaired.concepts.map((concept) => concept.id)).not.toContain("junk");
    for (const id of GOLDEN_PATH) expect(repaired.concepts.map((concept) => concept.id)).toContain(id);
    for (let index = 0; index < GOLDEN_PATH.length - 1; index += 1) {
      expect(repaired.edges).toContainEqual({
        from: GOLDEN_PATH[index],
        to: GOLDEN_PATH[index + 1],
        type: "prereq",
      });
    }
  });

  it("HALTs instead of dropping a golden node with unrepairable provenance", async () => {
    const graph = clone(fixtureGraph);
    const vectors = graph.concepts.find((concept) => concept.id === "vectors");
    if (!vectors) throw new Error("test setup: missing vectors");
    vectors.provenance.quotedText = "fabricated golden quote";

    await expect(convergeGraph(graph, { minConcepts: 5 })).rejects.toBeInstanceOf(GoldenGraphHalt);
  });

  it("takes exactly MAX_ATTEMPTS before reporting a non-repairable convergence floor", async () => {
    const attempts: number[] = [];
    await expect(
      convergeGraph(clone(fixtureGraph), {
        minConcepts: 6,
        onAttempt: (attempt) => attempts.push(attempt),
      }),
    ).rejects.toBeInstanceOf(GraphConvergenceError);
    expect(attempts).toEqual(Array.from({ length: MAX_ATTEMPTS }, (_, index) => index + 1));
  });

  it("removes the non-protected back-edge that closes a cycle and preserves the golden chain", async () => {
    const graph = clone(fixtureGraph);
    graph.edges.push({ from: "self-attention", to: "vectors", type: "prereq" });
    const repaired = await convergeGraph(graph, { minConcepts: 5 });

    expect(repaired.edges).not.toContainEqual({
      from: "self-attention",
      to: "vectors",
      type: "prereq",
    });
    for (let index = 0; index < GOLDEN_PATH.length - 1; index += 1) {
      expect(repaired.edges).toContainEqual({
        from: GOLDEN_PATH[index],
        to: GOLDEN_PATH[index + 1],
        type: "prereq",
      });
    }
  });
});
