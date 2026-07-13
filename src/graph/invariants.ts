// STUB — Codex implements these. Signatures are fixed by `invariants.test.ts`.
// Each throws so the test suite is RED-with-a-reason (a failing test list, not a
// module-resolution error). Replace the bodies; do not change the signatures.
//
// Invariants (see README):
//   1. one concept per node   2. no orphans (roots exempt)   3. prereq graph is a DAG
//   4. goal reachable from a root   5. provenance valid   6. no dangling edges
//
// The precise definition of invariant 2 ("orphan", "root", and why roots are exempt) is on
// `findOrphans` below. Read it before implementing — the test fixture cannot tell a correct
// implementation from a wrong one, so the definition is the only spec you get.
//
// ✅ SETTLED (type-model pass, 2026-07-13) — `LearningGraph.edges[]` is the SINGLE SOURCE OF
// TRUTH for every relation. `Concept.prerequisites` NO LONGER EXISTS; it was a second,
// unenforced encoding of the same relation and on a generated graph the two WOULD have diverged,
// leaving a green suite that proved nothing. Every function below reads the prereq relation from
// `edges[]` filtered to `type === "prereq"` — all six from the SAME place. Derive a concept's
// prerequisites from edges; do not reintroduce a field for them.
//
// ✅ PROVENANCE IS QUOTE-PRIMARY (see types.ts). `invalidProvenance` must resolve
// `provenance.sourceId` against `graph.sources[]` and check that `provenance.quotedText`
// ACTUALLY OCCURS in that source's text.
//
// ⚠ MATCH ON NORMALIZED WHITESPACE, NOT RAW SUBSTRING. `source.text.includes(quotedText)` is
// byte-exact and will FALSE-FAIL whenever the source's whitespace differs from the model's
// rendering of the quote (a newline mid-sentence in the OER, a collapsed double space). That
// failure looks exactly like hallucination and is the single most likely way this invariant gets
// wrongly "fixed" by weakening it. Collapse whitespace runs to a single space and trim BOTH
// sides before comparing. The fixture deliberately contains this trap — see invariants.test.ts.

import type { Concept, ConceptId, Edge, LearningGraph } from "../types";

const TODO = (fn: string): never => {
  throw new Error(`not implemented: ${fn}() — implement in src/graph/invariants.ts`);
};

/** True if the prerequisite edges contain a cycle. */
export function hasCycle(_graph: LearningGraph): boolean {
  return TODO("hasCycle");
}

/**
 * ORPHANS — precise definition. Read this before implementing; the fixture does NOT
 * discriminate between the plausible definitions (it is a fully-connected 5-node chain,
 * so *every* candidate definition returns `[]` on it). Getting this wrong is invisible
 * until it fails on the real atomized graph — i.e. during the demo.
 *
 * Terms. Consider ONLY the prerequisite relation (edges of type `"prereq"`). A prereq edge
 * `u -> v` means "u must be understood before v" — it points in the direction of learning
 * progression. For a concept `c`:
 *   - inbound(c)  = prereq edges INTO c   = c's own prerequisites
 *   - outbound(c) = prereq edges OUT of c = the concepts c unlocks (c is their prerequisite)
 *
 * Classification:
 *   ROOT    inbound == 0 && outbound  > 0   foundational entry point (e.g. `vectors`). LEGAL.
 *   LEAF    inbound  > 0 && outbound == 0   terminal, e.g. the goal `self-attention`.   LEGAL.
 *   INNER   inbound  > 0 && outbound  > 0                                               LEGAL.
 *   ORPHAN  inbound == 0 && outbound == 0   isolated — connected to NOTHING.            FAILS.
 *
 * So: an orphan is a concept with NO prerequisite edges in either direction.
 *
 * Why roots are exempt. The naive reading of "orphan" is "nothing points to it" (inbound == 0).
 * That would flag every root — but a root having no prerequisites is not a defect, it is the
 * definition of foundational, and a DAG with no roots is either empty or cyclic, i.e. nothing
 * could ever be learned from scratch. The exemption is therefore not a loophole; it is the
 * distinction between a concept that *correctly* has no prerequisites (a root — which still
 * earns its place by unlocking something) and a concept that has no relationships AT ALL (an
 * orphan). By symmetry the goal node, which legitimately unlocks nothing, is exempt too.
 *
 * Why this invariant exists at all. It catches ATOMIZER FAILURE. The pathfinder is a
 * deterministic walk over prereq edges, so a degree-0 concept can never appear on any path to
 * any goal: it is unreachable, un-teachable, and dead weight in the rendered graph. Its real
 * meaning is that the model extracted a concept and then failed to infer a single relationship
 * for it — the graph is not a graph at that node, it is a loose bag of nodes. That is precisely
 * the failure this project claims not to have.
 *
 * Two things that do NOT rescue an orphan:
 *   - `related` / `method` edges. A node reachable only by a `related` edge is still invisible
 *     to a prerequisite walk. Non-prereq edges MUST NOT be counted here.
 *   - Being listed in some other concept's array while having no corresponding edge. See the
 *     source-of-truth note in the header above — read the prereq relation from ONE source.
 *
 * Returns the IDs of all orphans; `[]` means the invariant holds.
 */
export function findOrphans(_graph: LearningGraph): ConceptId[] {
  return TODO("findOrphans");
}

/** Edges whose `from` or `to` does not resolve to a concept in the graph. */
export function danglingEdges(_graph: LearningGraph): Edge[] {
  return TODO("danglingEdges");
}

/** True if `target` is reachable from some root of the prerequisite DAG. */
export function pathExists(_graph: LearningGraph, _target: ConceptId): boolean {
  return TODO("pathExists");
}

/** Concepts whose provenance is missing/malformed (startOffset >= endOffset, no sourceId, ...). */
export function invalidProvenance(_graph: LearningGraph): ConceptId[] {
  return TODO("invalidProvenance");
}

/** False if the concept describes more than one thing (an "X and Y" summary is the smell). */
export function isSingleConcept(_concept: Concept): boolean {
  return TODO("isSingleConcept");
}
