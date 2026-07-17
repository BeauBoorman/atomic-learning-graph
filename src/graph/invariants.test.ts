// Graph invariants — written FIRST (TDD). These FAIL until Codex implements
// `./invariants` and the atomizer produces a valid `data/graph.json`.
//
// Capturing the RED -> GREEN transition (terminal output) is on-camera proof that
// GPT-5.6/Codex did non-trivial *structural* work, not just glue. Keep these green.
//
// ⚠ HALF OF THIS FILE IS ADVERSARIAL, AND THAT IS THE POINT.
// The 5-node fixture is a clean, fully-connected chain: on it, `findOrphans = () => []`,
// `danglingEdges = () => []`, `invalidProvenance = () => []`, `hasCycle = () => false`,
// `pathExists = () => true` and `isSingleConcept = () => true` pass EVERY positive assertion. A
// suite that only asserts the happy path is UNFALSIFIABLE — it would go green against six
// functions that do nothing, and the demo would be a lie with a passing test suite. Each negative
// test below names the exact cheat it kills. If an implementation fails one of these, fix the
// IMPLEMENTATION. Deleting or weakening a negative test deletes the invariant it defends.
//
// Codex: implement the functions imported below in `src/graph/invariants.ts`, then
// make the real-graph suite pass by producing `data/graph.json` via `pnpm atomize`.

import { describe, it, expect } from "vitest";
import type { LearningGraph, Concept, RenderingSet } from "../types";
import {
  hasCycle,
  findOrphans,
  danglingEdges,
  pathExists,
  invalidProvenance,
  invalidLessonCitations,
  invalidRenderingCitations,
  quoteGrounded,
  isSingleConcept,
} from "./invariants";
import { loadGraph, loadRenderingsForVerification } from "./load"; // Codex: reads committed build artifacts
import { fixtureGraph, SOURCE_TEXT } from "./fixture-graph";

// The hand-built fixture lives in `./fixture-graph` — it is a FIXTURE, never `data/graph.json`
// (ADR 001, rule 3). Its whitespace trap (a newline mid-sentence, quoted with a space) forces the
// provenance implementation to normalize whitespace instead of using a byte-exact `includes()`.
const fixture = fixtureGraph;

/** A concept with the given summary, for the single-concept tests. */
const withSummary = (summary: string): Concept => ({ ...fixture.concepts[0], summary });

