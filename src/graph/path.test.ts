// THE GOLDEN PATH. Written FIRST (TDD) — RED until Codex implements `src/graph/path.ts`, and RED
// on the generated graph until `pnpm atomize` produces one.
//
// WHY THIS FILE EXISTS. Every invariant in `invariants.test.ts` can be GREEN on a graph that hands
// the judge the wrong route. `pathExists` is a BOOLEAN — it proves `self-attention` is reachable
// from *some* root, not that the learner is walked through
// vectors -> dot-product -> softmax -> qkv -> self-attention. Reachability is not ordering. A graph
// that is acyclic, orphan-free, dangling-free, fully-grounded and reachable can still route the
// learner through the wrong concepts in the wrong order, and the demo — which IS that ordered path
// — would be wrong with a green suite. This file closes that hole by pinning the exact sequence.

import { describe, it, expect } from "vitest";
import type { LearningGraph, Concept } from "../types";
import { getPath } from "./path";
import { loadGraph } from "./load";
import { fixtureGraph, GOLDEN_PATH } from "./fixture-graph";

const fixture = fixtureGraph;

const concept = (id: string): Concept => ({
  id,
  title: id,
  summary: `single concept: ${id}`,
  provenance: { sourceId: "s1", quotedText: "A vector is an ordered list of numbers." },
  tags: ["llm"],
});

describe("getPath — the ordered deterministic walk (fixture)", () => {
  // THE demo assertion. Deep-equal on the exact sequence, not a set, not a length, not a boolean.
  it("returns the golden path to 'self-attention', in order", () => {
    expect(getPath(fixture, "self-attention")).toEqual([...GOLDEN_PATH]);
  });

  // KILLS: returning the ancestor SET in arbitrary (or graph-array) order. The path must be
  // topologically ordered — every concept after its own prerequisites — or the learner is told to
  // read softmax before vectors.
  it("puts every concept AFTER its own prerequisites", () => {
    const path = getPath(fixture, "self-attention");
    const seen = new Set<string>();
    for (const id of path) {
      for (const e of fixture.edges.filter((e) => e.type === "prereq" && e.to === id)) {
        expect(seen).toContain(e.from);
      }
      seen.add(id);
    }
  });

  // KILLS: using concept/edge array order (or the wrong comparator) when Kahn's ready-set has
  // multiple valid next nodes. The chain fixture never exercises this branch: its ready-set is
  // always size one. Both independent roots below are ready immediately, so content-level
  // determinism requires the lexicographically smaller ID regardless of serialized array order.
  it("breaks ready-set ties lexicographically and is independent of input array order", () => {
    const tied: LearningGraph = {
      concepts: [concept("zebra"), concept("goal"), concept("alpha")],
      edges: [
        { from: "zebra", to: "goal", type: "prereq" },
        { from: "alpha", to: "goal", type: "prereq" },
      ],
      sources: fixture.sources,
      goalId: "goal",
    };
    const shuffled: LearningGraph = {
      ...tied,
      concepts: [...tied.concepts].reverse(),
      edges: [...tied.edges].reverse(),
    };

    expect(getPath(tied, "goal")).toEqual(["alpha", "zebra", "goal"]);
    expect(getPath(shuffled, "goal")).toEqual(getPath(tied, "goal"));
  });

  // KILLS: returning every concept in the graph. The path is the goal's ancestor closure — a
  // concept the goal does not depend on is not on the route to it, however interesting it is.
  it("excludes concepts the goal does not depend on", () => {
    const withDetour: LearningGraph = {
      ...fixture,
      concepts: [...fixture.concepts, concept("tokenization")],
      edges: [...fixture.edges, { from: "vectors", to: "tokenization", type: "prereq" }],
    };
    // `tokenization` is DOWNSTREAM of vectors but is not an ancestor of self-attention.
    expect(getPath(withDetour, "self-attention")).toEqual([...GOLDEN_PATH]);
  });

  // KILLS: a walk that follows `related`/`method` edges. Those are UI affordances; letting them
  // steer the route makes the path non-deterministic in meaning even if it is stable in output.
  it("does not route through `related` or `method` edges", () => {
    const withNoise: LearningGraph = {
      ...fixture,
      concepts: [...fixture.concepts, concept("history-of-attention")],
      edges: [
        ...fixture.edges,
        { from: "history-of-attention", to: "self-attention", type: "related" },
        { from: "history-of-attention", to: "qkv", type: "method" },
      ],
    };
    expect(getPath(withNoise, "self-attention")).toEqual([...GOLDEN_PATH]);
  });

  // A shorter goal returns a shorter path — the walk is computed from the goal, not hardcoded to
  // the demo. KILLS: `getPath = () => GOLDEN_PATH`, the ultimate cheat on the test above.
  it("computes a DIFFERENT goal's path (it is not the golden path hardcoded)", () => {
    expect(getPath(fixture, "softmax")).toEqual(["vectors", "dot-product", "softmax"]);
  });

  it("returns just the goal when the goal is a root", () => {
    expect(getPath(fixture, "vectors")).toEqual(["vectors"]);
  });

  // Entry declarations alter the route by deterministic recomputation, not a UI animation.
  // KILLS: a `getPath` that ignores `known`, which would make the entry choices decorative.
  it("drops concepts the learner declares they already know", () => {
    expect(getPath(fixture, "self-attention", ["vectors", "dot-product"])).toEqual([
      "softmax",
      "qkv",
      "self-attention",
    ]);
  });

  // KILLS: `known` implemented as "drop the known concept AND everything upstream of it". Knowing
  // softmax does NOT imply knowing vectors — a learner can arrive with scattered knowledge, which
  // is the entire premise of "a path from where you ARE".
  it("keeps the prerequisites of a known concept unless they are themselves known", () => {
    expect(getPath(fixture, "self-attention", ["softmax"])).toEqual([
      "vectors",
      "dot-product",
      "qkv",
      "self-attention",
    ]);
  });

  it("returns an empty path when the learner already knows everything", () => {
    expect(getPath(fixture, "self-attention", [...GOLDEN_PATH])).toEqual([]);
  });

  // A goal that does not exist is a caller bug. An empty array would silently render an empty path
  // in the UI — a false green in front of a judge.
  //
  // NOT a bare `.toThrow()`: the stub throws `not implemented`, so a bare assertion here would be
  // GREEN against a `getPath` that does nothing — and green against one that throws on everything.
  it("throws on a goal that is not in the graph (and not because it is a stub)", () => {
    let thrown: unknown;
    try {
      getPath(fixture, "not-a-concept");
    } catch (e) {
      thrown = e;
    }
    expect(thrown, "expected getPath to throw on an unknown goal, but it returned").toBeInstanceOf(
      Error
    );
    expect((thrown as Error).message).not.toMatch(/not implemented/i);
  });
});

describe("getPath on the generated data/graph.json", () => {
  // The demo route, asserted against the REAL graph. This is the test that says the atomizer did
  // not just produce *a* valid graph — it produced *the* graph the demo walks.
  //
  // The full product spine now fixes every concept and edge. The four non-goal branches are not
  // ancestors of self-attention, so its derived route must be exactly the five-node demo path.
  it("routes through exactly the golden path concepts, in order", () => {
    const g = loadGraph();
    const path = getPath(g, "self-attention");

    expect(path).toEqual([...GOLDEN_PATH]);
  });

  it("starts the learner at a concept with no prerequisites", () => {
    const g = loadGraph();
    const first = getPath(g, "self-attention")[0];
    const hasPrereq = g.edges.some((e) => e.type === "prereq" && e.to === first);
    expect(hasPrereq).toBe(false);
  });
});
