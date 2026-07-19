import { describe, expect, it } from "vitest";
import { loadGraph } from "./load";
import type { RecallRubric } from "../types";
import { fixtureGraph } from "./fixture-graph";
import { buildRecallRubric, checkRecall } from "./recall-rubric";

describe("buildRecallRubric", () => {
  it("projects each lesson-step citation without authoring new claims", () => {
    const concept = fixtureGraph.concepts[0];
    const rubric = buildRecallRubric(concept);

    expect(rubric.conceptId).toBe(concept.id);
    expect(rubric.items).toHaveLength(concept.lesson!.steps.length);
    expect(rubric.items[0]).toEqual({
      conceptId: "vectors",
      sourceId: concept.lesson?.steps[0].citation.sourceId,
      quotedText: concept.lesson?.steps[0].citation.quotedText,
      mustMention: ["vector", "ordered", "list", "numbers"],
    });
  });

  it("keeps only meaningful prose words, not stopwords or LaTeX command fragments", () => {
    const concept = structuredClone(fixtureGraph.concepts[0]);
    concept.lesson!.steps[0].citation.quotedText =
      "The weights can be written as $\\textrm{value} \\mathbf{w} = \\left(1\\right)$ for every vector.";

    const rubric = buildRecallRubric(concept);
    expect(rubric.items[0].mustMention).toEqual(["weights", "written", "vector"]);
    expect(checkRecall("A vector has weights written for it.", { ...rubric, items: [rubric.items[0]] })).toEqual([
      { itemIndex: 0, met: true },
    ]);
  });

  it("accepts the generated vector answer key for its first grounded checkpoint", () => {
    const concept = loadGraph().concepts.find(({ id }) => id === "vectors");
    if (!concept) throw new Error("generated graph lost vectors");

    const rubric = buildRecallRubric(concept);
    expect(checkRecall(concept.summary, { ...rubric, items: [rubric.items[0]] })).toEqual([
      { itemIndex: 0, met: true },
    ]);
  });
});

describe("checkRecall", () => {
  const rubric: RecallRubric = {
    conceptId: "vectors",
    items: [
      {
        conceptId: "vectors",
        sourceId: "s1",
        quotedText: "A vector is an ordered list of numbers.",
        mustMention: ["vector", "ordered", "list", "numbers"],
      },
    ],
  };

  it("matches every required term case-insensitively as an exact content word", () => {
    expect(checkRecall("An ORDERED vector is a list containing numbers.", rubric)).toEqual([
      { itemIndex: 0, met: true },
    ]);
    expect(checkRecall("An ordered vector contains numbers.", rubric)).toEqual([
      { itemIndex: 0, met: false },
    ]);
  });

  it("fails closed when an invalid rubric supplies no required terms", () => {
    const invalid = structuredClone(rubric);
    invalid.items[0].mustMention = [];
    expect(checkRecall("anything", invalid)).toEqual([{ itemIndex: 0, met: false }]);
  });
});
