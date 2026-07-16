import type { Concept, ConceptId, Edge, LearningGraph, LessonStep, Source } from "../types";
import { getPath } from "../graph/path";
import {
  danglingEdges,
  findOrphans,
  hasCycle,
  invalidLessonCitations,
  invalidProvenance,
  type LessonCitationIssue,
  pathExists,
} from "../graph/invariants";
import { ALLOWED_LICENSES } from "./manifest";

export const MAX_ATTEMPTS = 3;
export const GOLDEN_PATH: readonly ConceptId[] = [
  "vectors",
  "dot-product",
  "softmax",
  "qkv",
  "self-attention",
] as const;

const GOLDEN_NODES = new Set<ConceptId>(GOLDEN_PATH);
const edgeKey = (edge: Pick<Edge, "from" | "to">): string => `${edge.from}->${edge.to}`;
const PROTECTED_EDGE_KEYS = new Set(
  GOLDEN_PATH.slice(0, -1).map((from, index) => `${from}->${GOLDEN_PATH[index + 1]}`),
);
const isProtectedEdge = (edge: Edge): boolean =>
  edge.type === "prereq" && PROTECTED_EDGE_KEYS.has(edgeKey(edge));

export class GoldenGraphHalt extends Error {
  constructor(message: string) {
    super(`GOLDEN GRAPH HALT: ${message}`);
    this.name = "GoldenGraphHalt";
  }
}

export class GraphConvergenceError extends Error {
  constructor(message: string) {
    super(`graph did not converge after ${MAX_ATTEMPTS} attempts: ${message}`);
    this.name = "GraphConvergenceError";
  }
}

export type ConvergenceIssueKind =
  | "cycle"
  | "dangling"
  | "orphan"
  | "provenance"
  | "lesson-citation"
  | "path"
  | "golden-node"
  | "golden-edge"
  | "golden-order"
  | "concept-floor"
  | "fixture-source"
  | "source";

export interface ConvergenceIssue {
  kind: ConvergenceIssueKind;
  message: string;
  conceptIds?: ConceptId[];
  edges?: Edge[];
  lessonCitationIssues?: LessonCitationIssue[];
}

export interface LessonConvergenceOptions {
  repairLessonCitation?: (
    graph: LearningGraph,
    issue: LessonCitationIssue,
  ) => Promise<LearningGraph>;
}

export class LessonConvergenceError extends Error {
  constructor(public readonly issues: LessonCitationIssue[]) {
    super(
      `lesson citations did not converge: ${issues
        .map((issue) => `${issue.conceptId}[${issue.stepIndex}]:${issue.reason}`)
        .join(", ")}`,
    );
    this.name = "LessonConvergenceError";
  }
}

export function lessonConvergenceIssues(graph: LearningGraph): ConvergenceIssue[] {
  const lessonCitationIssues = invalidLessonCitations(graph);
  if (lessonCitationIssues.length === 0) return [];
  const conceptIds = [...new Set(lessonCitationIssues.map((issue) => issue.conceptId))];
  return [
    {
      kind: "lesson-citation",
      conceptIds,
      lessonCitationIssues,
      message: `${lessonCitationIssues.length} invalid lesson citation issue(s) across ${conceptIds.length} concept(s)`,
    },
  ];
}

function floorStep(concept: Concept, floorIndex: number): LessonStep {
  const summary = concept.summary.trim().replace(/\s+/g, " ") || concept.title;
  const prefix = floorIndex === 0 ? "The main idea is this:" : "Keep this idea in mind:";
  return {
    text: `${prefix} ${summary}`,
    stepTier: "core",
    citation: { ...concept.provenance },
  };
}

