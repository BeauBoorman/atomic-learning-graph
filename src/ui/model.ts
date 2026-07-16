import type {
  Concept,
  ConceptId,
  LearningGraph,
  Provenance,
  Source,
} from "../types";
import { getPath } from "../graph/path";

export type Depth = "quick" | "thorough";

export interface CoursePage {
  conceptId: ConceptId;
  stepIndex: number;
}

export interface CourseProgress {
  remaining: CoursePage[];
  completeCount: number;
  total: number;
  percent: number;
  complete: boolean;
}

export interface ResolvedPassage {
  concept: Concept;
  source: Source;
  quote: string;
  /** A short source span containing the verified quote. */
  passage: string;
  /** Nearby source material for the citation disclosure. */
  context: string;
}

export const DEEPDIVES_KEY = "atomic-learning-graph.deep-dives.v1";

export function pathFor(
  graph: LearningGraph,
  goalId: ConceptId,
  known: ConceptId[],
): ConceptId[] {
  return getPath(graph, goalId, known);
}

export function markUnderstood(
  graph: LearningGraph,
  goalId: ConceptId,
  known: ConceptId[],
  conceptId: ConceptId,
): { known: ConceptId[]; path: ConceptId[] } {
  const nextKnown = known.includes(conceptId) ? known : [...known, conceptId];
  return { known: nextKnown, path: getPath(graph, goalId, nextKnown) };
}

function pagesFor(graph: LearningGraph, conceptIds: ConceptId[], depth: Depth): CoursePage[] {
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  return conceptIds.flatMap((conceptId) => {
    const steps = concepts.get(conceptId)?.lesson?.steps ?? [];
    return steps.flatMap((step, stepIndex) =>
      depth === "thorough" || step.stepTier === "core" ? [{ conceptId, stepIndex }] : []
    );
  });
}

/**
 * Builds the learner-facing pages from the deterministic path. The quick course contains only
 * core pages on the prerequisite spine. Thorough mode keeps every spine page and appends every
 * one-hop related concept as optional enrichment. Completed enrichment is filtered separately;
 * it never enters the prerequisite `known` set.
 */
export function courseFor(
  graph: LearningGraph,
  goalId: ConceptId,
  depth: Depth,
  known: ConceptId[],
): CoursePage[] {
  const fullSpine = pathFor(graph, goalId, []);
  const remainingSpine = new Set(pathFor(graph, goalId, known));
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const spinePages = fullSpine.flatMap((conceptId) => {
    const steps = concepts.get(conceptId)?.lesson?.steps ?? [];
    return steps.flatMap((step, stepIndex) => {
      const include = depth === "quick"
        ? remainingSpine.has(conceptId) && step.stepTier === "core"
        : step.stepTier === "deep" || remainingSpine.has(conceptId);
      return include ? [{ conceptId, stepIndex }] : [];
    });
  });
  if (depth === "quick") return spinePages;

  const spineIds = new Set(fullSpine);
  const relatedIds = new Set<ConceptId>();
  for (const edge of graph.edges) {
    if (edge.type !== "related") continue;
    if (spineIds.has(edge.from) && !spineIds.has(edge.to)) relatedIds.add(edge.to);
    if (spineIds.has(edge.to) && !spineIds.has(edge.from)) relatedIds.add(edge.from);
  }
  const conceptOrder = new Map(graph.concepts.map((concept, index) => [concept.id, index]));
  const related = [...relatedIds].sort(
    (left, right) => (conceptOrder.get(left) ?? Infinity) - (conceptOrder.get(right) ?? Infinity),
  );
  return [...spinePages, ...pagesFor(graph, related, "thorough")];
}

export function coursePageKey(page: CoursePage): string {
  return `${page.conceptId}:${page.stepIndex}`;
}

/** One source for every progress readout and for the completion boundary. */
export function deriveProgress(
  graph: LearningGraph,
  known: ConceptId[],
  goalId: ConceptId = graph.goalId,
  depth: Depth = "quick",
  completedPageKeys: string[] = [],
): CourseProgress {
  const total = courseFor(graph, goalId, depth, []).length;
  const completed = new Set(completedPageKeys);
  const remaining = courseFor(graph, goalId, depth, known).filter(
    (page) => !completed.has(coursePageKey(page)),
  );
  const completeCount = Math.max(0, total - remaining.length);
  return {
    remaining,
    completeCount,
    total,
    percent: total === 0 ? 100 : Math.round((completeCount / total) * 100),
    complete: remaining.length === 0,
  };
}

function findConcept(graph: LearningGraph, conceptId: ConceptId): Concept {
  const concept = graph.concepts.find((candidate) => candidate.id === conceptId);
  if (!concept) throw new Error(`unknown lesson concept: ${conceptId}`);
  return concept;
}

function sentenceAround(text: string, quoteStart: number, quoteLength: number): string {
  const before = text.slice(0, quoteStart);
  const boundary = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("? "),
    before.lastIndexOf("! "),
    before.lastIndexOf("\n"),
  );
  const passageStart = boundary < 0 ? 0 : boundary + (text[boundary] === "\n" ? 1 : 2);
  const afterStart = quoteStart + quoteLength;
  const after = text.slice(afterStart);
  const nextMatch = after.match(/[.!?](?:\s|$)|\n/);
  const passageEnd = nextMatch?.index === undefined
    ? text.length
    : afterStart + nextMatch.index + (after[nextMatch.index] === "\n" ? 0 : 1);
  return text.slice(passageStart, passageEnd).trim();
}

function resolvePassage(
  graph: LearningGraph,
  concept: Concept,
  citation: Provenance,
): ResolvedPassage {
  const matches = graph.sources.filter((candidate) => candidate.id === citation.sourceId);
  if (matches.length !== 1) throw new Error(`missing or ambiguous source: ${citation.sourceId}`);
  const source = matches[0];
  const quote = citation.quotedText;
  const quoteStart = source.text.indexOf(quote);
  const passage = quoteStart < 0 ? quote : sentenceAround(source.text, quoteStart, quote.length);
  const context = [citation.contextPrefix, passage, citation.contextSuffix]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();
  return { concept, source, quote, passage, context: context || passage };
}

export function resolveLesson(graph: LearningGraph, conceptId: ConceptId): ResolvedPassage {
  const concept = findConcept(graph, conceptId);
  return resolvePassage(graph, concept, concept.provenance);
}

export function resolveCitation(
  graph: LearningGraph,
  conceptId: ConceptId,
  stepIndex: number,
): ResolvedPassage {
  const concept = findConcept(graph, conceptId);
  const step = concept.lesson?.steps[stepIndex];
  if (!step) throw new Error(`unknown lesson page: ${conceptId}:${stepIndex}`);
  return resolvePassage(graph, concept, step.citation);
}
