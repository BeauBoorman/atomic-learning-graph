import { describe, it, expect } from "vitest";
import type { AtomicityWarning } from "./atomicity-report";
import { reportAtomicityWarnings, syntacticAtomicityScorer } from "./atomicity-report";
import { isSingleConcept } from "./invariants";
import { fixtureGraph } from "./fixture-graph";
import type { LearningGraph } from "../types";

// PRE-COMMITTED EXTERNAL ORACLE (decision C, 2026-07-15).
//
// This file is committed BEFORE Codex runs so the "advisory reporter never gates the build"
// guarantee is a test the agent MUST satisfy and CANNOT author or soften — the same regime as the
// rest of the adversarial suite. It is RED-with-a-reason until Gate 2: `reportAtomicityWarnings`
// currently throws "not implemented" (a failing test list, not a module-resolution error, because
// the sibling stub ./atomicity-report.ts exists). Codex turns it green by BUILDING the reporter to
// the reframe spec — never by weakening an assertion here.

const clone = (g: LearningGraph): LearningGraph => JSON.parse(JSON.stringify(g));

// A copy of the golden fixture with ONE concept's summary replaced — for planting an enumeration
// or a pathological string without mutating the shared fixture.
const withSummary = (id: string, summary: string): LearningGraph => {
  const g = clone(fixtureGraph);
  const c = g.concepts.find((x) => x.id === id);
  if (!c) throw new Error(`test setup: no concept "${id}" in fixture`);
  c.summary = summary;
  return g;
};

describe("reportAtomicityWarnings — advisory, never a gate", () => {
  it("1. clean fixture → no warnings (no false positives on the golden chain)", () => {
    expect(reportAtomicityWarnings(fixtureGraph)).toEqual([]);
  });

  it("2. planted enumeration → exactly one high-confidence warning for that concept", () => {
    const warnings = reportAtomicityWarnings(withSummary("vectors", "vectors and matrices"));
    const forVectors = warnings.filter((w) => w.conceptId === "vectors");
    expect(forVectors).toHaveLength(1);
    expect(forVectors[0].confidence).toBe("high");
    expect(forVectors[0].summary).toBe("vectors and matrices");
    expect(forVectors[0].reason).toBeTruthy();
    // one planted enumeration must not cascade high-confidence flags onto clean nodes
    expect(warnings.filter((w) => w.confidence === "high")).toHaveLength(1);
  });

  it("3. never throws on empty concepts or pathological summaries → always returns an array", () => {
    const empty: LearningGraph = { ...clone(fixtureGraph), concepts: [], edges: [] };
    expect(Array.isArray(reportAtomicityWarnings(empty))).toBe(true);
    for (const pathological of ["", "   ", "🙂🙂"]) {
      expect(Array.isArray(reportAtomicityWarnings(withSummary("vectors", pathological)))).toBe(true);
    }
  });

  it("4. advisory ≠ gate: a tripping graph RETURNS warnings, never throws to fail a build", () => {
    // The full exit-code-independence check attaches at Gate 6 (needs the atomize/validate entry
    // point). What is runnable now: the reporter's ONLY channel is a returned array — a non-empty
    // result is data for the human eyeball, not a thrown build failure.
    let warnings: AtomicityWarning[] = [];
    expect(() => {
      warnings = reportAtomicityWarnings(withSummary("qkv", "queries & keys"));
    }).not.toThrow();
    expect(warnings.some((w) => w.conceptId === "qkv")).toBe(true);
  });

  it("5. seam is real: syntacticAtomicityScorer.score(c).atomic === isSingleConcept(c)", () => {
    for (const c of fixtureGraph.concepts) {
      expect(syntacticAtomicityScorer.score(c).atomic).toBe(isSingleConcept(c));
    }
  });
});