export async function convergeLessonCitations(
  graph: LearningGraph,
  options: LessonConvergenceOptions = {},
): Promise<LearningGraph> {
  let candidate: LearningGraph = JSON.parse(JSON.stringify(graph));
  const initialStepIssues = invalidLessonCitations(candidate).filter((issue) => issue.stepIndex >= 0);

  if (options.repairLessonCitation) {
    for (const issue of initialStepIssues) {
      const stillInvalid = invalidLessonCitations(candidate).some(
        (current) =>
          current.conceptId === issue.conceptId && current.stepIndex === issue.stepIndex,
      );
      if (stillInvalid) candidate = await options.repairLessonCitation(candidate, issue);
    }
  }

  const remainingByConcept = new Map<ConceptId, number[]>();
  for (const issue of invalidLessonCitations(candidate)) {
    if (issue.stepIndex < 0) continue;
    const indices = remainingByConcept.get(issue.conceptId) ?? [];
    indices.push(issue.stepIndex);
    remainingByConcept.set(issue.conceptId, indices);
  }

  for (const concept of candidate.concepts) {
    const badIndices = [...new Set(remainingByConcept.get(concept.id) ?? [])].sort(
      (left, right) => right - left,
    );
    for (const stepIndex of badIndices) concept.lesson?.steps.splice(stepIndex, 1);

    if (!concept.lesson) concept.lesson = { plainTitle: concept.title, steps: [] };
    while (concept.lesson.steps.length < 2) {
      concept.lesson.steps.push(floorStep(concept, concept.lesson.steps.length));
    }
  }

  const finalIssues = invalidLessonCitations(candidate);
  if (finalIssues.length > 0) throw new LessonConvergenceError(finalIssues);
  return candidate;
}

export interface ExpectedSource {
  id: string;
  title: string;
  url?: string;
  license: string;
  author: string;
  text: string;
}

export interface ConvergenceOptions {
  minConcepts?: number;
  expectedSources?: ExpectedSource[];
  onAttempt?: (attempt: number, issues: ConvergenceIssue[]) => void;
  repairOrphan?: (
    graph: LearningGraph,
    conceptId: ConceptId,
    frozenIds: readonly ConceptId[],
  ) => Promise<LearningGraph>;
  repairProvenance?: (
    graph: LearningGraph,
    conceptId: ConceptId,
  ) => Promise<LearningGraph>;
}

function findCycleEdges(graph: LearningGraph): Edge[] {
  const adjacency = new Map<ConceptId, Edge[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "prereq") continue;
    const edges = adjacency.get(edge.from) ?? [];
    edges.push(edge);
    edges.sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));
    adjacency.set(edge.from, edges);
  }

  const state = new Map<ConceptId, "visiting" | "visited">();
  const nodeStack: ConceptId[] = [];
  const edgeStack: Edge[] = [];
  let found: Edge[] = [];

  const visit = (id: ConceptId): boolean => {
    state.set(id, "visiting");
    nodeStack.push(id);
    for (const edge of adjacency.get(id) ?? []) {
      const nextState = state.get(edge.to);
      if (nextState === "visiting") {
        const cycleStart = nodeStack.lastIndexOf(edge.to);
        found = [...edgeStack.slice(cycleStart), edge];
        return true;
      }
      if (nextState !== "visited") {
        edgeStack.push(edge);
        if (visit(edge.to)) return true;
        edgeStack.pop();
      }
    }
    nodeStack.pop();
    state.set(id, "visited");
    return false;
  };

  const ids = [...new Set(graph.edges.filter((edge) => edge.type === "prereq").flatMap((edge) => [edge.from, edge.to]))].sort();
  for (const id of ids) {
    if (!state.has(id) && visit(id)) break;
  }
  return found;
}

function sameSource(actual: Source, expected: ExpectedSource): boolean {
  return (
    actual.id === expected.id &&
    actual.title === expected.title &&
    actual.url === expected.url &&
    actual.license === expected.license &&
    actual.author === expected.author &&
    actual.text === expected.text
  );
}

