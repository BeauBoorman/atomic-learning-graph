import type {
  Concept,
  ConceptId,
  LearningGraph,
  Provenance,
  Rendering,
  Source,
} from "../types";
import { getPath } from "../graph/path";
import { titleFor } from "./titles";

export type Depth = "quick" | "thorough";

export interface CoursePage {
  conceptId: ConceptId;
  stepIndex: number;
}

export interface CourseProgress {
  /** Every page of this course, in order, whatever the learner has done. Never shrinks. */
  pages: CoursePage[];
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

export function pathFor(
  graph: LearningGraph,
  goalId: ConceptId,
  known: ConceptId[],
): ConceptId[] {
  return getPath(graph, goalId, known);
}

/** The entry-screen choices for one goal, in the same deterministic order as the route. */
export function prerequisitesForGoal(
  graph: LearningGraph,
  goalId: ConceptId,
): ConceptId[] {
  return pathFor(graph, goalId, []).filter((conceptId) => conceptId !== goalId);
}

/** Keep a declaration only when it is still relevant to the newly selected goal. */
export function knownForGoal(
  graph: LearningGraph,
  goalId: ConceptId,
  known: ConceptId[],
): ConceptId[] {
  const offered = new Set(prerequisitesForGoal(graph, goalId));
  return known.filter((conceptId) => offered.has(conceptId));
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
      // The entry checkbox promises "Skip this prerequisite". Both depths honor it: a declared-
      // known concept contributes NO pages. Thorough previously kept its deep pages, so the very
      // first page of a thorough course could be the concept the learner just said they knew.
      const include = remainingSpine.has(conceptId)
        && (depth === "quick" ? step.stepTier === "core" : true);
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

/** One source for every progress readout and for the completion boundary.
 *  The course page list is a pure function of {goal, depth, known}. It NEVER shrinks under the
 *  learner. Completion is a recorded fact, not a length difference — the old form inferred
 *  it from `total - remaining.length`, which conflated "you already knew this" with
 *  "you completed this" and opened fresh courses at Page 3 of 8, 25%. */
export function deriveProgress(
  graph: LearningGraph,
  goalId: ConceptId = graph.goalId,
  depth: Depth = "quick",
  completedPageKeys: string[] = [],
  known: ConceptId[] = [],
): CourseProgress {
  // `known` is captured before this course starts. It is fixed course input, never inferred
  // from `completedPageKeys` and never changed by finishing a page.
  const pages = courseFor(graph, goalId, depth, known);
  const completed = new Set(completedPageKeys);
  const done = pages.filter((page) => completed.has(coursePageKey(page)));
  const remaining = pages.filter((page) => !completed.has(coursePageKey(page)));
  const total = pages.length;
  return {
    pages,
    remaining,
    completeCount: done.length,
    total,
    percent: total === 0 ? 100 : Math.round((done.length / total) * 100),
    complete: remaining.length === 0,
  };
}

/** Derive the map's covered styling; do not store a second progress fact. A concept is
 *  covered by this course when it was declared known before the course or every page of it IN
 *  THIS COURSE is recorded. This is course progress, never a comprehension claim. */
export function coveredConcepts(
  graph: LearningGraph,
  goalId: ConceptId,
  depth: Depth,
  completedPageKeys: string[],
  known: ConceptId[] = [],
): ConceptId[] {
  const completed = new Set(completedPageKeys);
  const byConcept = new Map<ConceptId, CoursePage[]>();
  for (const page of courseFor(graph, goalId, depth, known)) {
    byConcept.set(page.conceptId, [...(byConcept.get(page.conceptId) ?? []), page]);
  }
  const completedConcepts = [...byConcept]
    .filter(([, pages]) => pages.every((page) => completed.has(coursePageKey(page))))
    .map(([conceptId]) => conceptId);
  return [...new Set([...known, ...completedConcepts])];
}

/** A domain-claim-free invitation computed only from the two concepts at a prerequisite edge. */
export function selfExplanationPrompt(concept: Concept, prerequisite: Concept): string {
  return `You just read "${titleFor(prerequisite)}". Next is "${titleFor(concept)}" — in your own words, how does the second build on the first?`;
}

export function selfExplanationPromptId(
  conceptId: ConceptId,
  prerequisiteId: ConceptId,
): string {
  return `${encodeURIComponent(conceptId)}:${encodeURIComponent(prerequisiteId)}`;
}

export interface CourseSelfExplanationPrompt {
  id: string;
  pageKey: string;
  prompt: string;
}

/** The optional questions this course actually presents, in route order. They are derived from
 *  direct prerequisite transitions only and remain entirely separate from progress/coverage. */
export function courseSelfExplanationPrompts(
  graph: LearningGraph,
  pages: CoursePage[],
): CourseSelfExplanationPrompt[] {
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const prompts: CourseSelfExplanationPrompt[] = [];

  for (const [index, page] of pages.entries()) {
    const previousPage = index > 0 ? pages[index - 1] : undefined;
    if (!previousPage || previousPage.conceptId === page.conceptId) continue;
    const isDirectPrerequisite = graph.edges.some((edge) => (
      edge.type === "prereq"
      && edge.from === previousPage.conceptId
      && edge.to === page.conceptId
    ));
    if (!isDirectPrerequisite) continue;
    const concept = concepts.get(page.conceptId);
    const prerequisite = concepts.get(previousPage.conceptId);
    if (!concept || !prerequisite) continue;
    prompts.push({
      id: selfExplanationPromptId(concept.id, prerequisite.id),
      pageKey: coursePageKey(page),
      prompt: selfExplanationPrompt(concept, prerequisite),
    });
  }

  return prompts;
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

/** Resolve one pre-built alternate step against the same embedded source corpus as the home
 *  lesson. The rendering gate has already proved the quote; this keeps the browser path pure. */
export function resolveRenderingCitation(
  graph: LearningGraph,
  rendering: Rendering,
  stepIndex: number,
): ResolvedPassage {
  const concept = findConcept(graph, rendering.conceptId);
  const step = rendering.steps[stepIndex];
  if (!step) {
    throw new Error(
      `unknown rendering page: ${rendering.conceptId}:${rendering.format}:${stepIndex}`,
    );
  }
  return resolvePassage(graph, concept, step.citation);
}
