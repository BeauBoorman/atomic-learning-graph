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
   * REQUIRED. The open licence the source is used under (e.g. "CC-BY-SA 3.0", "CC-BY 4.0",
   * "public domain"). The project's whole premise is openly (5R) licensed OER, and the full
   * source `text` is embedded in a PUBLIC repo — shipping that with no licence recorded is both
   * a legal exposure and a credibility hole in the exact claim being made.
   */
  license: string;
  /** Full source text. The ground truth every quote is checked against. */
  text: string;
}

/**
 * Where a node was atomized from.
 *
 * `quotedText` is the CONTRACT: it must occur in the referenced Source, compared after
 * whitespace normalization (a raw substring match is byte-exact and will false-fail on any
 * source whose whitespace differs from the model's rendering of the quote). If it does not
 * occur, the node is invalid and the atomizer hallucinated it. That check is the demo's
 * credibility claim, and it is a boolean, on camera.
 *
 * SCOPE — state this honestly, a judge may ask: a quote occurring in the source proves the node
 * is NOT FABRICATED. It does not prove the node is CORRECT. Correctness is what the rest of the
 * invariant suite and the algebra reconstruction test are for. Do not overclaim it.
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

export type RenderingFormat = "90-sec" | "deep" | "eli5";

/** A presentation of a canonical concept. One concept, many renderings. */
export interface Rendering {
  id: string;
  conceptId: ConceptId;
  format: RenderingFormat;
  body: string;
  provenance: Provenance;
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
}

export interface LearningGraph {
  concepts: Concept[];
  /** The ONLY source of truth for relations between concepts. */
  edges: Edge[];
  renderings: Rendering[];
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