describe("invariant functions (fixture)", () => {
  // ADVISORY reporter (not a proof gate): every clean fixture summary reads as a single concept.
  it("advisory: every clean fixture summary reads as a single concept", () => {
    for (const c of fixture.concepts) expect(isSingleConcept(c)).toBe(true);
  });

  it("2. no orphan nodes (roots exempt)", () => {
    expect(findOrphans(fixture)).toEqual([]);
  });

  it("3. prerequisite graph is a DAG (no cycles)", () => {
    expect(hasCycle(fixture)).toBe(false);
  });

  it("4. the golden goal is reachable from a root", () => {
    expect(pathExists(fixture, fixture.goalId)).toBe(true);
  });

  it("5. all provenance is valid (every quote really occurs in its source)", () => {
    expect(invalidProvenance(fixture)).toEqual([]);
  });

  it("6. no dangling edges", () => {
    expect(danglingEdges(fixture)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// ADVERSARIAL — each test names the cheating implementation it exists to kill.
// ---------------------------------------------------------------------------------------------

describe("isSingleConcept — teeth", () => {
  // KILLS: `() => true`. Every fixture summary is "single concept: X", so without a negative case
  // the invariant is unfalsifiable and proves nothing.
  it("catches a summary coordinated with 'and'", () => {
    expect(isSingleConcept(withSummary("vectors and matrices"))).toBe(false);
  });

  // KILLS: `!summary.includes(" and ")` — the substring ban. These bundle two concepts with NO
  // occurrence of the word "and", so a ban on " and " passes them and the invariant is still fake.
  it("catches a COMMA-enumerated summary (no 'and' anywhere)", () => {
    expect(isSingleConcept(withSummary("matrix multiplication, normalization"))).toBe(false);
  });

  it("catches a SEMICOLON-enumerated summary (no 'and' anywhere)", () => {
    expect(isSingleConcept(withSummary("dot products; softmax"))).toBe(false);
  });

  it("catches an AMPERSAND-coordinated summary (no 'and' anywhere)", () => {
    expect(isSingleConcept(withSummary("queries & keys"))).toBe(false);
  });

  // KILLS: `() => false`, and any check so blunt it rejects legitimate single concepts. A summary
  // is allowed to be a full sentence, to contain a comma inside a subordinate clause, and to name
  // a concept whose NAME happens to contain "and". Over-rejection is not safety: it would force the
  // atomizer to be "fixed" until it emits telegraphic summaries.
  it("does NOT reject a legitimate one-concept summary that contains a comma", () => {
    expect(
      isSingleConcept(withSummary("Softmax, applied to a vector of scores, yields a distribution."))
    ).toBe(true);
  });

  it("does NOT reject a one-concept summary whose subject contains the letters 'and'", () => {
    expect(isSingleConcept(withSummary("A random variable is a numeric outcome."))).toBe(true);
  });

  // ⚠ KNOWN LIMIT — SKIPPED ON PURPOSE, NOT FORGOTTEN. This summary bundles several concepts
  // (scaling, the dot product, softmax normalization, a weighted average) in ONE un-coordinated
  // noun phrase. No syntactic rule catches it; only semantic judgment does, and the invariant suite
  // must stay deterministic and offline (no LLM call at test time). This is the honest hole in
  // `isSingleConcept`, and it is exactly why the check was DEMOTED (2026-07-15) to an advisory
  // enumeration reporter rather than a proof gate: an enumeration detector is a real check, but it
  // is NOT proof of atomicity and must never be presented as such. This known limit is what
  // motivates the future embedding/LLM-judge scorer (see ROADMAP.md).
  // -> Do not un-skip this test by weakening it; un-skip it only if a real, defensible definition of
  //    "one concept" is found — which is what the future scorer is for.
  it.skip("KNOWN LIMIT: cannot catch a multi-concept summary with no coordination", () => {
    expect(
      isSingleConcept(withSummary("Scaled dot-product attention computes a weighted average."))
    ).toBe(false);
  });
});

describe("findOrphans — teeth", () => {
  // KILLS: `() => []`. `trivia` has TWO edges, so it is not isolated in the raw edge list — but
  // neither edge is a `prereq` edge, so no prerequisite walk can ever reach it and it can never
  // appear on any learner's path. It is dead weight the atomizer emitted without inferring a single
  // learning relationship. ALSO KILLS: an implementation that counts all edge types.
  it("catches a node with ONLY related/method edges (no prereq in or out)", () => {
    const withTrivia: LearningGraph = {
      ...fixture,
      concepts: [
        ...fixture.concepts,
        {
          id: "trivia",
          title: "trivia",
          summary: "single concept: trivia",
          provenance: { sourceId: "s1", quotedText: "A vector is an ordered list of numbers." },
          tags: ["llm"],
        },
      ],
      edges: [
        ...fixture.edges,
        { from: "trivia", to: "softmax", type: "related" },
        { from: "self-attention", to: "trivia", type: "method" },
      ],
    };
    expect(findOrphans(withTrivia)).toEqual(["trivia"]);
  });

  // KILLS: `orphan = inbound === 0` (the naive reading), which would flag the root `vectors`, and
  // `orphan = outbound === 0`, which would flag the goal. Both are legal. Covered by the fixture
  // test above too, but stated explicitly so the intent survives a refactor.
  it("does NOT flag the root or the goal (they are legal, see the definition)", () => {
    const orphans = findOrphans(fixture);
    expect(orphans).not.toContain("vectors");
    expect(orphans).not.toContain("self-attention");
  });
});

describe("danglingEdges — teeth", () => {
  // KILLS: `() => []`, and an implementation that only checks `from` (or only `to`), and one that
  // only checks `prereq` edges. All three broken edges must come back.
  it("catches a bad `from`, a bad `to`, AND a dangling non-prereq edge", () => {
    const broken: LearningGraph = {
      ...fixture,
      edges: [
        ...fixture.edges,
        { from: "ghost", to: "softmax", type: "prereq" }, // `from` resolves to nothing
        { from: "softmax", to: "phantom", type: "prereq" }, // `to` resolves to nothing
        { from: "vectors", to: "nowhere", type: "related" }, // referential integrity is all types
      ],
    };
    const dangling = danglingEdges(broken);
    expect(dangling).toHaveLength(3);
    expect(dangling).toEqual(
      expect.arrayContaining([
        { from: "ghost", to: "softmax", type: "prereq" },
        { from: "softmax", to: "phantom", type: "prereq" },
        { from: "vectors", to: "nowhere", type: "related" },
      ])
    );
  });
});

describe("hasCycle — teeth", () => {
  it("catches a cycle when one is introduced", () => {
    const cyclic: LearningGraph = {
      ...fixture,
      edges: [...fixture.edges, { from: "self-attention", to: "vectors", type: "prereq" }],
    };
    expect(hasCycle(cyclic)).toBe(true);
  });

  // KILLS: a DFS that marks visited but never tracks the recursion stack, and any check that only
  // looks for cycles of length >= 2.
  it("catches a self-loop (x is its own prerequisite)", () => {
    const selfLoop: LearningGraph = {
      ...fixture,
      edges: [...fixture.edges, { from: "softmax", to: "softmax", type: "prereq" }],
    };
    expect(hasCycle(selfLoop)).toBe(true);
  });

  // KILLS: an implementation that walks EVERY edge type. `related` is a symmetric UI affordance and
  // will routinely appear in both directions on a real graph — reporting that as a cycle is a false
  // failure on a perfectly good graph, and the reflex "fix" is to weaken the invariant.
  it("does NOT report a cycle among `related` edges (only prereq edges are learning order)", () => {
    const relatedLoop: LearningGraph = {
      ...fixture,
      edges: [
        ...fixture.edges,
        { from: "vectors", to: "self-attention", type: "related" },
        { from: "self-attention", to: "vectors", type: "related" },
      ],
    };
    expect(hasCycle(relatedLoop)).toBe(false);
  });
});

describe("pathExists — teeth", () => {
  // KILLS: `(g, t) => g.concepts.some(c => c.id === t)` — "does a concept with this id exist",
  // which passes every happy-path assertion in this file.
  it("is FALSE for an isolated concept (no prereq edges either way)", () => {
    const withIsland: LearningGraph = {
      ...fixture,
      concepts: [
        ...fixture.concepts,
        {
          id: "island",
          title: "island",
          summary: "single concept: island",
          provenance: { sourceId: "s1", quotedText: "A vector is an ordered list of numbers." },
          tags: ["llm"],
        },
      ],
    };
    expect(pathExists(withIsland, "island")).toBe(false);
  });

  it("is FALSE for a target that is not in the graph at all", () => {
    expect(pathExists(fixture, "does-not-exist")).toBe(false);
  });

  // KILLS: `t => inboundPrereqEdges(t).length > 0`. `b` has an inbound prereq edge — but it comes
  // from inside a 2-cycle, so the component has NO root and nothing in it can ever be learned from
  // scratch. Reachable-from-a-root is the property; having a parent is not.
  it("is FALSE when every chain into the target starts inside a cycle (no root)", () => {
    const rootless: LearningGraph = {
      ...fixture,
      concepts: [
        ...fixture.concepts,
        ...["a", "b"].map(
          (id): Concept => ({
            id,
            title: id,
            summary: `single concept: ${id}`,
            provenance: { sourceId: "s1", quotedText: "A vector is an ordered list of numbers." },
            tags: ["llm"],
          })
        ),
      ],
      edges: [
        ...fixture.edges,
        { from: "a", to: "b", type: "prereq" },
        { from: "b", to: "a", type: "prereq" },
      ],
    };
    expect(pathExists(rootless, "b")).toBe(false);
  });

  // KILLS: an implementation that requires the target to have >= 1 inbound prereq edge. A root is
  // reachable from itself — you can start there.
  it("is TRUE for a root itself (you can start at a foundational concept)", () => {
    expect(pathExists(fixture, "vectors")).toBe(true);
  });
});

describe("invalidProvenance — teeth (this is the credibility claim)", () => {
  it("rejects a substantial all-stopword span even when it occurs in the source", () => {
    const stopwordQuote = "the and of to in a for on with by from as at is are";
    const allStopwords: LearningGraph = {
      ...fixture,
      sources: fixture.sources.map((source) => ({
        ...source,
        text: `${source.text} ${stopwordQuote}`,
      })),
      concepts: fixture.concepts.map((concept) =>
        concept.id === "vectors"
          ? { ...concept, provenance: { ...concept.provenance, quotedText: stopwordQuote } }
          : concept
      ),
    };

    expect(invalidProvenance(allStopwords)).toEqual(["vectors"]);
  });

  it("requires at least four content-bearing words, not merely eight words", () => {
    const weakQuote = "the vector and the matrix of a model";
    const tooLittleContent: LearningGraph = {
      ...fixture,
      sources: fixture.sources.map((source) => ({
        ...source,
        text: `${source.text} ${weakQuote}`,
      })),
      concepts: fixture.concepts.map((concept) =>
        concept.id === "vectors"
          ? { ...concept, provenance: { ...concept.provenance, quotedText: weakQuote } }
          : concept
      ),
    };

    expect(invalidProvenance(tooLittleContent)).toEqual(["vectors"]);
  });

  it("catches a FABRICATED quote (the hallucination case — this is the pitch)", () => {
    const fabricated: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "softmax"
          ? { ...c, provenance: { ...c.provenance, quotedText: "Softmax was invented in 1817." } }
          : c
      ),
    };
    expect(invalidProvenance(fabricated)).toEqual(["softmax"]);
  });

  it("catches provenance pointing at a source that does not exist", () => {
    const unresolvable: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "qkv" ? { ...c, provenance: { ...c.provenance, sourceId: "nope" } } : c
      ),
    };
    expect(invalidProvenance(unresolvable)).toEqual(["qkv"]);
  });

  it("catches an EMPTY sourceId", () => {
    const noSource: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "qkv" ? { ...c, provenance: { ...c.provenance, sourceId: "" } } : c
      ),
    };
    expect(invalidProvenance(noSource)).toEqual(["qkv"]);
  });

  // KILLS: the naive `normalize(source.text).includes(normalize(quote))`. `"".includes("")` is
  // TRUE for every string, so an EMPTY quote is reported VALID by the obvious implementation. An
  // empty quote is a citation-shaped string with nothing in it — the cheapest hallucination there
  // is, and the one an atomizer produces when the model has nothing to ground a node in.
  it("catches an EMPTY quote (`text.includes('')` is true for every string)", () => {
    const emptyQuote: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "softmax" ? { ...c, provenance: { ...c.provenance, quotedText: "" } } : c
      ),
    };
    expect(invalidProvenance(emptyQuote)).toEqual(["softmax"]);
  });

  // Same cheat, one layer deeper: this quote is not empty, but it NORMALIZES to empty. An
  // implementation that normalizes and then calls `includes()` still reports it valid.
  it("catches a WHITESPACE-ONLY quote (it normalizes to the empty string)", () => {
    const blankQuote: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "softmax" ? { ...c, provenance: { ...c.provenance, quotedText: " \n\t  " } } : c
      ),
    };
    expect(invalidProvenance(blankQuote)).toEqual(["softmax"]);
  });

  // KILLS: `sources.find(s => s.id === id)`, which silently picks the FIRST match. Here the first
  // `s1` is the real source (so `find()` verifies happily and returns []), and the second `s1` is a
  // decoy. A duplicate id makes `sourceId` unresolvable — the "verification" would be running
  // against an arbitrary document. Every concept citing the ambiguous id is invalid.
  it("catches DUPLICATE source IDs (provenance that cannot be resolved is not provenance)", () => {
    const duplicateSources: LearningGraph = {
      ...fixture,
      sources: [
        ...fixture.sources,
        {
          id: "s1",
          title: "A different document",
          license: "CC-BY-4.0",
          author: "Another fixture author",
          text: "Unrelated text.",
        },
      ],
    };
    expect([...invalidProvenance(duplicateSources)].sort()).toEqual(
      [...fixture.concepts.map((c) => c.id)].sort()
    );
  });

  // KILLS: any reintroduction of offset validation. Offsets are HINTS (types.ts) — an LLM's
  // character arithmetic is never load-bearing. These offsets are garbage (start > end, and both
  // far past the end of the source) but the QUOTE is real, so the node is VALID. If this test goes
  // red, someone has re-added the offset-primary model the project rejected.
  it("does NOT invalidate a real quote carrying garbage offsets (offsets are hints, never checked)", () => {
    const badOffsets: LearningGraph = {
      ...fixture,
      concepts: fixture.concepts.map((c) =>
        c.id === "softmax"
          ? {
              ...c,
              provenance: {
                ...c.provenance,
                estimatedStartOffset: 99999,
                estimatedEndOffset: 12,
              },
            }
          : c
      ),
    };
    expect(invalidProvenance(badOffsets)).toEqual([]);
  });

  // The whitespace trap, asserted directly rather than only implied by the fixture. The source has
  // a newline mid-sentence; the quote renders it as a space. A byte-exact `includes()` FALSE-FAILS
  // here, and that failure looks exactly like hallucination — which is the single most likely way
  // this invariant gets wrongly "fixed" by weakening it.
  it("does NOT false-fail a real quote whose whitespace differs from the source", () => {
    expect(SOURCE_TEXT).toContain("into\na probability"); // the trap is really in the source
    expect(invalidProvenance(fixture)).toEqual([]); // and the fixture still validates
  });
});

