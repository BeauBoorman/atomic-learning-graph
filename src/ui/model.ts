import type { Concept, ConceptId, LearningGraph, Source } from "../types";
import { getPath } from "../graph/path";

export interface ResolvedPassage {
  concept: Concept;
  source: Source;
  /** The complete source paragraph/line that contains the verified quote. */
  passage: string;
  /** Nearby source paragraphs, including the passage, for the expandable transcript. */
  context: string;
}

export function pathFor(graph: LearningGraph, known: ConceptId[]): ConceptId[] {
  return getPath(graph, graph.goalId, known);
}

export function markUnderstood(
  graph: LearningGraph,
  known: ConceptId[],
  conceptId: ConceptId,
): { known: ConceptId[]; path: ConceptId[] } {
  const nextKnown = known.includes(conceptId) ? known : [...known, conceptId];
  return { known: nextKnown, path: getPath(graph, graph.goalId, nextKnown) };
}

export function resolveLesson(graph: LearningGraph, conceptId: ConceptId): ResolvedPassage {
  const concept = graph.concepts.find((candidate) => candidate.id === conceptId);
  if (!concept) throw new Error(`unknown lesson concept: ${conceptId}`);

  const source = graph.sources.find(
    (candidate) => candidate.id === concept.provenance.sourceId,
  );
  if (!source) throw new Error(`missing source: ${concept.provenance.sourceId}`);

  const quote = concept.provenance.quotedText;
  const quoteStart = source.text.indexOf(quote);
  if (quoteStart < 0) return { concept, source, passage: quote, context: quote };

  const passageStart = source.text.lastIndexOf("\n", quoteStart - 1) + 1;
  const passageEndMatch = source.text.indexOf("\n", quoteStart + quote.length);
  const passageEnd = passageEndMatch < 0 ? source.text.length : passageEndMatch;
  const passage = source.text.slice(passageStart, passageEnd).trim();

  const lines = source.text.split("\n");
  const passageLine = source.text.slice(0, passageStart).split("\n").length - 1;
  const context = lines
    .slice(Math.max(0, passageLine - 2), Math.min(lines.length, passageLine + 3))
    .join("\n")
    .trim();

  return { concept, source, passage, context };
}
