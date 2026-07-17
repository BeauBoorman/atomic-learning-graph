// Core data model for the Open Atomic Learning Graph.
// Demo domain: "how LLMs work". Golden goal: `self-attention`.
//
// PROVENANCE IS QUOTE-PRIMARY, NOT OFFSET-PRIMARY.
// The atomizer emits the VERBATIM QUOTE it built a concept from. Locating that quote in the
// source is a deterministic COMPUTATION, not a model CLAIM — so provenance is checkable rather
// than merely present. Offsets are optional hints; an LLM's character arithmetic is not trusted
// and is never load-bearing.

export type ConceptId = string;
export type SourceId = string;
export const PASSION_IDS = [
  "cooking",
  "sports",
  "music",
  "video-games",
  "cars",
  "gardening",
] as const;
export type PassionId = (typeof PASSION_IDS)[number];

/**
 * A source document the graph was atomized FROM. The full `text` is retained so that
 * (a) provenance can be VALIDATED (does the quote actually occur here?) and
 * (b) the UI can RENDER the cited passage. A SourceId with nothing to resolve to is not
 * provenance — it is a citation-shaped string.
 */
export interface Source {
  id: SourceId;
  title: string;
  url?: string;
  /**
   * REQUIRED. The open licence the source is used under, as an EXACT SPDX identifier
   * (e.g. "CC-BY-SA-4.0", "CC-BY-4.0", "CC0-1.0", "public-domain"). The project's whole premise is
   * openly (5R) licensed OER, and the full source `text` is embedded in a PUBLIC repo — shipping
   * that with no licence recorded is both a legal exposure and a credibility hole in the exact
   * claim being made.
   *
   * ENFORCED AT INGESTION, not here: TypeScript cannot check a string, and `loadGraph()` casts
   * parsed JSON. The gate is `ALLOWED_LICENSES` / `validateManifest` in
   * `src/atomization/manifest.ts` — the atomizer refuses any source whose licence is absent or not
   * on the vetted allowlist. This field carries that vetted value through into the shipped graph.
   */
  license: string;
  /** Required attribution for the openly licensed source. */
  author: string;
  /** Full source text. The ground truth every quote is checked against. */
  text: string;
}

/**
 * Where a node was atomized from.
 *
 * `quotedText` is the CONTRACT: it must be a substantial content-bearing span and occur in the
 * referenced Source, compared after whitespace normalization (a raw substring match is byte-exact
 * and will false-fail on any source whose whitespace differs from the model's rendering of the
 * quote). If it is too weak or does not occur, the node is invalid. That check is the demo's
 * credibility claim, and it is a boolean, on camera.
 *
 * SCOPE — state this honestly, a judge may ask: a sufficiently strong quote occurring in the source
 * proves the receipt is a real passage, not a stopword-shaped token. It does not prove the node's
 * interpretation is CORRECT. Correctness is what the rest of the invariant suite and the algebra
 * reconstruction test are for. Do not overclaim it.
 */
export interface Provenance {
  sourceId: SourceId;
  /** Verbatim quote from the source. REQUIRED. This is the thing that gets verified. */
  quotedText: string;
  /** Sentence(s) before the quote, so the UI can show it in context. */
  contextPrefix?: string;
  /** Sentence(s) after the quote. */
  contextSuffix?: string;
  /** HINT ONLY — a fast path for locating the quote. Never trusted, never validated against. */
  estimatedStartOffset?: number;
  /** HINT ONLY. See above. */
  estimatedEndOffset?: number;
}

export type EdgeType = "prereq" | "method" | "related";

export interface Edge {
  from: ConceptId;
  to: ConceptId;
  type: EdgeType;
}

/**
 * One page of AI-translated lesson prose. `text` is plain-language translation, NOT a verbatim
 * quote and NOT machine-proven to be a faithful paraphrase. What the machine proves is narrower:
 * this exact on-screen unit carries a co-located, verbatim citation that resolves against the
 * openly licensed source text. `invalidLessonCitations` enforces that boundary per step.
 */
export interface LessonStep {
  text: string;
  /** Within-concept depth. The quick path renders core steps; deep steps are enrichment. */
  stepTier: "core" | "deep";
  /** Validated by the same quote-grounding predicate as `Concept.provenance`. */
  citation: Provenance;
  /**
   * Optional build-time illustrations for the learner's selected passion. These are explicitly
   * analogies, not source claims, and are deliberately outside `invalidLessonCitations`. A failed
   * passion is omitted without affecting the lesson or build.
   */
  analogies?: Partial<Record<PassionId, string>>;
}

export interface Lesson {
  /** Jargon-free title shown on the lesson page. */
  plainTitle: string;
  /** Two to four ordered pages; every page must be independently grounded. */
  steps: LessonStep[];
}

export type RenderingFormat = "what-it-is" | "why-it-exists" | "how-it-works";
export type AlternateFormat = Exclude<RenderingFormat, "what-it-is">;

/**
 * One concept, many renderings. The concept's own `lesson` is the "what-it-is" rendering; it lives
 * in graph.json and is gated by `invalidLessonCitations`. renderings.json carries only alternates.
 * Analogies are intentionally unset on renderings in v1: `parseLesson` strips them through its
 * exact-keys contract, and that is expected, not a bug.
 */
export interface Rendering {
  conceptId: ConceptId;
  format: AlternateFormat;
  plainTitle: string;
  steps: LessonStep[];
}

export interface RenderingSet {
  renderings: Rendering[];
}

/**
 * A canonical node in the graph: exactly ONE self-contained concept or skill.
 *
 * DELIBERATELY CARRIES NO RELATIONS. `LearningGraph.edges[]` is the SINGLE SOURCE OF TRUTH for
 * every relation (prereq / method / related). The previous model expressed the prereq relation
 * TWICE — here and in `edges[]` — with nothing forcing them to agree; on a generated graph they
 * WILL diverge, and a green invariant suite would then prove nothing. To get a concept's
 * prerequisites, DERIVE them from edges. Do not re-add a relations field here.
 */
export interface Concept {
  id: ConceptId;
  title: string;
  /** One-concept summary. Must not describe two things ("X and Y" is a smell). */
  summary: string;
  provenance: Provenance;
  tags: string[];
  /** Optional only for fixture ergonomics; `invalidLessonCitations` requires it at build time. */
  lesson?: Lesson;
}

export interface LearningGraph {
  concepts: Concept[];
  /** The ONLY source of truth for relations between concepts. */
  edges: Edge[];
  /** Every Source that any provenance refers to. Embedded so the UI renders passages offline. */
  sources: Source[];
  /** The node the demo path terminates at. */
  goalId: ConceptId;
}

/**
 * RAW ATOMIZER OUTPUT — exactly what GPT-5.6 is asked to emit per node, before the build step.
 *
 * The model emits relations PER NODE (natural for an LLM); the build step converts them into
 * the canonical `edges[]`. The model NEVER emits edges directly and NEVER emits a whole graph.
 *
 * This type IS the prompt contract. Changing it changes what the atomization run must produce —
 * and the atomization run is what the API credits get spent on. Settle it before spending.
 */
export interface AtomizedConcept {
  id: ConceptId;
  title: string;
  summary: string;
  provenance: Provenance;
  tags: string[];
  /** Converted into `prereq` edges by the build step. */
  prerequisites: ConceptId[];
  /** Converted into `related` edges by the build step. */
  related: ConceptId[];
}

export type NodeProgress = "exploring" | "got-it" | "stuck";

export interface LearnerState {
  goal: ConceptId;
  known: ConceptId[];
  progress: Record<ConceptId, NodeProgress>;
}