describe("invalidLessonCitations — every on-screen unit is grounded", () => {
  it("accepts the two-step grounded fixture", () => {
    expect(invalidLessonCitations(fixture)).toEqual([]);
  });

  it("reports one typed empty-lesson issue when a lesson is missing", () => {
    const graph = structuredClone(fixture);
    graph.concepts[0].lesson = undefined;
    expect(invalidLessonCitations(graph)).toContainEqual({
      conceptId: "vectors",
      stepIndex: -1,
      reason: "empty-lesson",
    });
  });

  it("reports one typed empty-lesson issue when fewer than two steps exist", () => {
    const graph = structuredClone(fixture);
    graph.concepts[0].lesson?.steps.splice(1);
    expect(invalidLessonCitations(graph)).toContainEqual({
      conceptId: "vectors",
      stepIndex: -1,
      reason: "empty-lesson",
    });
  });

  it("identifies the exact step whose quote is not in its source", () => {
    const graph = structuredClone(fixture);
    const lesson = graph.concepts.find((concept) => concept.id === "qkv")?.lesson;
    if (!lesson) throw new Error("test setup: qkv lesson missing");
    lesson.steps[1].citation.quotedText = "This citation was fabricated.";

    expect(invalidLessonCitations(graph)).toEqual([
      { conceptId: "qkv", stepIndex: 1, reason: "quote-not-found" },
    ]);
    // Keep the original on-camera invariant crisp: lesson failures do not widen its scope.
    expect(invalidProvenance(graph)).toEqual([]);
  });

  it("classifies unresolved and ambiguous source IDs", () => {
    const unresolved = structuredClone(fixture);
    const unresolvedLesson = unresolved.concepts[0].lesson;
    if (!unresolvedLesson) throw new Error("test setup: vectors lesson missing");
    unresolvedLesson.steps[0].citation.sourceId = "missing";
    expect(invalidLessonCitations(unresolved)).toContainEqual({
      conceptId: "vectors",
      stepIndex: 0,
      reason: "unresolved-source",
    });

    const ambiguous = structuredClone(fixture);
    ambiguous.sources.push({
      id: "s1",
      title: "A different document",
      license: "CC-BY-4.0",
      author: "Another fixture author",
      text: SOURCE_TEXT,
    });
    expect(invalidLessonCitations(ambiguous)).toContainEqual({
      conceptId: "vectors",
      stepIndex: 0,
      reason: "ambiguous-source",
    });
  });

  it("normalizes whitespace through the shared grounding predicate", () => {
    const quote = "Softmax turns a vector of scores into a probability distribution that sums to one.";
    expect(SOURCE_TEXT).toContain("into\na probability");
    expect(quoteGrounded(fixture.sources, "s1", quote)).toBe(true);
    expect(invalidLessonCitations(fixture)).toEqual([]);
  });
});

