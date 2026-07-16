import type { Concept, ConceptId, LearningGraph, Source } from "../types";
import { getPath } from "../graph/path";

export interface Lesson {
  concept: Concept;
  source: Source;
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

export function resolveLesson(graph: LearningGraph, conceptId: ConceptId): Lesson {
  const concept = graph.concepts.find((candidate) => candidate.id === conceptId);
  if (!concept) throw new Error(`unknown lesson concept: ${conceptId}`);

  const source = graph.sources.find(
    (candidate) => candidate.id === concept.provenance.sourceId,
  );
  if (!source) throw new Error(`missing source: ${concept.provenance.sourceId}`);

  const quote = concept.provenance.quotedText;
  const quoteStart = source.text.indexOf(quote);
  const context = quoteStart < 0
    ? quote
    : source.text.slice(
        Math.max(0, quoteStart - 180),
        Math.min(source.text.length, quoteStart + quote.length + 180),
      ).trim();

  return { concept, source, context };
}
