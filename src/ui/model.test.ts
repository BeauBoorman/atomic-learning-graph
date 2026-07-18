import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import { loadGraph } from "../graph/load";
import {
  courseFor,
  coursePageKey,
  coveredConcepts,
  deriveProgress,
  pathFor,
  resolveCitation,
  resolveLesson,
  selfExplanationPrompt,
} from "./model";
import { titleFor } from "./titles";

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

  it("renders lesson material from resolved, quote-primary provenance", () => {
    const lesson = resolveLesson(graph, graph.goalId);
    expect(lesson.source.id).toBe(lesson.concept.provenance.sourceId);
    expect(lesson.source.text).toContain(lesson.concept.provenance.quotedText);
    expect(lesson.context).toContain(lesson.concept.provenance.quotedText);
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

  // These two replace "derives completion and percentage from the same remaining course
  // pages", which asserted the defect as correct on the FIXTURE. It required
  // `deriveProgress(fixtureGraph, ["vectors"], "softmax", "quick")` — no page recorded, one
  // concept "known" — to report completeCount 1, 33%, remaining[0] = dot-product:0. That
  // blessed both halves of the live bug: completion inferred from a length difference
  // (`total - remaining.length`), and the page you were reading pruned out of the course.
  // It also required a course with NOTHING recorded to report 100% complete. It passed only
  // because every fixture concept has exactly ONE core page, so "concept known" and "page
  // read" coincide there. On the real graph `vectors` has two, and the same call opens a
  // fresh course at "Page 3 of 10", 20%, on the wrong lesson. Test the real graph.
  it("counts a page complete only when its page key is recorded", () => {
    expect(courseFor(graph, "self-attention", "quick", [])).toHaveLength(10);

    const fresh = deriveProgress(graph, "self-attention", "quick", []);
    expect(fresh).toMatchObject({ completeCount: 0, total: 10, percent: 0, complete: false });
    expect(fresh.remaining[0]).toEqual({ conceptId: "vectors", stepIndex: 0 });

    // The killer assertion, checked by re-running the old code: with known=["vectors"] in
    // localStorage — reachable in one clean session by finishing vectors under ANY other goal —
    // the old form pruned BOTH vectors pages out of the course and returned completeCount 2,
    // remaining[0] = dot-product:0. That is "Page 3 of 10", 20%, opening on the wrong lesson
    // with nothing read. There is no progress-derived `known` channel left for that to leak
    // through; the explicit declaration argument for this course is still empty.
    const afterOne = deriveProgress(graph, "self-attention", "quick", ["vectors:0"]);
    expect(afterOne).toMatchObject({ completeCount: 1, total: 10 });
    expect(afterOne.remaining[0]).toEqual({ conceptId: "vectors", stepIndex: 1 });
  });

  it("starts after explicitly declared prerequisites and builds a shorter fixed course", () => {
    const fromScratch = deriveProgress(graph, "self-attention", "quick", [], []);
    const declaredKnown = ["vectors", "dot-product"];
    const fresh = deriveProgress(graph, "self-attention", "quick", [], declaredKnown);

    expect(fresh.pages.length).toBeLessThan(fromScratch.pages.length);
    expect(fresh.remaining[0]).toEqual({ conceptId: "softmax", stepIndex: 0 });

    const afterOnePage = deriveProgress(
      graph,
      "self-attention",
      "quick",
      [coursePageKey(fresh.remaining[0])],
      declaredKnown,
    );
    expect(afterOnePage.pages).toEqual(fresh.pages);
    expect(afterOnePage.total).toBe(fresh.total);
    expect(afterOnePage.remaining[0]).toEqual({ conceptId: "softmax", stepIndex: 1 });
  });

  it("drops declarations that are not prerequisites of a newly selected goal", async () => {
    const model = await import("./model") as Record<string, unknown>;
    expect(model).toHaveProperty("knownForGoal");
    const knownForGoal = model.knownForGoal as (
      graph: typeof fixtureGraph,
      goalId: string,
      known: string[],
    ) => string[];

    expect(knownForGoal(
      fixtureGraph,
      "softmax",
      ["vectors", "qkv", "self-attention"],
    )).toEqual(["vectors"]);
  });

  it("keeps an empty declaration byte-identical to the pre-declaration course", () => {
    const expected = JSON.stringify(deriveProgress(graph, "self-attention", "quick", []));

    expect(JSON.stringify(deriveProgress(graph, "self-attention", "quick", [], [])))
      .toBe(expected);
  });

  it("opens every goal at page 1 on a fresh course", () => {
    for (const concept of graph.concepts) {
      const p = deriveProgress(graph, concept.id, "quick", []);
      expect(p).toMatchObject({ completeCount: 0, percent: 0, complete: false });
      expect(p.remaining[0]).toEqual(courseFor(graph, concept.id, "quick", [])[0]);
    }
  });

  it("derives covered concepts from recorded pages, never a comprehension claim", () => {
    // `vectors` has TWO core pages. Reading the first has not covered the concept's course pages.
    expect(coveredConcepts(graph, "self-attention", "quick", ["vectors:0"])).toEqual([]);
    expect(coveredConcepts(graph, "self-attention", "quick", ["vectors:0", "vectors:1"]))
      .toEqual(["vectors"]);
  });

  it("builds a claim-free self-explanation question from display titles only", () => {
    const prerequisite = fixtureGraph.concepts.find((concept) => concept.id === "vectors");
    const concept = fixtureGraph.concepts.find((concept) => concept.id === "dot-product");
    if (!prerequisite || !concept) throw new Error("fixture concepts missing");

    expect(selfExplanationPrompt(concept, prerequisite)).toBe(
      `Before you continue — in your own words, why does ${titleFor(concept)} need ${titleFor(prerequisite)}?`,
    );
  });

  it("resolves the citation attached to the exact lesson page", () => {
    const citation = resolveCitation(fixtureGraph, "softmax", 0);
    expect(citation.quote).toBe(fixtureGraph.concepts[2].lesson?.steps[0].citation.quotedText);
    expect(citation.context).toContain("Softmax turns a vector of scores");
  });
});
