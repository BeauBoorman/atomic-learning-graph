import { describe, expect, it } from "vitest";
import type { LearningGraph } from "../types";
import { fixtureGraph } from "./fixture-graph";
import {
  READABILITY_ADVISORY_GRADE,
  READABILITY_HARD_FLOOR,
  ReadabilityFloorError,
  checkLessonReadability,
  fleschKincaidGrade,
  lessonReadabilityGrade,
} from "./readability";

const withLessonText = (text: string): LearningGraph => {
  const graph = structuredClone(fixtureGraph);
  const concept = graph.concepts[0];
  if (!concept.lesson) throw new Error("test setup: vectors lesson missing");
  concept.lesson.steps = concept.lesson.steps.map((step) => ({ ...step, text }));
  return graph;
};

describe("lesson readability", () => {
  it("computes Flesch-Kincaid once over every step in the lesson", () => {
    const lesson = fixtureGraph.concepts[0].lesson;
    if (!lesson) throw new Error("test setup: vectors lesson missing");
    expect(lessonReadabilityGrade(lesson)).toBe(
      fleschKincaidGrade(lesson.steps.map((step) => step.text).join(" ")),
    );
  });

  it("returns a low-confidence advisory without throwing in the advisory band", () => {
    const graph = withLessonText(
      "Self-attention compares each token with every token in the sequence. The comparison scores decide which information receives more influence.",
    );
    const grade = lessonReadabilityGrade(graph.concepts[0].lesson!);
    expect(grade).toBeGreaterThanOrEqual(READABILITY_ADVISORY_GRADE);
    expect(grade).toBeLessThanOrEqual(READABILITY_HARD_FLOOR);

    expect(() => checkLessonReadability(graph)).not.toThrow();
    expect(checkLessonReadability(graph)).toContainEqual(
      expect.objectContaining({ conceptId: "vectors", confidence: "low" }),
    );
  });

  it("hard-fails a lesson above the grade-16 floor", () => {
    const graph = withLessonText(
      "Electromagnetic interoperability necessitates multidimensional characterization of disproportionately heterogeneous computational representations.",
    );
    const grade = lessonReadabilityGrade(graph.concepts[0].lesson!);
    expect(grade).toBeGreaterThan(READABILITY_HARD_FLOOR);

    let thrown: unknown;
    try {
      checkLessonReadability(graph);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ReadabilityFloorError);
    expect((thrown as ReadabilityFloorError).failures).toContainEqual(
      expect.objectContaining({ conceptId: "vectors" }),
    );
  });
});