describe("invalidRenderingCitations", () => {
  const renderingFixture = (): RenderingSet => ({
    renderings: [
      {
        conceptId: "vectors",
        format: "why-it-exists",
        plainTitle: "Why vectors exist",
        steps: [
          {
            text: "Vectors keep related numbers together.",
            stepTier: "core",
            citation: { sourceId: "s1", quotedText: "A vector is an ordered list of numbers." },
          },
          {
            text: "That ordered list can move through the learning path.",
            stepTier: "deep",
            citation: { sourceId: "s1", quotedText: "A vector is an ordered list of numbers." },
          },
        ],
      },
    ],
  });

  it("identifies the exact rendering step whose quote is not grounded", () => {
    const set = renderingFixture();
    set.renderings[0].steps[1].citation.quotedText = "This rendering citation was fabricated.";
    expect(invalidRenderingCitations(fixture, set)).toEqual([
      {
        conceptId: "vectors",
        format: "why-it-exists",
        stepIndex: 1,
        reason: "quote-not-found",
      },
    ]);
  });

  it("uses the shared quote-strength floor for rendering citations", () => {
    const set = renderingFixture();
    set.renderings[0].steps[0].citation.quotedText = "The dot product";
    expect(invalidRenderingCitations(fixture, set)).toContainEqual({
      conceptId: "vectors",
      format: "why-it-exists",
      stepIndex: 0,
      reason: "quote-too-weak",
    });
  });

  it("rejects two renderings for the same concept and format", () => {
    const set = renderingFixture();
    set.renderings.push(structuredClone(set.renderings[0]));
    expect(invalidRenderingCitations(fixture, set)).toEqual([
      {
        conceptId: "vectors",
        format: "why-it-exists",
        stepIndex: -1,
        reason: "duplicate-format",
      },
    ]);
  });

  it("rejects a rendering whose concept is absent from the graph", () => {
    const set = renderingFixture();
    set.renderings[0].conceptId = "missing-concept";
    expect(invalidRenderingCitations(fixture, set)).toEqual([
      {
        conceptId: "missing-concept",
        format: "why-it-exists",
        stepIndex: -1,
        reason: "unknown-concept",
      },
    ]);
  });

  it("rejects a rendering with fewer than two steps", () => {
    const set = renderingFixture();
    set.renderings[0].steps.splice(1);
    expect(invalidRenderingCitations(fixture, set)).toEqual([
      {
        conceptId: "vectors",
        format: "why-it-exists",
        stepIndex: -1,
        reason: "empty-rendering",
      },
    ]);
  });

  it("classifies an unknown source ID on the exact rendering step", () => {
    const set = renderingFixture();
    set.renderings[0].steps[0].citation.sourceId = "missing-source";
    expect(invalidRenderingCitations(fixture, set)).toEqual([
      {
        conceptId: "vectors",
        format: "why-it-exists",
        stepIndex: 0,
        reason: "unresolved-source",
      },
    ]);
  });

  it("classifies an ambiguous source ID on the exact rendering step", () => {
    const graph = structuredClone(fixture);
    graph.sources.push(
      {
        id: "s1",
        title: "A duplicate source",
        license: "CC-BY-4.0",
        author: "Another fixture author",
        text: SOURCE_TEXT,
      },
      {
        id: "s2",
        title: "A unique source",
        license: "CC-BY-4.0",
        author: "Another fixture author",
        text: "A separate grounded sentence contains enough meaningful words to support this lesson step.",
      },
    );
    const set = renderingFixture();
    set.renderings[0].steps[1].citation = {
      sourceId: "s2",
      quotedText: "A separate grounded sentence contains enough meaningful words to support this lesson step.",
    };
    expect(invalidRenderingCitations(graph, set)).toEqual([
      {
        conceptId: "vectors",
        format: "why-it-exists",
        stepIndex: 0,
        reason: "ambiguous-source",
      },
    ]);
  });

  it("does not false-fail a rendering quote whose only difference is whitespace", () => {
    expect(SOURCE_TEXT).toContain("into\na probability");
    const set = renderingFixture();
    set.renderings[0].conceptId = "softmax";
    for (const step of set.renderings[0].steps) {
      step.citation.quotedText =
        "Softmax turns a vector of scores into a probability distribution that sums to one.";
    }
    expect(invalidRenderingCitations(fixture, set)).toEqual([]);
  });

  it("accepts a clean valid rendering", () => {
    expect(invalidRenderingCitations(fixture, renderingFixture())).toEqual([]);
  });
});

