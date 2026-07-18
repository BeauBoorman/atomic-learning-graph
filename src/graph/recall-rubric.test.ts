import { describe, expect, it } from "vitest";
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
