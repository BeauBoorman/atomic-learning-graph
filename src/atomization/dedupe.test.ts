import { afterEach, describe, expect, it, vi } from "vitest";
import type { AtomizedConcept } from "../types";
import { quoteGrounded } from "../graph/invariants";
import type { ResponsesClient } from "./client";
import { dedupeCandidates } from "./dedupe";
import { fixtureSources, northStarCandidates } from "./dedupe-fixtures";

// Ground-truth idea map for the north-star corpus: candidates sharing an idea key are the SAME
// idea and must merge; everything else must survive. The oracle stub answers BOTH model calls
// (nomination sweep -> pairs, cluster judge -> partition) from this map, so these tests pin
// OUTCOMES under a perfect model rather than clustering internals.
const IDEA_BY_TITLE: Record<string, string> = {
  "Salat: the five daily prayers": "salat",
  "Daily worship structure": "salat",
  "Ritual prayer in Islam": "salat",
  "The Lord's Prayer": "christian-prayer",
  "Christian prayer practice": "christian-prayer",
  "Zakat: obligatory almsgiving": "zakat",
  "The almsgiving obligation": "zakat",
};

function oracleClient(ideaByTitle: Record<string, string> = IDEA_BY_TITLE) {
  const request = vi
    .fn()
    .mockImplementation(async (_instructions: string, input: string, _schema, schemaName: string) => {
      const payload = JSON.parse(input.slice(input.indexOf("\n") + 1)) as Array<{
        index: number;
        title: string;
      }>;
      const groups = new Map<string, number[]>();
      for (const item of payload) {
        const idea = ideaByTitle[item.title] ?? `solo-${item.index}`;
        groups.set(idea, [...(groups.get(idea) ?? []), item.index]);
      }
      if (schemaName === "dedupe_pair_sweep") {
        const pairs: Array<{ a: number; b: number }> = [];
        for (const indices of groups.values()) {
          for (let i = 1; i < indices.length; i += 1) pairs.push({ a: indices[0], b: indices[i] });
        }
        return { pairs };
      }
      return { groups: [...groups.values()].map((indices) => ({ indices, reason: "fixture oracle" })) };
    });
  return { request, client: { request } as unknown as ResponsesClient };
}

function silence() {
  return {
    warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
    log: vi.spyOn(console, "log").mockImplementation(() => undefined),
  };
}

afterEach(() => vi.restoreAllMocks());

function titles(concepts: AtomizedConcept[]): string[] {
  return concepts.map((concept) => concept.title);
}

function makeConcept(overrides: {
  id: string;
  title: string;
  summary: string;
  sourceId: string;
  quotedText: string;
  tags?: string[];
}): AtomizedConcept {
  return {
    id: overrides.id,
    title: overrides.title,
    summary: overrides.summary,
    provenance: { sourceId: overrides.sourceId, quotedText: overrides.quotedText },
    tags: overrides.tags ?? [],
    prerequisites: [],
    related: [],
  };
}

