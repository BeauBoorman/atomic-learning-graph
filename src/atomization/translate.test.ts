import { describe, expect, it } from "vitest";
import { fixtureGraph, QUOTES } from "../graph/fixture-graph";
import { invalidLessonCitations } from "../graph/invariants";
import type { LearningGraph } from "../types";
import {
  PROMPT_VERSION,
  TRANSLATE_INSTRUCTIONS,
  excerptAroundAnchor,
  lessonSchema,
  parseLesson,
  translateAndConvergeLessons,
  type JsonObject,
  type TranslationClient,
  type TranslationRequestOptions,
} from "./translate";

const clone = (graph: LearningGraph): LearningGraph => JSON.parse(JSON.stringify(graph));

class FakeClient implements TranslationClient {
  readonly calls: Array<{
    instructions: string;
    input: string;
    schema: JsonObject;
    schemaName: string;
    options: TranslationRequestOptions;
  }> = [];

  constructor(
    private readonly respond: (
      schemaName: string,
      input: string,
      callIndex: number,
    ) => JsonObject,
  ) {}

  async request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options: TranslationRequestOptions,
  ): Promise<JsonObject> {
    this.calls.push({ instructions, input, schema, schemaName, options });
    return this.respond(schemaName, input, this.calls.length - 1);
  }
}

const oneConceptGraph = (): LearningGraph => {
  const graph = clone(fixtureGraph);
  graph.concepts = [graph.concepts[0]!];
  graph.edges = [];
  graph.goalId = graph.concepts[0]!.id;
  return graph;
};

