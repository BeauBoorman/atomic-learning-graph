import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Concept, LearningGraph, RenderingSet } from "../types";
import { fixtureGraph } from "../graph/fixture-graph";
import { invalidLessonCitations } from "../graph/invariants";
import {
  InvalidGraphArtifactError,
  InvalidRenderingArtifactError,
  writeGraphArtifact,
  writeRenderingsArtifact,
} from "./artifacts";
import {
  FULL_GRAPH_SPINE,
  GOLDEN_PATH,
  GraphConvergenceError,
  GoldenGraphHalt,
  MAX_ATTEMPTS,
  convergeLessonCitations,
  convergeGraph,
  convergenceIssues,
  lessonConvergenceIssues,
} from "./repair";

const clone = (graph: LearningGraph): LearningGraph => JSON.parse(JSON.stringify(graph));
const committedGraph = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "data", "graph.json"), "utf8"),
) as LearningGraph;

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

describe("full product graph specification", () => {
  it("pins all ten concept IDs, source assignments, nine prerequisite edges, and the goal", () => {
    expect(FULL_GRAPH_SPINE).toEqual({
      concepts: [
        { id: "vectors", sourceId: "d2l-linear-algebra" },
        { id: "vector-norm", sourceId: "d2l-linear-algebra" },
        { id: "dot-product", sourceId: "d2l-linear-algebra" },
        { id: "matrix-vector-product", sourceId: "d2l-linear-algebra" },
        { id: "softmax", sourceId: "d2l-softmax-regression" },
        { id: "softmax-ordering", sourceId: "d2l-softmax-regression" },
        { id: "qkv", sourceId: "d2l-queries-keys-values" },
        { id: "attention-pooling", sourceId: "d2l-queries-keys-values" },
        { id: "self-attention", sourceId: "d2l-self-attention" },
        { id: "positional-encoding", sourceId: "d2l-self-attention" },
      ],
      prereqEdges: [
        { from: "vectors", to: "dot-product", type: "prereq" },
        { from: "vectors", to: "vector-norm", type: "prereq" },
        { from: "dot-product", to: "matrix-vector-product", type: "prereq" },
        { from: "dot-product", to: "softmax", type: "prereq" },
        { from: "softmax", to: "qkv", type: "prereq" },
        { from: "softmax", to: "softmax-ordering", type: "prereq" },
        { from: "qkv", to: "attention-pooling", type: "prereq" },
        { from: "qkv", to: "self-attention", type: "prereq" },
        { from: "self-attention", to: "positional-encoding", type: "prereq" },
      ],
      path: GOLDEN_PATH,
      goalId: "self-attention",
    });
  });

  it("treats any extra node or edge as structural drift", () => {
    expect(
      convergenceIssues(clone(committedGraph), {
        minConcepts: 10,
        structure: FULL_GRAPH_SPINE,
      }),
    ).toEqual([]);

    const drifted = clone(committedGraph);
    drifted.concepts.push(extraConcept("model-discovered-drift"));
    drifted.edges.push({ from: "vectors", to: "softmax-ordering", type: "related" });

    expect(convergenceIssues(drifted, { minConcepts: 10, structure: FULL_GRAPH_SPINE })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "spine-node" }),
        expect.objectContaining({ kind: "spine-edge" }),
      ]),
    );
  });

  it("treats a duplicate pinned edge as drift instead of accepting ten edge entries", () => {
    const drifted = clone(committedGraph);
    drifted.edges.push({ ...drifted.edges[0]! });

    expect(convergenceIssues(drifted, { minConcepts: 10, structure: FULL_GRAPH_SPINE })).toContainEqual(
      expect.objectContaining({ kind: "spine-edge" }),
    );
  });

  it("protects branch nodes in the full spine, not only the five-node demo path", async () => {
    const graph = clone(committedGraph);
    const vectorNorm = graph.concepts.find(({ id }) => id === "vector-norm");
    if (!vectorNorm) throw new Error("test setup: missing vector-norm");
    vectorNorm.provenance.quotedText = "fabricated branch-node quote";

    await expect(
      convergeGraph(graph, { minConcepts: 10, structure: FULL_GRAPH_SPINE }),
    ).rejects.toBeInstanceOf(GoldenGraphHalt);
  });
});