describe("dedupeCandidates on the world-religions north star", () => {
  it("merges same-idea candidates while doctrine pairs remain instructed, guarded, and regression-tested", async () => {
    silence();
    const { client } = oracleClient();
    const merged = await dedupeCandidates(northStarCandidates, client);

    // 14 candidates, three merge groups (3 salat, 2 christian prayer, 2 zakat) -> 10 concepts.
    expect(merged).toHaveLength(10);

    const salatSurvivors = merged.filter((c) => IDEA_BY_TITLE[c.title] === "salat");
    expect(salatSurvivors).toHaveLength(1);
    expect(merged.filter((c) => IDEA_BY_TITLE[c.title] === "christian-prayer")).toHaveLength(1);
    expect(merged.filter((c) => IDEA_BY_TITLE[c.title] === "zakat")).toHaveLength(1);

    // Doctrine pairs and comparative concepts ALL survive as distinct concepts.
    for (const title of [
      "Ramadan fasting (sawm)",
      "Lenten fasting",
      "Tawhid: the oneness of God",
      "The Trinity",
      "Shared monotheism, divergent theology",
      "Fasting across faiths",
      "Communion",
    ]) {
      expect(titles(merged)).toContain(title);
    }

    // The cross-source salat merge keeps both sources' grounding: survivor quote + evidence.
    const salat = salatSurvivors[0];
    const evidenceSources = new Set([
      salat.provenance.sourceId,
      ...(salat.mergedEvidence ?? []).map((e) => e.sourceId),
    ]);
    expect(evidenceSources).toEqual(new Set(["intro-islam", "comparative-religion"]));
  });

  it("keeps every surviving quote verbatim-grounded and every relation array empty", async () => {
    silence();
    const merged = await dedupeCandidates(northStarCandidates, oracleClient().client);
    for (const concept of merged) {
      expect(
        quoteGrounded(fixtureSources, concept.provenance.sourceId, concept.provenance.quotedText),
      ).toBe(true);
      expect(concept.prerequisites).toEqual([]);
      expect(concept.related).toEqual([]);
      for (const evidence of concept.mergedEvidence ?? []) {
        expect(quoteGrounded(fixtureSources, evidence.sourceId, evidence.quotedText)).toBe(true);
      }
    }
    const ids = merged.map((concept) => concept.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic: identical input and model answers yield identical output", async () => {
    silence();
    const first = await dedupeCandidates(northStarCandidates, oracleClient().client);
    const second = await dedupeCandidates(northStarCandidates, oracleClient().client);
    expect(second).toEqual(first);
  });

  it("merges the sweep-dependent salat pair even with no tags and a terse summary", async () => {
    const { log } = silence();
    // Adversarially-found case: with tags stripped and a short summary, string nomination misses
    // this pair; only the model sweep can nominate it. Under the oracle it must merge.
    const bare = [
      { ...northStarCandidates[0] },
      makeConcept({
        id: "islamic-worship-hours",
        title: "Ritual prayer in Islam",
        summary: "One of the Five Pillars of the faith.",
        sourceId: "comparative-religion",
        quotedText:
          "In Islam the ritual prayer, known as salat, is performed five times daily at prescribed hours and is one of the Five Pillars.",
      }),
    ];
    const merged = await dedupeCandidates(bare, oracleClient().client);
    expect(merged).toHaveLength(1);
    const proposalLog = log.mock.calls.flat().join("\n");
    expect(proposalLog).toContain("fixture oracle");
    expect(proposalLog).toContain(bare[0].id);
    expect(proposalLog).toContain(bare[1].id);
  });
});

describe("doctrine collapse regressions (adversarially found, deterministic path)", () => {
  // Every case here previously auto-merged deterministically in the v1 design. With no client
  // NOTHING may merge; with a truthful judge they must stay separate.
  const doctrineSource = {
    id: "theology-survey",
    text:
      "The Mu'tazila school taught that the Quran was created in time by God's will and power. " +
      "The Athari school taught that the Quran was not created but is God's eternal speech. " +
      "Libertarians hold that free will lets humans genuinely choose among open alternatives. " +
      "Hard determinists hold there is no free will because every act follows from prior causes.",
  };
  const cases: [AtomizedConcept, AtomizedConcept][] = [
    [
      makeConcept({
        id: "created-quran",
        title: "The Created Quran",
        summary: "Mu'tazila doctrine that the Quran was created in time.",
        sourceId: "theology-survey",
        quotedText: "The Mu'tazila school taught that the Quran was created in time by God's will and power.",
      }),
      makeConcept({
        id: "quran-not-created",
        title: "The Quran Not Created",
        summary: "Athari doctrine that the Quran is God's eternal, uncreated speech.",
        sourceId: "theology-survey",
        quotedText: "The Athari school taught that the Quran was not created but is God's eternal speech.",
      }),
    ],
    [
      makeConcept({
        id: "free-will",
        title: "Free Will",
        summary: "Libertarian view that humans genuinely choose among open alternatives.",
        sourceId: "theology-survey",
        quotedText: "Libertarians hold that free will lets humans genuinely choose among open alternatives.",
      }),
      makeConcept({
        id: "no-free-will",
        title: "No Free Will",
        summary: "Hard determinist view that every act follows from prior causes.",
        sourceId: "theology-survey",
        quotedText: "Hard determinists hold there is no free will because every act follows from prior causes.",
      }),
    ],
  ];

  it("does not merge doctrine pairs without a client (no deterministic merge path exists)", async () => {
    const { warn } = silence();
    for (const pair of cases) {
      const merged = await dedupeCandidates([...pair]);
      expect(merged).toHaveLength(2);
    }
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no model client/i));
  });

  it("keeps doctrine pairs separate when the judge says they differ", async () => {
    silence();
    for (const pair of cases) {
      const merged = await dedupeCandidates([...pair], oracleClient({}).client);
      expect(merged).toHaveLength(2);
    }
    expect(doctrineSource.id).toBe("theology-survey");
  });

  it("refuses a cross-source doctrine merge proposed by a lying judge", async () => {
    const { warn, log } = silence();
    const pair = [northStarCandidates[2], northStarCandidates[7]];
    const request = vi.fn().mockImplementation(
      async (_instructions: string, _input: string, _schema, schemaName: string) =>
        schemaName === "dedupe_pair_sweep"
          ? { pairs: [{ a: 0, b: 1 }] }
          : { groups: [{ indices: [0, 1], reason: "both are fasting" }] },
    );

    const merged = await dedupeCandidates(
      pair,
      { request } as unknown as ResponsesClient,
    );

    expect(merged).toHaveLength(2);
    expect(titles(merged)).toEqual(titles(pair));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/cross-source merge guard/i));
    const proposalLog = log.mock.calls.flat().join("\n");
    expect(proposalLog).toContain("both are fasting");
    expect(proposalLog).toContain(pair[0].id);
    expect(proposalLog).toContain(pair[1].id);
  });

  it("refuses a SAME-source doctrine merge proposed by a lying judge", async () => {
    // A combined-religions chapter is one source holding both doctrines; same-source is NOT safe.
    const { warn } = silence();
    const prayerIslam = makeConcept({
      id: "prayer-in-islam",
      title: "Prayer in Islam",
      summary: "Muslims perform salat five times daily facing Mecca.",
      sourceId: "world-religions",
      quotedText: "Muslims perform the ritual prayer of salat five times each day while facing Mecca.",
      tags: ["islam", "prayer"],
    });
    const prayerChristianity = makeConcept({
      id: "prayer-in-christianity",
      title: "Prayer in Christianity",
      summary: "Christians pray following the model Jesus taught.",
      sourceId: "world-religions",
      quotedText: "Christians pray to God following the words that Jesus taught in the Lord's Prayer.",
      tags: ["christianity", "prayer"],
    });
    const request = vi.fn().mockImplementation(
      async (_instructions: string, _input: string, _schema, schemaName: string) =>
        schemaName === "dedupe_pair_sweep"
          ? { pairs: [{ a: 0, b: 1 }] }
          : { groups: [{ indices: [0, 1], reason: "both are prayer" }] },
    );

    const merged = await dedupeCandidates(
      [prayerIslam, prayerChristianity],
      { request } as unknown as ResponsesClient,
    );

    expect(merged).toHaveLength(2);
    expect(titles(merged)).toEqual(["Prayer in Islam", "Prayer in Christianity"]);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/same-source merge guard/i));
  });
});