describe("Phase 3 lesson translation", () => {
  it("pins the moonshot beginner-teacher prompt and 4–6 step schema", () => {
    expect(PROMPT_VERSION).toBe("atomizer-v7-moonshot-beginner-teacher");
    expect(TRANSLATE_INSTRUCTIONS).toContain("world-class teacher");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Feynman");
    expect(TRANSLATE_INSTRUCTIONS).toContain("smart, motivated beginner");
    expect(TRANSLATE_INSTRUCTIONS).toContain("NO math past basic arithmetic");
    expect(TRANSLATE_INSTRUCTIONS).toContain("TEACHING ARC (5 mandatory steps");
    expect(TRANSLATE_INSTRUCTIONS).toContain("**The hook.**");
    expect(TRANSLATE_INSTRUCTIONS).toContain("**Plain definition.**");
    expect(TRANSLATE_INSTRUCTIONS).toContain("**Worked example.**");
    expect(TRANSLATE_INSTRUCTIONS).toContain("**Intuition / analogy.**");
    expect(TRANSLATE_INSTRUCTIONS).toContain("**The precise version, LAST.**");
    expect(TRANSLATE_INSTRUCTIONS).toContain("US grade 6-8");
    expect(TRANSLATE_INSTRUCTIONS).toContain("a stack of number-grids (a third-order tensor)");
    expect(TRANSLATE_INSTRUCTIONS).toContain("DECOUPLE TEACHING FROM CITATION");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Write the plain explanation FIRST");
    expect(TRANSLATE_INSTRUCTIONS).toContain("PROOF");
    expect(TRANSLATE_INSTRUCTIONS).toContain("must NOT drag your wording back to textbook register");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Never define a word with itself");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Attention is when tokens attend to each other");
    expect(TRANSLATE_INSTRUCTIONS).toContain("NUMBERS are model-authored");
    expect(TRANSLATE_INSTRUCTIONS).toContain("NEVER attribute them to the source");
    expect(TRANSLATE_INSTRUCTIONS).toContain("arithmetic MUST be correct");
    expect(TRANSLATE_INSTRUCTIONS).toContain("VERBATIM, character-for-character");
    expect(TRANSLATE_INSTRUCTIONS).toContain("strikethrough");
    expect(TRANSLATE_INSTRUCTIONS).toContain("UNIQUE across the whole course");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Measuring a Matrix");
    expect(TRANSLATE_INSTRUCTIONS).toContain("GRAPH_DEFINED_CONCEPTS");
    expect(TRANSLATE_INSTRUCTIONS).toContain("multi-head attention");
    expect(lessonSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["plainTitle", "steps"],
      properties: {
        steps: {
          type: "array",
          minItems: 4,
          maxItems: 6,
        },
      },
    });
    expect((lessonSchema.properties as JsonObject).tier).toBeUndefined();
  });

  it("takes an aligned narrow window around the validated anchor", () => {
    const before = `First paragraph ${"before ".repeat(350)}ends here.`;
    const anchor = "The anchor sentence is copied exactly.";
    const source = `${before}\n\nAnchor paragraph starts. ${anchor} Anchor paragraph ends.\n\n${"after ".repeat(350)}Done.`;

    const excerpt = excerptAroundAnchor(source, anchor);
    expect(excerpt).toContain(anchor);
    expect(excerpt).toMatch(/^First paragraph|^Anchor paragraph/u);
    expect(excerpt).toMatch(/ends\.$|Done\.$/u);
    expect(excerpt.length).toBeLessThan(source.length);
  });

  it("snaps citations, makes one scoped repair, and returns a clean lesson graph", async () => {
    const graph = oneConceptGraph();
    const client = new FakeClient((schemaName) => {
      if (schemaName === "lesson_translation") {
        return {
          plainTitle: "Vectors in plain words",
          steps: [
            {
              text: "Hook: a vector lets you carry several related numbers as one thing.",
              stepTier: "core",
              citation: { sourceId: "s1", quotedText: QUOTES.vectors },
            },
            {
              text: "Plain definition: a vector is an ordered list of numbers.",
              stepTier: "core",
              citation: { sourceId: "s1", quotedText: QUOTES.vectors },
            },
            {
              text: "Worked example: [2, 4, 6] has three entries in order.",
              stepTier: "core",
              citation: { sourceId: "s1", quotedText: "fabricated citation" },
            },
            {
              text: "Formal: x ∈ R^n names a vector of n real numbers.",
              stepTier: "core",
              citation: { sourceId: "s1", quotedText: QUOTES.vectors },
            },
          ],
        };
      }
      expect(schemaName).toBe("lesson_citation_repair");
      return { quotedText: QUOTES.vectors };
    });

    const translated = await translateAndConvergeLessons(graph, client);

    expect(invalidLessonCitations(translated)).toEqual([]);
    expect(translated.concepts[0]?.lesson?.plainTitle).toBe("Vectors in plain words");
    expect(client.calls.map(({ schemaName }) => schemaName)).toEqual([
      "lesson_translation",
      "lesson_citation_repair",
    ]);
    for (const call of client.calls) {
      expect(call.options).toEqual({ forceStrict: true, maxOutputTokens: 3000 });
    }
    expect(client.calls[0]?.input).toContain("GRAPH_DEFINED_CONCEPTS=");
    expect(client.calls[0]?.input).toContain('"id":"vectors"');
  });

  it("drops an ungrounded step after one repair and restores the grounded floor", async () => {
    const client = new FakeClient((schemaName) =>
      schemaName === "lesson_translation"
        ? {
            plainTitle: "Vectors",
            steps: [
              {
                text: "Hook.",
                stepTier: "core",
                citation: { sourceId: "wrong-source", quotedText: "not in the source" },
              },
              {
                text: "Plain definition.",
                stepTier: "core",
                citation: { sourceId: "s1", quotedText: QUOTES.vectors },
              },
              {
                text: "Worked example.",
                stepTier: "core",
                citation: { sourceId: "s1", quotedText: QUOTES.vectors },
              },
              {
                text: "Formal statement.",
                stepTier: "core",
                citation: { sourceId: "s1", quotedText: QUOTES.vectors },
              },
            ],
          }
        : { quotedText: "still fabricated" },
    );

    const translated = await translateAndConvergeLessons(oneConceptGraph(), client);
    const steps = translated.concepts[0]?.lesson?.steps ?? [];

    expect(client.calls.map(({ schemaName }) => schemaName)).toEqual([
      "lesson_translation",
      "lesson_citation_repair",
    ]);
    expect(steps.some(({ citation }) => citation.quotedText === "not in the source")).toBe(false);
    expect(invalidLessonCitations(translated)).toEqual([]);
  });

  it("rejects output that sneaks concept-level tier back into the lesson contract", () => {
    expect(() =>
      parseLesson({
        plainTitle: "Vectors",
        tier: "core",
        steps: [
          {
            text: "One.",
            stepTier: "core",
            citation: { sourceId: "s1", quotedText: QUOTES.vectors },
          },
          {
            text: "Two.",
            stepTier: "core",
            citation: { sourceId: "s1", quotedText: QUOTES.vectors },
          },
          {
            text: "Three.",
            stepTier: "core",
            citation: { sourceId: "s1", quotedText: QUOTES.vectors },
          },
          {
            text: "Four.",
            stepTier: "deep",
            citation: { sourceId: "s1", quotedText: QUOTES.vectors },
          },
        ],
      }),
    ).toThrow(/unexpected field.*tier/iu);
  });
});
