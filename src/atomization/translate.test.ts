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
  it("pins the claim-anchored prompt and strict schema without a concept-level tier", () => {
    expect(PROMPT_VERSION).toBe("atomizer-v4-full-spine-one-claim-steps");
    expect(TRANSLATE_INSTRUCTIONS).toContain("You are a translator, not an author.");
    expect(TRANSLATE_INSTRUCTIONS).toContain("VERBATIM, character-for-character");
    expect(TRANSLATE_INSTRUCTIONS).toContain("specific load-bearing claim");
    expect(TRANSLATE_INSTRUCTIONS).toContain("topically related");
    expect(TRANSLATE_INSTRUCTIONS).toContain("TRIM the step's wording");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Prefer trimming the claim over attaching a weak quote");
    expect(TRANSLATE_INSTRUCTIONS).toContain("exactly ONE load-bearing claim");
    expect(TRANSLATE_INSTRUCTIONS).toContain("two different source spans");
    expect(TRANSLATE_INSTRUCTIONS).toContain("SPLIT it into two steps");
    expect(TRANSLATE_INSTRUCTIONS).toContain("each with its own verbatim grounding quote");
    expect(TRANSLATE_INSTRUCTIONS).toContain(
      "Never attach one quote to a step that makes two separate claims",
    );
    expect(TRANSLATE_INSTRUCTIONS).toContain("causal links");
    expect(TRANSLATE_INSTRUCTIONS).toContain('temporal ordering (such as "earlier")');
    expect(TRANSLATE_INSTRUCTIONS).toContain('necessity (such as "without it, X would be impossible")');
    expect(TRANSLATE_INSTRUCTIONS).toContain("PRESERVE the source's hedges");
    expect(TRANSLATE_INSTRUCTIONS).toContain("Faithfulness to the cited span beats fluency");
    expect(lessonSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["plainTitle", "steps"],
      properties: {
        steps: {
          type: "array",
          minItems: 2,
          maxItems: 4,
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
              text: "A vector is a list that keeps numbers in order.",
              stepTier: "core",
              citation: { sourceId: "s1", quotedText: QUOTES.vectors },
            },
            {
              text: "The order lets each number keep its place.",
              stepTier: "deep",
              citation: { sourceId: "s1", quotedText: "fabricated citation" },
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
  });

  it("drops an ungrounded step after one repair and restores the grounded two-step floor", async () => {
    const client = new FakeClient((schemaName) =>
      schemaName === "lesson_translation"
        ? {
            plainTitle: "Vectors",
            steps: [
              {
                text: "First attempted explanation.",
                stepTier: "core",
                citation: { sourceId: "wrong-source", quotedText: "not in the source" },
              },
              {
                text: "Second grounded explanation.",
                stepTier: "deep",
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
    expect(steps).toHaveLength(2);
    expect(steps.some(({ citation }) => citation.quotedText === "not in the source")).toBe(false);
    expect(steps[1]?.citation).toEqual(translated.concepts[0]?.provenance);
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
            stepTier: "deep",
            citation: { sourceId: "s1", quotedText: QUOTES.vectors },
          },
        ],
      }),
    ).toThrow(/unexpected field.*tier/iu);
  });
});
