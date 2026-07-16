// STUB — Codex implements these. Signatures are fixed by `invariants.test.ts`.
// Each throws so the test suite is RED-with-a-reason (a failing test list, not a
// module-resolution error). Replace the bodies; do not change the signatures.
//
// 5 HARD proof-invariants (fail-closed gates) + 1 ADVISORY reporter:
//   HARD: no orphans (roots exempt) · prereq graph is a DAG · goal reachable from a root ·
//         provenance valid · no dangling edges
//   ADVISORY (never gates the build): isSingleConcept — an enumeration detector, demoted 2026-07-15.
//     See ROADMAP.md and the isSingleConcept docstring below.
//
// The precise definition of invariant 2 ("orphan", "root", and why roots are exempt) is on
// `findOrphans` below. Read it before implementing — the test fixture cannot tell a correct
// implementation from a wrong one, so the definition is the only spec you get.
//
// EVERY function here now has ADVERSARIAL tests (invariants.test.ts). They exist because the
// happy-path fixture is a clean 5-node chain on which `return []` / `() => false` / `() => true`
// pass EVERY positive assertion — a green suite would have proved nothing. Do not delete or weaken
// a negative test to make an implementation pass; the negative test IS the invariant.
//
// VALIDITY IS NOT THE PRODUCT. A graph can satisfy all of these and still hand the learner the
// wrong ROUTE — reachability is not ordering. The ordered deterministic walk (`getPath`) lives in
// `src/graph/path.ts` and is pinned to the exact golden path by `src/graph/path.test.ts`.
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

/**
 * True if the PREREQUISITE edges contain a cycle.
 *
 * Only edges of type `"prereq"` participate. A cycle among `related` edges is not a cycle in the
 * learning order — `related` is a symmetric UI affordance and will routinely appear in both
 * directions. An implementation that walks every edge type reports a false cycle on a perfectly
 * good graph, and the reflex "fix" is to weaken the invariant. Filter by type first.
 * A self-loop (`x -> x`, type `prereq`) IS a cycle.
 */
export function hasCycle(graph: LearningGraph): boolean {
  const adjacency = new Map<ConceptId, ConceptId[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "prereq") continue;
    const neighbors = adjacency.get(edge.from) ?? [];
    neighbors.push(edge.to);
    adjacency.set(edge.from, neighbors);
  }

  const visiting = new Set<ConceptId>();
  const visited = new Set<ConceptId>();
  const visit = (id: ConceptId): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  const ids = new Set<ConceptId>([
    ...graph.concepts.map((concept) => concept.id),
    ...graph.edges.filter((edge) => edge.type === "prereq").flatMap((edge) => [edge.from, edge.to]),
  ]);
  return [...ids].some(visit);
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
export function findOrphans(graph: LearningGraph): ConceptId[] {
  const connected = new Set<ConceptId>();
  for (const edge of graph.edges) {
    if (edge.type !== "prereq") continue;
    connected.add(edge.from);
    connected.add(edge.to);
  }
  return graph.concepts.filter((concept) => !connected.has(concept.id)).map((concept) => concept.id);
}

/**
 * Edges whose `from` or `to` does not resolve to a concept in the graph.
 *
 * REFERENTIAL INTEGRITY, so this checks EVERY edge type — `related` and `method` edges included.
 * (Contrast `hasCycle`/`findOrphans`/`pathExists`, which are about the prereq relation and filter
 * to `type === "prereq"`.) A `related` edge pointing at a concept that does not exist is still a
 * broken graph: the UI will try to render it.
 *
 * This is the invariant that catches the atomizer's most predictable failure — the model names a
 * prerequisite it never emitted a node for (a concept from another chunk, or one it hallucinated).
 * Returns the offending edges; `[]` means the invariant holds.
 */
export function danglingEdges(graph: LearningGraph): Edge[] {
  const ids = new Set(graph.concepts.map((concept) => concept.id));
  return graph.edges.filter((edge) => !ids.has(edge.from) || !ids.has(edge.to));
}

