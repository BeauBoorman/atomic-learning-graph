import { describe, expect, it } from "vitest";
import { convergenceIssues } from "../atomization/repair";
import type { JsonObject, TranslationRequestOptions } from "../atomization/translate";
import type { Concept, LearningGraph } from "../types";
import {
  reportAtomicityWarnings,
  reportAtomicityWarningsWithScorer,
  syntacticAtomicityScorer,
} from "./atomicity-report";
import {
  llmJudgeAtomicityScorer,
  type AtomicityJudgeClient,
} from "./atomicity-scorer-llm";
import { fixtureGraph } from "./fixture-graph";

const clone = (graph: LearningGraph): LearningGraph => structuredClone(graph);

const conceptWithSummary = (summary: string): Concept => ({
  ...structuredClone(fixtureGraph.concepts[0]!),
  summary,
});

class FakeClient implements AtomicityJudgeClient {
  readonly calls: Array<{
    instructions: string;
    input: string;
    schema: JsonObject;
    schemaName: string;
    options: Partial<TranslationRequestOptions>;
  }> = [];

  constructor(
    private readonly respond: (input: string) => JsonObject | Error | Promise<JsonObject>,
  ) {}

  async request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options: Partial<TranslationRequestOptions> = {},
  ): Promise<JsonObject> {
    this.calls.push({ instructions, input, schema, schemaName, options });
    const response = await this.respond(input);
    if (response instanceof Error) throw response;
    return response;
  }
}

describe("build-time GPT-5.6 atomicity judge", () => {
  it("flags the semantic KNOWN-LIMIT that the syntactic scorer cannot catch", async () => {
    // Linked to invariants.test.ts's intentionally skipped KNOWN-LIMIT case: the syntactic
    // enumeration detector passes this uncoordinated bundle, while the richer judge can flag it.
    const summary = "Scaled dot-product attention computes a weighted average.";
    const concept = conceptWithSummary(summary);
    const client = new FakeClient(() => ({
      atomic: false,
      confidence: 0.97,
      signals: ["bundled-operations"],
    }));

    expect(syntacticAtomicityScorer.score(concept).atomic).toBe(true);
    await expect(llmJudgeAtomicityScorer(client).score(concept)).resolves.toEqual({
      atomic: false,
      confidence: 0.97,
      signals: ["bundled-operations"],
    });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({
      schemaName: "atomicity_judge",
      options: { forceStrict: true },
    });
    expect(client.calls[0]?.input).toContain(summary);
    expect(client.calls[0]?.schema).toMatchObject({
      type: "object",
      required: ["atomic", "confidence", "signals"],
      additionalProperties: false,
    });
  });

  it("passes a clean single idea returned by the fake judge", async () => {
    const client = new FakeClient(() => ({
      atomic: true,
      confidence: 0.93,
      signals: ["single-idea"],
    }));

    await expect(
      llmJudgeAtomicityScorer(client).score(
        conceptWithSummary("Softmax turns a vector of scores into a probability distribution."),
      ),
    ).resolves.toEqual({
      atomic: true,
      confidence: 0.93,
      signals: ["single-idea"],
    });
  });

  it("never throws when the client throws and returns the fail-open advisory result", async () => {
    const client = new FakeClient(() => new Error("network unavailable"));

    await expect(
      llmJudgeAtomicityScorer(client).score(conceptWithSummary("One idea.")),
    ).resolves.toEqual({ atomic: true, confidence: 0, signals: [] });
  });

  it("fails open when the strict response is malformed", async () => {
    const client = new FakeClient(() => ({
      atomic: "probably",
      confidence: 2,
      signals: ["invented-signal"],
    }));

    await expect(
      llmJudgeAtomicityScorer(client).score(conceptWithSummary("One idea.")),
    ).resolves.toEqual({ atomic: true, confidence: 0, signals: [] });
  });

  it("fails open on a timed-out request", async () => {
    const client = new FakeClient(() => new Promise<JsonObject>(() => undefined));

    await expect(
      llmJudgeAtomicityScorer(client, { timeoutMs: 5 }).score(conceptWithSummary("One idea.")),
    ).resolves.toEqual({ atomic: true, confidence: 0, signals: [] });
  });

  it("is selectable only through the advisory channel and cannot change convergence", async () => {
    const graph = clone(fixtureGraph);
    graph.concepts[0]!.summary =
      "Scaled dot-product attention computes a weighted average.";
    const client = new FakeClient((input) =>
      input.includes(graph.concepts[0]!.summary)
        ? { atomic: false, confidence: 0.97, signals: ["bundled-operations"] }
        : { atomic: true, confidence: 0.9, signals: ["single-idea"] },
    );
    const before = convergenceIssues(graph, { minConcepts: 5 });

    expect(before).toEqual([]);
    expect(reportAtomicityWarnings(graph)).toEqual([]);
    const warnings = await reportAtomicityWarningsWithScorer(
      graph,
      llmJudgeAtomicityScorer(client),
    );

    expect(warnings).toMatchObject([
      {
        conceptId: graph.concepts[0]!.id,
        summary: graph.concepts[0]!.summary,
        signal: "bundled-operations",
        confidence: "high",
      },
    ]);
    expect(convergenceIssues(graph, { minConcepts: 5 })).toEqual(before);
  });
});