export function convergenceIssues(
  graph: LearningGraph,
  options: Pick<ConvergenceOptions, "minConcepts" | "expectedSources"> = {},
): ConvergenceIssue[] {
  const issues: ConvergenceIssue[] = [];
  const minConcepts = options.minConcepts ?? 6;
  const conceptIds = new Set(graph.concepts.map((concept) => concept.id));

  const missingGolden = GOLDEN_PATH.filter((id) => !conceptIds.has(id));
  if (missingGolden.length > 0) {
    issues.push({
      kind: "golden-node",
      conceptIds: missingGolden,
      message: `missing protected golden nodes: ${missingGolden.join(", ")}`,
    });
  }

  const missingGoldenEdges = GOLDEN_PATH.slice(0, -1)
    .map((from, index): Edge => ({ from, to: GOLDEN_PATH[index + 1], type: "prereq" }))
    .filter(
      (required) =>
        !graph.edges.some(
          (edge) => edge.type === required.type && edge.from === required.from && edge.to === required.to,
        ),
    );
  if (missingGoldenEdges.length > 0) {
    issues.push({
      kind: "golden-edge",
      edges: missingGoldenEdges,
      message: `missing protected golden edges: ${missingGoldenEdges.map(edgeKey).join(", ")}`,
    });
  }

  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    issues.push({ kind: "dangling", edges: dangling, message: `${dangling.length} dangling edges` });
  }
  if (hasCycle(graph)) {
    const cycle = findCycleEdges(graph);
    issues.push({ kind: "cycle", edges: cycle, message: `prerequisite cycle: ${cycle.map(edgeKey).join(", ")}` });
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    issues.push({ kind: "orphan", conceptIds: orphans, message: `orphan concepts: ${orphans.join(", ")}` });
  }
  const badProvenance = invalidProvenance(graph);
  if (badProvenance.length > 0) {
    issues.push({
      kind: "provenance",
      conceptIds: badProvenance,
      message: `invalid provenance: ${badProvenance.join(", ")}`,
    });
  }
  if (!pathExists(graph, "self-attention")) {
    issues.push({ kind: "path", message: "self-attention is not reachable from a prerequisite root" });
  }

  if (missingGolden.length === 0 && !hasCycle(graph)) {
    try {
      const path = getPath(graph, "self-attention");
      const positions = GOLDEN_PATH.map((id) => path.indexOf(id));
      if (positions.some((position) => position < 0) || positions.some((position, index) => index > 0 && position <= positions[index - 1])) {
        issues.push({ kind: "golden-order", message: `golden route is out of order: ${path.join(" -> ")}` });
      }
    } catch (error) {
      issues.push({ kind: "golden-order", message: `golden route cannot be computed: ${String(error)}` });
    }
  }

  if (graph.concepts.length < minConcepts) {
    issues.push({
      kind: "concept-floor",
      message: `concept count ${graph.concepts.length} is below required floor ${minConcepts}`,
    });
  }
  if (minConcepts >= 6 && graph.sources.some((source) => source.title === "How LLMs work (primer)")) {
    issues.push({ kind: "fixture-source", message: "generated graph contains the fixture source title" });
  }
  if (
    graph.sources.length === 0 ||
    graph.sources.some(
      (source) =>
        !ALLOWED_LICENSES.includes(source.license) ||
        typeof source.author !== "string" ||
        source.author.trim().length === 0 ||
        typeof source.text !== "string" ||
        source.text.length === 0,
    )
  ) {
    issues.push({ kind: "source", message: "one or more embedded sources are empty or not allowlisted" });
  }
  if (options.expectedSources) {
    const expected = [...options.expectedSources].sort((left, right) => left.id.localeCompare(right.id));
    const actual = [...graph.sources].sort((left, right) => left.id.localeCompare(right.id));
    if (
      actual.length !== expected.length ||
      actual.some((source, index) => !expected[index] || !sameSource(source, expected[index]))
    ) {
      issues.push({ kind: "source", message: "embedded sources do not exactly match the complete manifest texts" });
    }
  }
  return issues;
}

function dropConcept(graph: LearningGraph, conceptId: ConceptId): LearningGraph {
  return {
    ...graph,
    concepts: graph.concepts.filter((concept) => concept.id !== conceptId),
    edges: graph.edges.filter((edge) => edge.from !== conceptId && edge.to !== conceptId),
  };
}

