// STUB — Codex implements this. The signature is fixed by `path.test.ts`.
//
// WHY THIS IS A SEPARATE MODULE FROM `invariants.ts`:
// `invariants.ts` answers "is this graph VALID?" — every function there returns VIOLATIONS, and it
// is a build-time gate. `getPath` answers "what does the LEARNER DO?" — it returns the product's
// deterministic route and it runs on the request path in the UI. Two different jobs, two different
// callers, two different failure meanings: a pathfinder bug must not surface as "an invariant
// failed", and a validator bug must not surface as "the path is wrong". `pathExists` (a boolean,
// validity) staying in `invariants.ts` while `getPath` (an ordered sequence, product) lives here is
// the same split, and the UI imports THIS file without dragging the validator in.
//
// THIS FUNCTION IS THE DEMO. The graph can satisfy every invariant — acyclic, no orphans, no
// dangling edges, goal reachable, every quote real — and still hand the judge the WRONG ROUTE.
// Reachability is not ordering. `path.test.ts` pins the exact golden sequence for that reason.

import type { ConceptId, LearningGraph } from "../types";

const TODO = (fn: string): never => {
  throw new Error(`not implemented: ${fn}() — implement in src/graph/path.ts`);
};

/**
 * The ordered sequence of concepts a learner must understand to reach `goalId`, ending WITH the
 * goal. A deterministic walk over the prerequisite DAG — never a model call. This is the claim:
 * "reasoning over the graph is deterministic and auditable."
 *
 * CONTENTS. The prereq-ANCESTOR CLOSURE of `goalId`, plus `goalId` itself. A concept is included
 * iff there is a chain of `prereq` edges from it to the goal. Concepts the goal does not depend on
 * are NOT in the path, however interesting they are. Only edges of type `"prereq"` are walked —
 * `related` and `method` edges are UI affordances and MUST NOT alter the route.
 *
 * ORDER. Topologically sorted: every concept appears AFTER all of its own prerequisites. On the
 * fixture (a straight chain) that order is unique. On a real atomized graph it is NOT — several
 * concepts will be ready at once — so the tie must be broken by a rule, or "deterministic" is a
 * lie. TIE-BREAK: among concepts whose prerequisites are all already emitted, emit the one with
 * the lexicographically smallest `id`. (Kahn's algorithm with a sorted ready-set.) This makes the
 * output a pure function of the graph's CONTENT, not of the order the atomizer happened to write
 * the arrays in — so re-atomizing and re-sorting `graph.json` cannot silently reorder the demo.
 *
 * `known` — the concepts the learner has already marked understood (`LearnerState.known`). They are
 * REMOVED from the returned path; everything else about the computation is unchanged. This is what
 * makes "mark understood → the path advances" a deterministic recomputation rather than a UI
 * animation. Note a concept is dropped ONLY if it is itself known: knowing `softmax` does not imply
 * knowing `vectors`, so ancestors of a known concept stay in the path unless they too are known.
 *
 * THROWS if `goalId` is not a concept in the graph. A goal that does not exist is a caller bug, and
 * an empty array would silently render an empty path — a false green in the UI.
 */
export function getPath(
  _graph: LearningGraph,
  _goalId: ConceptId,
  _known: ConceptId[] = []
): ConceptId[] {
  return TODO("getPath");
}
