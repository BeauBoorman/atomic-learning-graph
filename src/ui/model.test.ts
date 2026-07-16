import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import { loadGraph } from "../graph/load";
import {
  courseFor,
  deriveProgress,
  markUnderstood,
  pathFor,
  resolveCitation,
  resolveLesson,
} from "./model";

const graph = loadGraph();

describe("UI learning model", () => {
  it("derives the visible route from getPath", () => {
    const path = pathFor(graph, graph.goalId, []);
    expect(path[0]).toBe("vectors");
    expect(path.at(-1)).toBe(graph.goalId);
    expect(path).toContain("dot-product");
    expect(path).toContain("softmax");
    expect(path).toContain("qkv");
  });

  it("mark understood recomputes and advances the path without mutating the graph", () => {
    const original = JSON.stringify(graph);
    const current = pathFor(graph, graph.goalId, [])[0];
    const next = markUnderstood(graph, graph.goalId, [], current);

    expect(next.known).toEqual([current]);
    expect(next.path).not.toContain(current);
    expect(next.path[0]).not.toBe(current);
    expect(JSON.stringify(graph)).toBe(original);
  });

  it("renders lesson material from resolved, quote-primary provenance", () => {
    const lesson = resolveLesson(graph, graph.goalId);
    expect(lesson.source.id).toBe(lesson.concept.provenance.sourceId);
    expect(lesson.source.text).toContain(lesson.concept.provenance.quotedText);
    expect(lesson.context).toContain(lesson.concept.provenance.quotedText);
  });

  it("threads a selected goal through path and progress updates", () => {
    expect(pathFor(fixtureGraph, "softmax", [])).toEqual([
      "vectors",
      "dot-product",
      "softmax",
    ]);

    const next = markUnderstood(fixtureGraph, "softmax", [], "vectors");
    expect(next.path).toEqual(["dot-product", "softmax"]);
    expect(next.path).not.toContain("self-attention");
  });

  it("builds quick courses from core pages and thorough courses from all related enrichment", () => {
    const enriched = structuredClone(fixtureGraph);
    enriched.concepts.push({
      id: "cosine-similarity",
      title: "cosine similarity",
      summary: "A comparison based on the angle between two vectors.",
      tags: ["llm"],
      provenance: fixtureGraph.concepts[0].provenance,
      lesson: {
        plainTitle: "Compare vector directions",
        steps: [
          {
            text: "Compare the direction of two vectors.",
            stepTier: "core",
            citation: fixtureGraph.concepts[0].provenance,
          },
          {
            text: "The vector lengths do not control this comparison.",
            stepTier: "deep",
            citation: fixtureGraph.concepts[0].provenance,
          },
        ],
      },
    });
    enriched.edges.push({ from: "vectors", to: "cosine-similarity", type: "related" });

    const quick = courseFor(enriched, "softmax", "quick", []);
    const thorough = courseFor(enriched, "softmax", "thorough", []);

    expect(quick).toEqual([
      { conceptId: "vectors", stepIndex: 0 },
      { conceptId: "dot-product", stepIndex: 0 },
      { conceptId: "softmax", stepIndex: 0 },
    ]);
    expect(thorough.filter((page) => page.conceptId === "vectors")).toHaveLength(2);
    expect(thorough.filter((page) => page.conceptId === "cosine-similarity")).toHaveLength(2);
    expect(thorough.some((page) => page.conceptId === "self-attention")).toBe(false);

    const afterCoreIsKnown = courseFor(enriched, "softmax", "thorough", ["vectors"]);
    expect(afterCoreIsKnown).not.toContainEqual({ conceptId: "vectors", stepIndex: 0 });
    expect(afterCoreIsKnown).toContainEqual({ conceptId: "vectors", stepIndex: 1 });
  });

  it("derives completion and percentage from the same remaining course pages", () => {
    const initial = deriveProgress(fixtureGraph, [], "softmax", "quick");
    expect(initial).toMatchObject({ completeCount: 0, total: 3, percent: 0, complete: false });
    expect(initial.remaining).toHaveLength(3);

    const afterOne = deriveProgress(fixtureGraph, ["vectors"], "softmax", "quick");
    expect(afterOne).toMatchObject({ completeCount: 1, total: 3, percent: 33, complete: false });
    expect(afterOne.remaining[0]).toEqual({ conceptId: "dot-product", stepIndex: 0 });

    const done = deriveProgress(
      fixtureGraph,
      ["vectors", "dot-product", "softmax"],
      "softmax",
      "quick",
    );
    expect(done).toMatchObject({ remaining: [], completeCount: 3, total: 3, percent: 100, complete: true });
  });

  it("resolves the citation attached to the exact lesson page", () => {
    const citation = resolveCitation(fixtureGraph, "softmax", 0);
    expect(citation.quote).toBe(fixtureGraph.concepts[2].lesson?.steps[0].citation.quotedText);
    expect(citation.context).toContain("Softmax turns a vector of scores");
  });
});
