import { describe, expect, it } from "vitest";
import { fixtureGraph, QUOTES } from "../graph/fixture-graph";
import { invalidRenderingCitations } from "../graph/invariants";
import type { LearningGraph } from "../types";
import {
  generateRenderings,
  type RenderingClient,
} from "./render";
import {
  renderInstructions,
  type JsonObject,
  type TranslationRequestOptions,
} from "./translate";

const clone = (graph: LearningGraph): LearningGraph => structuredClone(graph);

class FakeClient implements RenderingClient {
  readonly calls: Array<{
    instructions: string;
    input: string;
    schemaName: string;
    options: TranslationRequestOptions;
  }> = [];

  constructor(
    private readonly respond: (
      schemaName: string,
      input: string,
      callIndex: number,
    ) => JsonObject | Error,
  ) {}

  async request(
    instructions: string,
    input: string,
    _schema: JsonObject,
    schemaName: string,
    options: TranslationRequestOptions,
  ): Promise<JsonObject> {
    this.calls.push({ instructions, input, schemaName, options });
    const response = this.respond(schemaName, input, this.calls.length - 1);
    if (response instanceof Error) throw response;
    return response;
  }
}

function responseWithQuotes(...quotes: string[]): JsonObject {
  return {
    plainTitle: "A question-specific route",
    steps: quotes.map((quotedText, index) => ({
      text: `Grounded rendering step ${index + 1}.`,
      stepTier: index === 0 ? "core" : "deep",
      citation: { sourceId: "s1", quotedText },
    })),
  };
}

function oneConceptGraph(): LearningGraph {
  const graph = clone(fixtureGraph);
  graph.concepts = [graph.concepts[0]!];
  graph.edges = [];
  graph.goalId = graph.concepts[0]!.id;
  return graph;
}

describe("build-time alternate renderings", () => {
  it("keeps the grounding contract byte-identical across question formats", () => {
    const groundingContract = `2. Each step MUST include a \`citation.quotedText\` copied VERBATIM, character-for-character, from the SOURCE excerpt — a single contiguous span, no ellipses, no edits. If you cannot ground a step in a verbatim span, DROP that step.
3. Use only the given \`sourceId\`. Never invent, summarise, or paraphrase inside \`quotedText\`.`;
    const why = renderInstructions("why-it-exists");
    const how = renderInstructions("how-it-works");

    expect(why).toContain(groundingContract);
    expect(how).toContain(groundingContract);
    expect(why).toContain("US grade 8–10");
    expect(how).toContain("US grade 8–10");
    expect(why).toContain("Produce 2–4 ordered");
    expect(how).toContain("Produce 2–4 ordered");
    expect(why).toContain("why does this concept exist");
    expect(how).toContain("what actually happens, step by step");
  });

  it("attaches a grounded response for each alternate question", async () => {
    const graph = oneConceptGraph();
    const client = new FakeClient(() => responseWithQuotes(QUOTES.vectors, QUOTES.vectors));

    const set = await generateRenderings(graph, client);

    expect(set.renderings.map(({ format }) => format)).toEqual([
      "why-it-exists",
      "how-it-works",
    ]);
    expect(invalidRenderingCitations(graph, set)).toEqual([]);
    expect(client.calls).toHaveLength(2);
    for (const call of client.calls) {
      expect(call.schemaName).toMatch(/^rendering_(?:why-it-exists|how-it-works)$/u);
      expect(call.options).toEqual({ forceStrict: true, maxOutputTokens: 3000 });
      expect(call.input).toContain(fixtureGraph.sources[0]!.text);
    }
  });

  it("drops an ungrounded step while keeping the remaining grounded rendering", async () => {
    const graph = oneConceptGraph();
    const warnings: string[] = [];
    const client = new FakeClient((schemaName) =>
      schemaName === "rendering_why-it-exists"
        ? responseWithQuotes(QUOTES.vectors, "fabricated span", QUOTES["dot-product"])
        : new Error("isolate the why rendering"),
    );

    const set = await generateRenderings(graph, client, (warning) => warnings.push(warning));

    expect(set.renderings).toHaveLength(1);
    expect(set.renderings[0]?.format).toBe("why-it-exists");
    expect(set.renderings[0]?.steps.map(({ citation }) => citation.quotedText)).toEqual([
      QUOTES.vectors,
      QUOTES["dot-product"],
    ]);
    expect(warnings.some((warning) => warning.includes("dropped 1 ungrounded step"))).toBe(true);
    expect(invalidRenderingCitations(graph, set)).toEqual([]);
  });

  it("drops the whole rendering when fewer than two groundable steps remain", async () => {
    const graph = oneConceptGraph();
    const client = new FakeClient((schemaName) =>
      schemaName === "rendering_why-it-exists"
        ? responseWithQuotes(QUOTES.vectors, "fabricated span")
        : new Error("isolate the why rendering"),
    );

    const set = await generateRenderings(graph, client, () => undefined);

    expect(set).toEqual({ renderings: [] });
  });

  it("continues after a thrown request and leaves that concept untouched", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts = graph.concepts.slice(0, 2);
    graph.edges = graph.edges.slice(0, 1);
    graph.goalId = "dot-product";
    const before = clone(graph);
    const client = new FakeClient((_schemaName, input) =>
      input.includes("CONCEPT_ID=vectors")
        ? new Error("rendering endpoint unavailable")
        : responseWithQuotes(QUOTES["dot-product"], QUOTES["dot-product"]),
    );

    const set = await generateRenderings(graph, client, () => undefined);

    expect(graph).toEqual(before);
    expect(set.renderings).toHaveLength(2);
    expect(set.renderings.every(({ conceptId }) => conceptId === "dot-product")).toBe(true);
  });
});