describe("degraded and adversarial model behavior", () => {
  it("without a client, merges nothing and warns about unjudged clusters", async () => {
    const { warn } = silence();
    const merged = await dedupeCandidates(northStarCandidates);
    expect(merged).toHaveLength(northStarCandidates.length);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no model client/i));
  });

  it("sweep nominations alone never merge: the judge must also group the pair", async () => {
    silence();
    const request = vi
      .fn()
      .mockImplementation(async (_i: string, input: string, _s, schemaName: string) => {
        const payload = JSON.parse(input.slice(input.indexOf("\n") + 1)) as Array<{ index: number }>;
        if (schemaName === "dedupe_pair_sweep") {
          // Sweep (wrongly) flags everything as a possible duplicate of everything.
          const pairs: Array<{ a: number; b: number }> = [];
          for (let i = 1; i < payload.length; i += 1) pairs.push({ a: 0, b: i });
          return { pairs };
        }
        // Judge: all singletons — nothing is actually the same idea.
        return { groups: payload.map((item) => ({ indices: [item.index], reason: "distinct" })) };
      });
    const merged = await dedupeCandidates(
      northStarCandidates,
      { request } as unknown as ResponsesClient,
    );
    expect(merged).toHaveLength(northStarCandidates.length);
  });

  it("degrades to string nomination when the sweep is malformed, and still merges judged clusters", async () => {
    const { warn } = silence();
    const request = vi
      .fn()
      .mockImplementation(async (_i: string, input: string, _s, schemaName: string) => {
        if (schemaName === "dedupe_pair_sweep") return { nonsense: true };
        const payload = JSON.parse(input.slice(input.indexOf("\n") + 1)) as Array<{
          index: number;
          title: string;
        }>;
        const groups = new Map<string, number[]>();
        for (const item of payload) {
          const idea = IDEA_BY_TITLE[item.title] ?? `solo-${item.index}`;
          groups.set(idea, [...(groups.get(idea) ?? []), item.index]);
        }
        return { groups: [...groups.values()].map((indices) => ({ indices, reason: "oracle" })) };
      });
    const merged = await dedupeCandidates(
      northStarCandidates,
      { request } as unknown as ResponsesClient,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/sweep returned no pair array/i));
    // String nomination still clusters the fixture pairs, so the judge still merges them.
    expect(merged.length).toBeLessThan(northStarCandidates.length);
  });

  it("treats a non-partition judge answer as malformed and leaves the window unmerged", async () => {
    const { warn } = silence();
    const request = vi
      .fn()
      .mockImplementation(async (_i: string, _input: string, _s, schemaName: string) => {
        if (schemaName === "dedupe_pair_sweep") return { pairs: [] };
        return { groups: [{ indices: [0], reason: "dropped the rest" }] };
      });
    const merged = await dedupeCandidates(
      northStarCandidates,
      { request } as unknown as ResponsesClient,
    );
    expect(merged).toHaveLength(northStarCandidates.length);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/malformed partition/i));
  });

  it("survives throwing sweep and judge calls: warns, merges nothing, completes the run", async () => {
    const { warn } = silence();
    const request = vi.fn().mockRejectedValue(new Error("api down"));
    const merged = await dedupeCandidates(
      northStarCandidates,
      { request } as unknown as ResponsesClient,
    );
    expect(merged).toHaveLength(northStarCandidates.length);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/sweep call failed/i));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/judge call failed/i));
  });

  it("rejects out-of-range and duplicated judge indices", async () => {
    const { warn } = silence();
    const request = vi
      .fn()
      .mockImplementation(async (_i: string, _input: string, _s, schemaName: string) => {
        if (schemaName === "dedupe_pair_sweep") return { pairs: [] };
        return { groups: [{ indices: [0, 0, 99], reason: "nonsense" }] };
      });
    const merged = await dedupeCandidates(
      northStarCandidates,
      { request } as unknown as ResponsesClient,
    );
    expect(merged).toHaveLength(northStarCandidates.length);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/malformed partition/i));
  });

  it("passes through empty and single-concept inputs untouched", async () => {
    await expect(dedupeCandidates([])).resolves.toEqual([]);
    const single = northStarCandidates.slice(0, 1);
    await expect(dedupeCandidates(single)).resolves.toEqual(single);
  });

  it("suffixes duplicate input ids instead of emitting duplicate output ids", async () => {
    const { warn } = silence();
    const clash = [
      { ...northStarCandidates[3], id: "same-id" }, // tawhid
      { ...northStarCandidates[8], id: "same-id" }, // trinity
    ];
    const merged = await dedupeCandidates(clash);
    expect(new Set(merged.map((concept) => concept.id)).size).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/duplicate input id/i));
  });

  it("reserves existing suffixes while repairing duplicate input ids", async () => {
    const { warn } = silence();
    const clash = [
      { ...northStarCandidates[3], id: "x" },
      { ...northStarCandidates[8], id: "x-2" },
      { ...northStarCandidates[9], id: "x" },
    ];

    const merged = await dedupeCandidates(clash);
    expect(merged.map(({ id }) => id)).toEqual(["x", "x-2", "x-3"]);
    expect(new Set(merged.map(({ id }) => id)).size).toBe(3);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/duplicate input id/i));
  });

  it("uses pair-covering windows so distant true duplicates in a large cluster still meet", async () => {
    silence();
    const sharedQuote =
      "A shared source paragraph contains enough grounded words to nominate every candidate for review.";
    const candidates = [
      "Axiom form",
      ...Array.from({ length: 11 }, (_, index) => `Middle ${String(index + 1).padStart(2, "0")}`),
      "Zeta restatement",
    ].map((title, index) => makeConcept({
      id: `candidate-${index}`,
      title,
      summary: index === 0 || index === 12
        ? "The same vector norm definition."
        : `Distinct concept ${index}.`,
      sourceId: "one-source",
      quotedText: sharedQuote,
    }));
    const request = vi.fn().mockImplementation(
      async (_instructions: string, input: string, _schema, schemaName: string) => {
        if (schemaName === "dedupe_pair_sweep") return { pairs: [] };
        const payload = JSON.parse(input.slice(input.indexOf("\n") + 1)) as Array<{
          index: number;
          summary: string;
        }>;
        const duplicateIndices = payload
          .filter(({ summary }) => summary === "The same vector norm definition.")
          .map(({ index }) => index);
        const duplicateSet = new Set(duplicateIndices);
        const groups = [
          ...(duplicateIndices.length > 0 ? [{ indices: duplicateIndices, reason: "same definition" }] : []),
          ...payload
            .filter(({ index }) => !duplicateSet.has(index))
            .map(({ index }) => ({ indices: [index], reason: "distinct" })),
        ];
        return { groups };
      },
    );

    const merged = await dedupeCandidates(
      candidates,
      { request } as unknown as ResponsesClient,
    );
    expect(merged.filter(({ summary }) => summary === "The same vector norm definition.")).toHaveLength(1);
  });
});

describe("fixture integrity", () => {
  it("every fixture candidate is grounded in its source (guards fixture drift)", () => {
    for (const concept of northStarCandidates) {
      expect(
        quoteGrounded(fixtureSources, concept.provenance.sourceId, concept.provenance.quotedText),
      ).toBe(true);
    }
  });
});
