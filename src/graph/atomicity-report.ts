// Advisory atomicity reporter — the DEMOTED, build-facing surface for `isSingleConcept`.
//
// `isSingleConcept` (in ./invariants) is KEPT but DEMOTED (Beau, 2026-07-15) from a hard proof
// invariant to a build-time ADVISORY reporter. This file is that reporter. It NEVER fails the
// build, NEVER gates a phase or the repair loop, and is NEVER presented on camera as proof of
// atomicity — no offline syntactic rule can PROVE "one concept". `[]` means "nothing to eyeball",
// NOT "proven atomic". See src/graph/invariants.ts (isSingleConcept docstring), root AGENTS.md,
// src/atomization/AGENTS.md, ROADMAP.md §3, and the reframe spec.

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
 */
export function reportAtomicityWarnings(graph: LearningGraph): AtomicityWarning[] {
  const warnings: AtomicityWarning[] = [];
  const concepts = Array.isArray(graph?.concepts) ? graph.concepts : [];
  for (const concept of concepts) {
    try {
      if (isSingleConcept(concept)) continue;
      const summary = typeof concept.summary === "string" ? concept.summary : "";
      const signal: AtomicitySignal = summary.includes("&")
        ? "ampersand"
        : summary.includes(";")
          ? "semicolon"
          : summary.includes(",")
            ? "comma-enumeration"
            : "coordinating-and-or";
      warnings.push({
        conceptId: concept.id,
        summary,
        signal,
        reason: `summary reads as an enumeration: ${summary}`,
        confidence: "high",
      });
    } catch {
      // Advisory-only by construction: malformed build-time input cannot turn this reporter into a gate.
    }
  }
  return warnings;
}
