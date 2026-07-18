import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureGraph, QUOTES } from "../graph/fixture-graph";
import { invalidRenderingCitations } from "../graph/invariants";
import type { LearningGraph } from "../types";
import {
  RENDERING_PROMPT_VERSION,
  generateAndWriteRenderings,
  generateRenderings,
  main,
  parseRenderArgs,
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
  it("rejects the removed --dry flag before any paid client can be initialized", async () => {
    await expect(main(["--dry"])).rejects.toThrow(/unknown option.*--dry/iu);
  });

  it("keeps response IDs by default and accepts only the explicit omission flag", () => {
    expect(parseRenderArgs([])).toEqual({ omitResponseIds: false });
    expect(parseRenderArgs(["--no-response-ids"])).toEqual({ omitResponseIds: true });
    expect(() => parseRenderArgs(["--omit-ids"])).toThrow(/unknown option/iu);
  });

  it("keeps the grounding contract byte-identical across question formats", () => {
    const groundingContract = `2. Each step MUST include a \`citation.quotedText\` copied VERBATIM, character-for-character, from the SOURCE excerpt — a single contiguous span, no ellipses, no edits. The quoted span MUST contain the specific load-bearing claim made by the step; a span that is merely topically related but does not state that claim is a FAILURE. If the step's claim is not fully supported inside one contiguous span, TRIM the step's wording to exactly what the span supports (prefer trimming over attaching a weak quote). If you cannot ground a step in a verbatim span, DROP that step.
3. Do NOT add qualifications, causal links, temporal ordering (such as "earlier"), or necessity (such as "without it, X would be impossible") that the cited span does not state. PRESERVE the source's hedges, including words such as "often", "typically", "roughly", and "intuition". Faithfulness to the cited span beats fluency. Use only the given \`sourceId\`. Never invent, summarise, or paraphrase inside \`quotedText\`.`;
    const why = renderInstructions("why-it-exists");
    const how = renderInstructions("how-it-works");

    expect(why).toContain(groundingContract);
    expect(how).toContain(groundingContract);
    expect(why).toContain("US grade 8–10");
    expect(how).toContain("US grade 8–10");
    expect(why).toContain("Produce 2–4 ordered");
    expect(how).toContain("Produce 2–4 ordered");
    for (const prompt of [why, how]) {
      expect(prompt).toContain("exactly ONE load-bearing claim");
      expect(prompt).toContain("two different source spans");
      expect(prompt).toContain("SPLIT it into two steps");
      expect(prompt).toContain("each with its own verbatim grounding quote");
      expect(prompt).toContain("Never attach one quote to a step that makes two separate claims");
    }
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

  it("spends exactly one 2xN request set for the artifact whose verdict it prints", async () => {
    const graph = oneConceptGraph();
    const client = new FakeClient(() => responseWithQuotes(QUOTES.vectors, QUOTES.vectors));
    const directory = mkdtempSync(join(tmpdir(), "atomic-renderings-"));
    const renderingsPath = join(directory, "renderings.json");
    const runLogPath = join(directory, "renderings.run.json");
    const output: string[] = [];

    try {
      const set = await generateAndWriteRenderings(
        graph,
        client,
        {
          model: "fake-model",
          strictStructuredOutputs: true,
          responseIds: ["fake-response-1", "fake-response-2"],
        },
        { renderings: renderingsPath, runLog: runLogPath },
        () => undefined,
        (message) => output.push(message),
      );

      expect(client.calls).toHaveLength(2 * graph.concepts.length);
      const landedBytes = readFileSync(renderingsPath);
      const landed = JSON.parse(landedBytes.toString("utf8"));
      expect(landed).toEqual(set);
      expect(output).toEqual([
        "CONCEPT\tFORMAT\tRESULT",
        "vectors\twhy-it-exists\tPASS",
        "vectors\thow-it-works\tPASS",
        "RENDERING PASS: wrote 2 alternate renderings.",
      ]);
      expect(JSON.parse(readFileSync(runLogPath, "utf8"))).toMatchObject({
        model: "fake-model",
        renderingsSha256: createHash("sha256").update(landedBytes).digest("hex"),
        responseIds: ["fake-response-1", "fake-response-2"],
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("omits responseIds from the rendering run log without dropping other metadata", async () => {
    const graph = oneConceptGraph();
    const client = new FakeClient(() => responseWithQuotes(QUOTES.vectors, QUOTES.vectors));
    const directory = mkdtempSync(join(tmpdir(), "atomic-renderings-private-"));
    const renderingsPath = join(directory, "renderings.json");
    const runLogPath = join(directory, "renderings.run.json");

    try {
      await generateAndWriteRenderings(
        graph,
        client,
        {
          model: "fake-model",
          strictStructuredOutputs: true,
          responseIds: ["fake-response-1", "fake-response-2"],
          omitResponseIds: true,
        },
        { renderings: renderingsPath, runLog: runLogPath },
        () => undefined,
        () => undefined,
      );

      const run = JSON.parse(readFileSync(runLogPath, "utf8")) as Record<string, unknown>;
      expect(run).toMatchObject({
        model: "fake-model",
        renderingPromptVersion: "renderings-v2-one-claim-per-step",
        strictStructuredOutputs: true,
      });
      expect(run).toHaveProperty("renderingsSha256");
      expect(run).not.toHaveProperty("responseIds");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("versions the strengthened one-claim-per-step rendering contract", () => {
    expect(RENDERING_PROMPT_VERSION).toBe("renderings-v2-one-claim-per-step");
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