/**
 * True if `target` is REACHABLE from some ROOT of the prerequisite DAG.
 *
 * Root, as defined on `findOrphans` below: inbound prereq == 0 AND outbound prereq > 0. Reachable
 * means: there is a chain of `prereq` edges from that root to `target`. A root is trivially
 * reachable from ITSELF, so `pathExists(g, someRoot) === true`.
 *
 * FALSE when:
 *   - `target` is not a concept in the graph at all;
 *   - `target` is an isolated node (no prereq edges either way) — no root can walk to it;
 *   - every chain into `target` originates inside a CYCLE, so the component has no root. Nothing
 *     could ever be learned from scratch in that component, which is exactly the failure this
 *     catches.
 *
 * NOT "does a concept with this id exist" (that cheat passes every happy-path test), and NOT "does
 * it have any inbound edge" (that passes for a target fed only by a cycle).
 */
export function pathExists(graph: LearningGraph, target: ConceptId): boolean {
  const conceptIds = new Set(graph.concepts.map((concept) => concept.id));
  if (!conceptIds.has(target)) return false;

  const inbound = new Map<ConceptId, number>(graph.concepts.map((concept) => [concept.id, 0]));
  const adjacency = new Map<ConceptId, ConceptId[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "prereq" || !conceptIds.has(edge.from) || !conceptIds.has(edge.to)) continue;
    inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1);
    const neighbors = adjacency.get(edge.from) ?? [];
    neighbors.push(edge.to);
    adjacency.set(edge.from, neighbors);
  }

  const roots = graph.concepts
    .map((concept) => concept.id)
    .filter((id) => (inbound.get(id) ?? 0) === 0 && (adjacency.get(id)?.length ?? 0) > 0);
  const seen = new Set<ConceptId>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift() as ConceptId;
    if (id === target) return true;
    for (const next of adjacency.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/**
 * Concepts whose provenance cannot be VERIFIED against the sources shipped in the graph.
 * Returns the offending concept IDs; `[]` means every node is grounded.
 *
 * This is the credibility invariant — the boolean that goes on camera — so it is specified
 * exhaustively. `provenance.sourceId` must resolve to exactly one `graph.sources[]` entry, and
 * `provenance.quotedText` must ACTUALLY OCCUR in that source's `text` after whitespace
 * normalization (collapse runs of whitespace to one space, trim both ends, both sides).
 *
 * A concept is INVALID if ANY of:
 *   - `sourceId` is missing/empty, or resolves to NO source in `graph.sources[]`;
 *   - `sourceId` is AMBIGUOUS — two or more sources share that id. `sources.find(s => s.id === x)`
 *     silently picks the first, so the "verification" would be run against an arbitrary document.
 *     A duplicate id makes provenance unresolvable, which is not provenance;
 *   - `quotedText` is missing, empty, or whitespace-only. Note `"".includes()` semantics:
 *     `text.includes("")` is TRUE for every string, and a whitespace-only quote NORMALIZES to the
 *     empty string — so the naive implementation reports an empty quote as VALID. An empty quote is
 *     a citation-shaped string with nothing in it; it is the cheapest possible hallucination;
 *   - the normalized `quotedText` does not occur in the normalized source `text`.
 *
 * OFFSETS ARE NOT VALIDATED. `estimatedStartOffset` / `estimatedEndOffset` are HINTS (see
 * types.ts): an LLM's character arithmetic is not trusted, is never load-bearing, and MUST NOT be
 * able to invalidate a node whose quote genuinely occurs in its source. Do NOT reintroduce an
 * offset check (an earlier draft of this comment said `startOffset >= endOffset` was "malformed" —
 * that was a leftover from the REJECTED offset-primary model). `provenance-offsets-are-hints` in
 * invariants.test.ts pins this: garbage offsets on a real quote must still be VALID.
 *
 * SCOPE, stated honestly: a quote occurring in the source proves the node was NOT FABRICATED. It
 * does not prove the node is CORRECT. Do not overclaim it.
 */
export function invalidProvenance(graph: LearningGraph): ConceptId[] {
  const sourcesById = new Map<string, typeof graph.sources>();
  for (const source of graph.sources) {
    const matches = sourcesById.get(source.id) ?? [];
    matches.push(source);
    sourcesById.set(source.id, matches);
  }
  const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

  return graph.concepts
    .filter((concept) => {
      const sourceId = concept.provenance?.sourceId;
      const quotedText = concept.provenance?.quotedText;
      if (typeof sourceId !== "string" || sourceId.trim().length === 0) return true;
      if (typeof quotedText !== "string") return true;
      const normalizedQuote = normalizeWhitespace(quotedText);
      if (normalizedQuote.length === 0) return true;
      const sources = sourcesById.get(sourceId);
      if (!sources || sources.length !== 1) return true;
      return !normalizeWhitespace(sources[0].text).includes(normalizedQuote);
    })
    .map((concept) => concept.id);
}

/**
 * ✅ SETTLED (Beau, 2026-07-15) — KEPT but DEMOTED. This is NOT one of the 5 hard proof-invariants.
 * It is a build-time ADVISORY enumeration reporter: it NEVER fails the build, NEVER gates a phase or
 * the repair loop, and is NEVER presented on camera as proof of atomicity. It stays in code, stays
 * under test, and is the SEED for a future embedding-/LLM-judge atomicity scorer. Nothing is deleted.
 *
 * False if the concept's summary ENUMERATES more than one thing (coordination — "X and Y", "X, Y",
 * "X; Y", "X & Y"). That is the narrow, honest thing a syntactic check CAN do, and it catches the
 * atomizer's observable failure mode. What it CANNOT do, offline and deterministically, is judge
 * whether a single un-coordinated noun phrase is atomic — see the `it.skip` KNOWN LIMIT case in
 * invariants.test.ts, which names a summary no syntactic rule can catch. That hole is exactly why
 * this is an advisory reporter, not a proof gate, and why the future scorer exists (see ROADMAP.md).
 *
 * Why it is honest, not fake: `!summary.includes(" and ")` would be a substring ban wearing a
 * proof's clothes (it passes "matrix multiplication, normalization" and "scaled dot-product
 * attention"). This function makes no such claim — it flags enumerations for a human eyeball, and
 * the demotion is a ROUTING change: its boolean result goes to an advisory warning stream
 * (`reportAtomicityWarnings` in `atomicity-report.ts`), never to the build's exit code.
 *
 * Keep the pinned boolean signature and the adversarial tests. Do NOT implement it as `() => true`,
 * do NOT weaken the tests to make it pass, and do NOT promote it to a gate to make a demo look
 * stronger. See the isSingleConcept reframe spec for the full two-layer design.
 */
export function isSingleConcept(concept: Concept): boolean {
  const summary = typeof concept.summary === "string" ? concept.summary.trim().replace(/\s+/g, " ") : "";
  if (summary.length === 0) return true;
  if (summary.includes("&") || summary.includes(";")) return false;

  const tokens = summary.match(/\b[\p{L}\p{N}'-]+\b/gu) ?? [];
  const hasTerminalPunctuation = /[.!?]$/.test(summary);
  const explicitFiniteVerb = /\b(?:is|are|was|were|be|been|being|yields?)\b/i.test(summary);
  const inflectedVerb = tokens.slice(1).some((token) => /(?:es|ed|ing)$/i.test(token));
  const isFullSentence = hasTerminalPunctuation && (explicitFiniteVerb || inflectedVerb);

  if (!isFullSentence && /\b(?:and|or)\b/i.test(summary)) return false;
  if (!isFullSentence && summary.includes(",")) return false;
  return true;
}
