// Core data model for the Open Atomic Learning Graph.
// Demo domain: "how LLMs work". Golden goal: `self-attention`.
//
// Invariant: every Concept carries deterministic provenance captured AT ATOMIZATION TIME
// (source id + char offsets), never a post-hoc model "citation" call.

export type ConceptId = string;
export type SourceId = string;

/** Where a node was atomized from — captured from the segmentation step's own indices. */
export interface Provenance {
  sourceId: SourceId;
  /** Char offset into the source doc where this concept's span begins (inclusive). */
  startOffset: number;
  /** Char offset where it ends (exclusive). Must be > startOffset. */
  endOffset: number;
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

/** A canonical node in the graph: exactly ONE self-contained concept or skill. */
export interface Concept {
  id: ConceptId;
  title: string;
  /** One-concept summary. Must not describe two things ("X and Y" is a smell). */
  summary: string;
  prerequisites: ConceptId[];
  related: ConceptId[];
  provenance: Provenance;
  tags: string[];
}

export interface LearningGraph {
  concepts: Concept[];
  edges: Edge[];
  renderings: Rendering[];
  /** The node the demo path terminates at. */
  goalId: ConceptId;
}

export type NodeProgress = "exploring" | "got-it" | "stuck";

export interface LearnerState {
  goal: ConceptId;
  known: ConceptId[];
  progress: Record<ConceptId, NodeProgress>;
}