// --- The real generated graph must satisfy every invariant (fails until `pnpm atomize` runs) ---
describe("generated data/graph.json", () => {
  // loadGraph() is called INSIDE each test, never in the describe body: a throw
  // during collection aborts the WHOLE file (fixture suite included) and vitest
  // reports "no tests" — which hides the RED -> GREEN signal we want on camera.

  it("is a DAG with no dangling edges", () => {
    const g = loadGraph();
    expect(hasCycle(g)).toBe(false);
    expect(danglingEdges(g)).toEqual([]);
  });

  it("has no orphans and valid provenance on every node", () => {
    const g = loadGraph();
    expect(findOrphans(g)).toEqual([]);
    expect(invalidProvenance(g)).toEqual([]);
  });

  it("rejects a one-word stopword citation on a real generated concept", () => {
    const g = structuredClone(loadGraph());
    const concept = g.concepts[0];
    if (!concept) throw new Error("test setup: committed graph has no concepts");
    concept.provenance.quotedText = "the";

    expect(invalidProvenance(g)).toEqual([concept.id]);
  });

  it("keeps all 10 committed concept provenance quotes valid", () => {
    const g = loadGraph();
    expect(g.concepts).toHaveLength(10);
    expect(invalidProvenance(g)).toEqual([]);
  });

  it("grounds every generated lesson step in its declared source", () => {
    expect(invalidLessonCitations(loadGraph())).toEqual([]);
  });

  it("grounds every generated rendering in its declared source", () => {
    const set = loadRenderingsForVerification();
    expect(set.renderings.flatMap((rendering) => rendering.steps)).toHaveLength(68);
    expect(invalidRenderingCitations(loadGraph(), set)).toEqual([]);
  });

  it("reaches the demo goal 'self-attention'", () => {
    const g = loadGraph();
    expect(g.goalId).toBe("self-attention");
    expect(pathExists(g, "self-attention")).toBe(true);
  });

  // The generated graph is NOT allowed to be the fixture wearing a costume (ADR 001, rule 3).
  // A hand-forged graph makes the headline claim — "GPT-5.6 built this" — false.
  it("is not a copy of the hand-built test fixture", () => {
    const g = loadGraph();
    expect(g.concepts.length).toBeGreaterThan(fixture.concepts.length);
    expect(g.sources.map((s) => s.title)).not.toContain(fixture.sources[0].title);
  });

  // Every source shipped in the graph carries an open licence. `Source.license` is required by the
  // type, but TypeScript cannot enforce a type on JSON parsed at runtime — `loadGraph()` casts. The
  // full source text is embedded in a PUBLIC repo; shipping it with no licence recorded is a legal
  // exposure and a hole in the exact claim being made ("openly licensed OER").
  it("ships every source with a non-empty licence", () => {
    const g = loadGraph();
    expect(g.sources.length).toBeGreaterThan(0);
    for (const s of g.sources) expect(s.license?.trim()).toBeTruthy();
  });
});