describe("Gate-6 repair harness", () => {
  it("rejects duplicate concept and source IDs as typed convergence issues", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts.push(clone(fixtureGraph).concepts[2]);
    graph.sources.push({ ...graph.sources[0] });

    expect(convergenceIssues(graph, { minConcepts: 5 })).toContainEqual(
      expect.objectContaining({
        kind: "duplicate-id",
        conceptIds: ["softmax"],
        sourceIds: ["s1"],
      }),
    );
    const duplicateConceptOnly = clone(fixtureGraph);
    duplicateConceptOnly.concepts.push(clone(fixtureGraph).concepts[2]);
    await expect(convergeGraph(duplicateConceptOnly, { minConcepts: 5 })).rejects.toBeInstanceOf(
      GraphConvergenceError,
    );
  });

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

describe("lesson-only convergence", () => {
  it("reports typed lesson-citation issues without adding them to base convergence", () => {
    const graph = clone(fixtureGraph);
    const lesson = graph.concepts[0].lesson;
    if (!lesson) throw new Error("test setup: vectors lesson missing");
    lesson.steps[1].citation.quotedText = "fabricated lesson citation";

    expect(convergenceIssues(graph, { minConcepts: 5 })).not.toContainEqual(
      expect.objectContaining({ kind: "lesson-citation" }),
    );
    expect(lessonConvergenceIssues(graph)).toEqual([
      expect.objectContaining({
        kind: "lesson-citation",
        conceptIds: ["vectors"],
        lessonCitationIssues: [
          { conceptId: "vectors", stepIndex: 1, reason: "quote-not-found" },
        ],
      }),
    ]);
  });

  it("tries one citation repair, drops a still-bad step, and restores the two-step floor", async () => {
    const graph = clone(fixtureGraph);
    const lesson = graph.concepts[0].lesson;
    if (!lesson) throw new Error("test setup: vectors lesson missing");
    lesson.steps[1].citation.quotedText = "fabricated lesson citation";
    let repairCalls = 0;

    const repaired = await convergeLessonCitations(graph, {
      repairLessonCitation: async (candidate, issue) => {
        repairCalls += 1;
        expect(issue).toEqual({ conceptId: "vectors", stepIndex: 1, reason: "quote-not-found" });
        return candidate;
      },
    });

    expect(repairCalls).toBe(1);
    expect(invalidLessonCitations(repaired)).toEqual([]);
    expect(repaired.concepts[0].lesson?.steps).toHaveLength(2);
    expect(repaired.concepts[0].lesson?.steps.some(
      (step) => step.citation.quotedText === "fabricated lesson citation",
    )).toBe(false);
  });

  it("creates two grounded floor steps for a missing lesson", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts[0].lesson = undefined;

    const repaired = await convergeLessonCitations(graph);
    const concept = repaired.concepts[0];
    expect(concept.lesson?.plainTitle).toBe(concept.title);
    expect(concept.lesson?.steps).toHaveLength(2);
    for (const step of concept.lesson?.steps ?? []) {
      expect(step.stepTier).toBe("core");
      expect(step.citation).toEqual(concept.provenance);
    }
    expect(invalidLessonCitations(repaired)).toEqual([]);
  });

  it("never lets an ungrounded lesson step reach graph.json", async () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-learning-graph-phase2-"));
    const graphPath = join(directory, "graph.json");
    try {
      const graph = clone(fixtureGraph);
      const lesson = graph.concepts[0].lesson;
      if (!lesson) throw new Error("test setup: vectors lesson missing");
      lesson.steps[0].citation.quotedText = "fabricated lesson citation";

      expect(() => writeGraphArtifact(graphPath, graph)).toThrow(InvalidGraphArtifactError);
      expect(existsSync(graphPath)).toBe(false);

      const repaired = await convergeLessonCitations(graph);
      writeGraphArtifact(graphPath, repaired);
      const written = JSON.parse(readFileSync(graphPath, "utf8")) as LearningGraph;
      expect(invalidLessonCitations(written)).toEqual([]);
      expect(readFileSync(graphPath, "utf8")).not.toContain("fabricated lesson citation");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("never writes an ungrounded alternate rendering", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-learning-renderings-"));
    const renderingsPath = join(directory, "renderings.json");
    try {
      const set: RenderingSet = {
        renderings: [
          {
            conceptId: "vectors",
            format: "why-it-exists",
            plainTitle: "Why vectors exist",
            steps: [
              {
                text: "Vectors keep related numbers together.",
                stepTier: "core",
                citation: { sourceId: "s1", quotedText: "fabricated rendering citation" },
              },
              {
                text: "They are ordered lists.",
                stepTier: "deep",
                citation: {
                  sourceId: "s1",
                  quotedText: "A vector is an ordered list of numbers.",
                },
              },
            ],
          },
        ],
      };

      expect(() => writeRenderingsArtifact(renderingsPath, fixtureGraph, set)).toThrow(
        InvalidRenderingArtifactError,
      );
      expect(existsSync(renderingsPath)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