async function repairOnce(
  graph: LearningGraph,
  issues: ConvergenceIssue[],
  frozenIds: readonly ConceptId[],
  options: ConvergenceOptions,
): Promise<LearningGraph> {
  let repaired: LearningGraph = JSON.parse(JSON.stringify(graph));
  const minConcepts = options.minConcepts ?? 6;

  for (const edge of issues.flatMap((issue) => (issue.kind === "dangling" ? issue.edges ?? [] : []))) {
    if (isProtectedEdge(edge)) {
      throw new GoldenGraphHalt(`protected edge ${edgeKey(edge)} is dangling`);
    }
    repaired.edges = repaired.edges.filter((candidate) => candidate !== edge && edgeKey(candidate) !== edgeKey(edge));
  }

  if (hasCycle(repaired)) {
    const cycle = findCycleEdges(repaired);
    const backEdge = cycle.at(-1);
    const removable =
      backEdge && !isProtectedEdge(backEdge)
        ? backEdge
        : [...cycle]
            .filter((edge) => !isProtectedEdge(edge))
            .sort((left, right) => edgeKey(right).localeCompare(edgeKey(left)))[0];
    if (!removable) {
      throw new GoldenGraphHalt(`cycle contains only protected edges: ${cycle.map(edgeKey).join(", ")}`);
    }
    let removed = false;
    repaired.edges = repaired.edges.filter((edge) => {
      if (!removed && edge.type === removable.type && edgeKey(edge) === edgeKey(removable)) {
        removed = true;
        return false;
      }
      return true;
    });
  }

  for (const conceptId of invalidProvenance(repaired)) {
    if (options.repairProvenance) {
      repaired = await options.repairProvenance(repaired, conceptId);
      if (!invalidProvenance(repaired).includes(conceptId)) continue;
    }
    if (GOLDEN_NODES.has(conceptId)) {
      const concept = repaired.concepts.find((candidate) => candidate.id === conceptId);
      throw new GoldenGraphHalt(
        `unrepairable provenance for ${conceptId}; offending span ${JSON.stringify(concept?.provenance?.quotedText)}`,
      );
    }
    if (repaired.concepts.length - 1 >= minConcepts) repaired = dropConcept(repaired, conceptId);
  }

  for (const conceptId of findOrphans(repaired)) {
    if (options.repairOrphan) {
      repaired = await options.repairOrphan(repaired, conceptId, frozenIds);
      if (!findOrphans(repaired).includes(conceptId)) continue;
    }
    if (GOLDEN_NODES.has(conceptId)) {
      throw new GoldenGraphHalt(`protected golden node ${conceptId} remains orphaned`);
    }
    if (repaired.concepts.length - 1 >= minConcepts) repaired = dropConcept(repaired, conceptId);
  }

  return repaired;
}

export function sortGraph(graph: LearningGraph): LearningGraph {
  return {
    ...graph,
    concepts: [...graph.concepts].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...graph.edges].sort((left, right) =>
      `${left.from}\0${left.to}\0${left.type}`.localeCompare(`${right.from}\0${right.to}\0${right.type}`),
    ),
    sources: [...graph.sources].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export async function convergeGraph(
  graph: LearningGraph,
  options: ConvergenceOptions = {},
): Promise<LearningGraph> {
  let candidate: LearningGraph = JSON.parse(JSON.stringify(graph));
  const frozenIds = candidate.concepts.map((concept) => concept.id);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const issues = convergenceIssues(candidate, options);
    options.onAttempt?.(attempt, issues);
    if (issues.length === 0) return sortGraph(candidate);
    if (issues.some((issue) => issue.kind === "golden-node")) {
      throw new GoldenGraphHalt(issues.find((issue) => issue.kind === "golden-node")?.message ?? "missing golden node");
    }
    candidate = await repairOnce(candidate, issues, frozenIds, options);
  }

  const finalIssues = convergenceIssues(candidate, options);
  if (finalIssues.length === 0) return sortGraph(candidate);
  throw new GraphConvergenceError(finalIssues.map((issue) => `${issue.kind}: ${issue.message}`).join("; "));
}
