// Advisory atomicity reporter — the DEMOTED, build-facing surface for `isSingleConcept`.
//
// `isSingleConcept` (in ./invariants) is KEPT but DEMOTED (Beau, 2026-07-15) from a hard proof
// invariant to a build-time ADVISORY reporter. This file is that reporter. It NEVER fails the
// build, NEVER gates a phase or the repair loop, and is NEVER presented on camera as proof of
// atomicity — no offline syntactic rule can PROVE "one concept". `[]` means "nothing to eyeball",
// NOT "proven atomic". See src/graph/invariants.ts (isSingleConcept docstring), root AGENTS.md,
// src/atomization/AGENTS.md, ROADMAP.md §3, and the reframe spec.
//
// PRE-COMMITTED EXTERNAL ORACLE (decision C, 2026-07-15): this stub + its test
// (./atomicity-report.test.ts) are committed BEFORE Codex runs, so the "advisory never gates the
// build" guarantee is a test the agent must satisfy and cannot author or soften. This is a
// RED-with-a-reason stub — `reportAtomicityWarnings` throws "not implemented" (not a module
// error), exactly like the other Gate-0 stubs. Codex fills in the body at Gate 2 against the
// pinned tests; do NOT change the exported signatures.

import type { Concept, ConceptId, LearningGraph } from "../types";
import { isSingleConcept } from "./invariants";

export type AtomicitySignal =
  | "coordinating-and-or"
  | "comma-enumeration"
  | "semicolon"
  | "ampersand"
  | "multiple-defined-terms" // reporter-only, softer (LOW confidence)
  | "multi-sentence"; // reporter-only, softer (LOW confidence)

export interface AtomicityWarning {
  conceptId: ConceptId;
  summary: string;
  signal: AtomicitySignal;
  reason: string;
  confidence: "high" | "low";
}

// The extension SEAM — a seed, not a leaf. The MVP scorer delegates to the pinned predicate; a
// future embedding-/LLM-judge scorer (ROADMAP.md §3) drops in behind this same interface with
// zero change to callers. This slot is the reason `isSingleConcept` was demoted, not cut.
export interface AtomicityScorer {
  score(concept: Concept): { atomic: boolean; confidence: number; signals: AtomicitySignal[] };
}

export const syntacticAtomicityScorer: AtomicityScorer = {
  score: (c) => ({ atomic: isSingleConcept(c), confidence: 0.5, signals: [] }),
};

/**
 * ADVISORY ONLY. Returns warnings for the human ~20-node eyeball pass. Once implemented it must
 * NEVER throw and NEVER influence an exit code — its only channel is the returned array. `[]` is
 * NOT proof of atomicity (§7 of the reframe spec).
 *
 * RED STUB: throws until Codex builds it at Gate 2 against ./atomicity-report.test.ts.
 */
export function reportAtomicityWarnings(_graph: LearningGraph): AtomicityWarning[] {
  throw new Error(
    "not implemented: reportAtomicityWarnings — build the advisory reporter at Gate 2 against " +
      "src/graph/atomicity-report.test.ts (see isSingleConcept-reframe-spec §5). It must return " +
      "warnings and never throw.",
  );
}
