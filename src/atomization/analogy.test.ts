import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import { invalidLessonCitations } from "../graph/invariants";
import { PASSION_IDS, type LearningGraph } from "../types";
import {
  ANALOGY_PROMPT_VERSION,
  ANALOGY_INSTRUCTIONS,
  analogySchema,
  generateAnalogies,
  type AnalogyClient,
} from "./analogy";
import type { JsonObject, TranslationRequestOptions } from "./translate";

const clone = (graph: LearningGraph): LearningGraph => JSON.parse(JSON.stringify(graph));

class FakeClient implements AnalogyClient {
  readonly calls: Array<{
    schemaName: string;
    input: string;
    schema: JsonObject;
    options: TranslationRequestOptions;
  }> = [];

  constructor(
    private readonly respond: (callIndex: number, input: string) => JsonObject | Error,
  ) {}

  async request(
    _instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options: TranslationRequestOptions,
  ): Promise<JsonObject> {
    this.calls.push({ schemaName, input, schema, options });
    const response = this.respond(this.calls.length - 1, input);
    if (response instanceof Error) throw response;
    return response;
  }
}

const analogyResponse = (stepCount: number, prefix = "Imagine"): JsonObject => ({
  steps: Array.from({ length: stepCount }, (_, stepIndex) =>
    Object.fromEntries(
      PASSION_IDS.map((passion) => [
        passion,
        `${prefix} ${passion} as a simple comparison for step ${stepIndex + 1}.`,
      ]),
    ),
  ),
});

describe("Phase 4b build-time analogies", () => {
  it("pins the curated passion set and strict all-passions response schema", () => {
    expect(PASSION_IDS).toEqual([
      "cooking",
      "sports",
      "music",
      "video-games",
      "cars",
      "gardening",
    ]);
    expect(ANALOGY_PROMPT_VERSION).toBe("atomizer-v2-analogies-six-passions");
    expect(ANALOGY_INSTRUCTIONS).toContain("illustration, not a fact");
    expect(analogySchema(3)).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["steps"],
      properties: {
        steps: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: [...PASSION_IDS],
          },
        },
      },
    });
  });

  it("makes exactly one strict call per concept and attaches all passions to every step", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts = graph.concepts.slice(0, 2);
    const client = new FakeClient((_callIndex, input) => {
      const stepCount = Number(/STEP_COUNT=(\d+)/u.exec(input)?.[1]);
      return analogyResponse(stepCount);
    });

    const enriched = await generateAnalogies(graph, client);

    expect(client.calls).toHaveLength(graph.concepts.length);
    for (const call of client.calls) {
      expect(call.schemaName).toBe("lesson_analogies");
      expect(call.options).toEqual({ forceStrict: true, maxOutputTokens: 3000 });
    }
    for (const concept of enriched.concepts) {
      for (const step of concept.lesson?.steps ?? []) {
        expect(Object.keys(step.analogies ?? {}).sort()).toEqual([...PASSION_IDS].sort());
      }
    }
  });

  it("omits only failed or over-30-word passions and never blocks the build", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts = graph.concepts.slice(0, 2);
    const warnings: string[] = [];
    const client = new FakeClient((callIndex, input) => {
      if (callIndex === 0) return new Error("analogy endpoint unavailable");
      const stepCount = Number(/STEP_COUNT=(\d+)/u.exec(input)?.[1]);
      const response = analogyResponse(stepCount) as { steps: Array<Record<string, string>> };
      response.steps[0]!.music = "";
      response.steps[0]!.cars = Array.from({ length: 31 }, () => "word").join(" ");
      return response;
    });

    const enriched = await generateAnalogies(graph, client, (warning) => warnings.push(warning));

    expect(enriched.concepts[0]?.lesson?.steps.every((step) => step.analogies === undefined)).toBe(
      true,
    );
    expect(enriched.concepts[1]?.lesson?.steps[0]?.analogies?.music).toBeUndefined();
    expect(enriched.concepts[1]?.lesson?.steps[0]?.analogies?.cars).toBeUndefined();
    expect(enriched.concepts[1]?.lesson?.steps[0]?.analogies?.cooking).toBeTruthy();
    expect(warnings).not.toEqual([]);
  });

  it("keeps analogies outside the machine-verifiable citation invariant", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts = graph.concepts.slice(0, 1);
    const client = new FakeClient(() => analogyResponse(2, "A deliberately invented analogy:"));

    const enriched = await generateAnalogies(graph, client);

    expect(enriched.concepts[0]?.lesson?.steps[0]?.analogies?.sports).toContain(
      "deliberately invented analogy",
    );
    expect(invalidLessonCitations(enriched)).toEqual([]);
  });
});
