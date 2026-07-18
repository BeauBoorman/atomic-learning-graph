// Deterministic llms.txt emit target. This module reads committed build artifacts and README copy;
// it never calls a model, reaches the network, or authors per-concept prose. Concept summaries,
// lessons, quotes, and alternate renderings are emitted verbatim from their gated artifacts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  danglingEdges,
  duplicateConceptIds,
  duplicateSourceIds,
  findOrphans,
  hasCycle,
  invalidLessonCitations,
  invalidProvenance,
  invalidRenderingCitations,
} from "../src/graph/invariants";
import { loadGraph, loadRenderingsForVerification } from "../src/graph/load";
import { topologicalConceptOrder } from "../src/graph/path";
import type {
  AlternateFormat,
  Concept,
  LearningGraph,
  LessonStep,
  Rendering,
  RenderingSet,
} from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");
const README_PATH = resolve(repoRoot, "README.md");

export const LLMS_PATHS = {
  index: resolve(repoRoot, "llms.txt"),
  full: resolve(repoRoot, "llms-full.txt"),
} as const;

export interface LlmsArtifacts {
  index: string;
  full: string;
}

export interface LlmsPaths {
  index: string;
  full: string;
}

function projectCopy(readme: string): { title: string; thesis: string } {
  const withoutComments = readme.replace(/<!--[\s\S]*?-->/gu, "");
  const lines = withoutComments.split(/\r?\n/u);
  const titleIndex = lines.findIndex((line) => /^#\s+\S/u.test(line));
  if (titleIndex < 0) throw new Error("README.md has no project H1");
  const title = lines[titleIndex].replace(/^#\s+/u, "");

  let cursor = titleIndex + 1;
  while (cursor < lines.length && lines[cursor].trim().length === 0) cursor += 1;
  const thesisLines: string[] = [];
  while (
    cursor < lines.length &&
    lines[cursor].trim().length > 0 &&
    !/^#{1,6}\s/u.test(lines[cursor])
  ) {
    thesisLines.push(lines[cursor]);
    cursor += 1;
  }
  if (thesisLines.length === 0) throw new Error("README.md has no thesis paragraph after its H1");
  return { title, thesis: thesisLines.join(" ") };
}

function assertStructurallyEmittable(graph: LearningGraph): void {
  const duplicateConcepts = duplicateConceptIds(graph);
  if (duplicateConcepts.length > 0) {
    throw new Error(`refusing llms emit with duplicate concept IDs: ${duplicateConcepts.join(", ")}`);
  }
  const duplicateSources = duplicateSourceIds(graph);
  if (duplicateSources.length > 0) {
    throw new Error(`refusing llms emit with duplicate source IDs: ${duplicateSources.join(", ")}`);
  }
  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    throw new Error(`refusing llms emit with ${dangling.length} dangling edge(s)`);
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    throw new Error(`refusing llms emit with orphan concept(s): ${orphans.join(", ")}`);
  }
  if (hasCycle(graph)) throw new Error("refusing llms emit with a prerequisite cycle");
}

function markdownQuote(value: string): string {
  return value.split(/\r?\n/u).map((line) => `> ${line}`).join("\n");
}

function anchorFor(id: string): string {
  return encodeURIComponent(id);
}

function renderCitation(step: LessonStep): string {
  return `${step.text}\n\nSource: \`${step.citation.sourceId}\`\n\n${markdownQuote(step.citation.quotedText)}`;
}

const FORMAT_LABELS: Record<AlternateFormat, string> = {
  "why-it-exists": "Why it exists",
  "how-it-works": "How it works",
};

const FORMAT_ORDER: Record<AlternateFormat, number> = {
  "why-it-exists": 0,
  "how-it-works": 1,
};

function renderLesson(title: string, steps: LessonStep[]): string {
  return [`#### ${title}`, ...steps.map(renderCitation)].join("\n\n");
}

function renderConcept(concept: Concept, renderings: Rendering[]): string {
  const anchor = anchorFor(concept.id);
  const lesson = concept.lesson;
  if (!lesson) throw new Error(`validated concept ${concept.id} has no lesson`);

  const sections = [
    `<a id="${anchor}"></a>`,
    `### ${concept.title}`,
    concept.summary,
    `Source: \`${concept.provenance.sourceId}\``,
    markdownQuote(concept.provenance.quotedText),
    renderLesson(`What it is: ${lesson.plainTitle}`, lesson.steps),
    ...renderings.map((rendering) =>
      renderLesson(`${FORMAT_LABELS[rendering.format]}: ${rendering.plainTitle}`, rendering.steps)
    ),
  ];
  return sections.join("\n\n");
}

/** Generate both artifacts entirely in memory so a validation failure cannot partially write. */
export function emitLlmsArtifacts(
  graph: LearningGraph,
  renderingSet: RenderingSet,
  readme: string,
): LlmsArtifacts {
  assertStructurallyEmittable(graph);
  const renderingIssues = invalidRenderingCitations(graph, renderingSet);
  if (renderingIssues.length > 0) {
    throw new Error(`refusing llms emit with ${renderingIssues.length} invalid rendering citation(s)`);
  }

  const invalidConcepts = new Set(invalidProvenance(graph));
  for (const issue of invalidLessonCitations(graph)) invalidConcepts.add(issue.conceptId);

  const conceptById = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const orderedConcepts = topologicalConceptOrder(graph)
    .map((id) => conceptById.get(id))
    .filter((concept): concept is Concept => concept !== undefined && !invalidConcepts.has(concept.id));
  const validConceptIds = new Set(orderedConcepts.map(({ id }) => id));

  const renderingsByConcept = new Map<string, Rendering[]>();
  for (const rendering of renderingSet.renderings) {
    if (!validConceptIds.has(rendering.conceptId)) continue;
    const current = renderingsByConcept.get(rendering.conceptId) ?? [];
    current.push(rendering);
    renderingsByConcept.set(rendering.conceptId, current);
  }
  for (const renderings of renderingsByConcept.values()) {
    renderings.sort((left, right) => FORMAT_ORDER[left.format] - FORMAT_ORDER[right.format]);
  }

  const { title, thesis } = projectCopy(readme);
  const indexLines = [
    `# ${title}`,
    "",
    `> ${thesis}`,
    "",
    "## Concepts in prerequisite order",
    "",
    ...orderedConcepts.map((concept) => {
      const link = `- [${concept.title}](llms-full.txt#${anchorFor(concept.id)})`;
      return typeof concept.summary === "string" && concept.summary.length > 0
        ? `${link}: ${concept.summary}`
        : link;
    }),
    "",
  ];

  const fullSections = [
    `# ${title}`,
    `> ${thesis}`,
    "## Concepts in prerequisite order",
    ...orderedConcepts.map((concept) =>
      renderConcept(concept, renderingsByConcept.get(concept.id) ?? [])
    ),
  ];

  return {
    index: indexLines.join("\n"),
    full: `${fullSections.join("\n\n")}\n`,
  };
}

export function writeLlmsArtifacts(
  artifacts: LlmsArtifacts,
  paths: LlmsPaths = LLMS_PATHS,
): void {
  writeFileSync(paths.index, artifacts.index, "utf8");
  writeFileSync(paths.full, artifacts.full, "utf8");
}

export function verifyLlmsArtifacts(
  expected: LlmsArtifacts,
  paths: LlmsPaths = LLMS_PATHS,
): void {
  for (const [label, path, bytes] of [
    ["llms.txt", paths.index, expected.index],
    ["llms-full.txt", paths.full, expected.full],
  ] as const) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== bytes) {
      throw new Error(`${label} is not the exact graph-derived artifact; run pnpm emit:llms`);
    }
  }
}

function currentArtifacts(): LlmsArtifacts {
  return emitLlmsArtifacts(
    loadGraph(),
    loadRenderingsForVerification(),
    readFileSync(README_PATH, "utf8"),
  );
}

function main(): void {
  const artifacts = currentArtifacts();
  if (process.argv.slice(2).includes("--verify")) {
    verifyLlmsArtifacts(artifacts);
    console.log("Verified llms.txt and llms-full.txt against committed graph-derived bytes.");
    return;
  }
  writeLlmsArtifacts(artifacts);
  console.log("Emitted llms.txt and llms-full.txt from committed graph and renderings.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
