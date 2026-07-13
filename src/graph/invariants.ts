// STUB — Codex implements these. Signatures are fixed by `invariants.test.ts`.
// Each throws so the test suite is RED-with-a-reason (a failing test list, not a
// module-resolution error). Replace the bodies; do not change the signatures.
//
// Invariants (see README):
//   1. one concept per node   2. no orphans (roots exempt)   3. prereq graph is a DAG
//   4. goal reachable from a root   5. provenance valid   6. no dangling edges

import type { Concept, ConceptId, Edge, LearningGraph } from "../types";

const TODO = (fn: string): never => {
  throw new Error(`not implemented: ${fn}() — implement in src/graph/invariants.ts`);
};

/** True if the prerequisite edges contain a cycle. */
export function hasCycle(_graph: LearningGraph): boolean {
  return TODO("hasCycle");
}

/** Concepts with no inbound AND no outbound edges. Roots (no inbound, has outbound) are exempt. */
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
