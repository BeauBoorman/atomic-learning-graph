// Deterministic, idiomatic Obsidian-vault emit target. This module reads the committed graph
// artifact; it never calls a model, reaches the network, or authors per-concept prose. Concept
// summaries, quotes, and provenance are emitted verbatim from the gated graph.
//
// The layout is native Obsidian, derived entirely from graph structure (no hardcoded concept ids):
//   Start Here.md        — prerequisite-ordered entry note
//   Concepts/<id>.md     — one note per concept, lesson + cited source receipts
//   Sources/<id>.md      — one hub note per cited source, with attribution + backlinks
// Every concept<->concept relation (prereq/method/related) and every concept->source citation is a
// path-qualified [[wikilink]], so Obsidian's graph view and backlinks resolve for ANY course, and
// relations are also exposed as Dataview-queryable frontmatter link properties.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  danglingEdges,
  duplicateConceptIds,
  duplicateSourceIds,
  findOrphans,
  hasCycle,
  invalidLessonCitations,
  invalidProvenance,
} from "../src/graph/invariants";
import { loadGraph } from "../src/graph/load";
import { topologicalConceptOrder } from "../src/graph/path";
import { licenseDeedUrl, licenseWithDeed } from "./export-attribution";
import type { Concept, LearningGraph, LessonStep, Source } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");

export const OBSIDIAN_PATH = resolve(repoRoot, "exports", "obsidian");
export const OBSIDIAN_START_HERE = "Start Here.md";
export const OBSIDIAN_CONCEPTS_DIR = "Concepts";
export const OBSIDIAN_SOURCES_DIR = "Sources";

export interface ObsidianNote {
  filename: string;
  bytes: string;
}

function assertStructurallyEmittable(graph: LearningGraph): void {
  const duplicateConcepts = duplicateConceptIds(graph);
  if (duplicateConcepts.length > 0) {
    throw new Error(
      `refusing Obsidian emit with duplicate concept IDs: ${duplicateConcepts.join(", ")}`,
    );
  }
  const duplicateSources = duplicateSourceIds(graph);
  if (duplicateSources.length > 0) {
    throw new Error(
      `refusing Obsidian emit with duplicate source IDs: ${duplicateSources.join(", ")}`,
    );
  }
  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    throw new Error(`refusing Obsidian emit with ${dangling.length} dangling edge(s)`);
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    throw new Error(`refusing Obsidian emit with orphan concept(s): ${orphans.join(", ")}`);
  }
  if (hasCycle(graph)) throw new Error("refusing Obsidian emit with a prerequisite cycle");
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function conceptFilePath(conceptId: string): string {
  return `${OBSIDIAN_CONCEPTS_DIR}/${conceptId}.md`;
}

function sourceFilePath(sourceId: string): string {
  return `${OBSIDIAN_SOURCES_DIR}/${sourceId}.md`;
}

// Path-qualified so a course whose concept id equals a source id still resolves unambiguously.
function conceptTarget(conceptId: string): string {
  return `${OBSIDIAN_CONCEPTS_DIR}/${conceptId}`;
}

function sourceTarget(sourceId: string): string {
  return `${OBSIDIAN_SOURCES_DIR}/${sourceId}`;
}

function conceptDisplayLink(concept: Concept): string {
  return `[[${conceptTarget(concept.id)}|${concept.title}]]`;
}

function sourceDisplayLink(source: Source): string {
  return `[[${sourceTarget(source.id)}|${source.title}]]`;
}

function normalizeTag(tag: string): string {
  return tag.replace(/\s+/gu, "-");
}

function markdownQuote(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function modificationNotice(source: Source): string {
  return (
    `Adapted (translated to plain English; atomized into concept lessons) from ${source.title} ` +
    `by ${source.author}, ${licenseWithDeed(source.license)}.`
  );
}

// A YAML list of link-typed frontmatter properties (Obsidian + Dataview read these as links).
function frontmatterLinkList(key: string, targets: readonly string[]): string[] {
  if (targets.length === 0) return [];
  return [`${key}:`, ...targets.map((target) => `  - ${yamlString(`[[${target}]]`)}`)];
}

function frontmatterTagList(tags: readonly string[]): string[] {
  return ["tags:", ...tags.map((tag) => `  - ${yamlString(tag)}`)];
}

function renderLessonStep(step: LessonStep, index: number, source: Source): string {
  return [
    `### Step ${index + 1} · ${step.stepTier}`,
    step.text,
    `**Source receipt — ${sourceDisplayLink(source)}**`,
    markdownQuote(step.citation.quotedText),
  ].join("\n\n");
}

function renderConceptFrontmatter(
  concept: Concept,
  source: Source,
  prerequisiteIds: readonly string[],
  methodIds: readonly string[],
  relatedIds: readonly string[],
): string {
  const tags = [...new Set(["concept", ...(concept.tags ?? []).map(normalizeTag)])].sort();
  return [
    "---",
    `title: ${yamlString(concept.title)}`,
    "aliases:",
    `  - ${yamlString(concept.title)}`,
    ...frontmatterTagList(tags),
    `source: ${yamlString(`[[${sourceTarget(source.id)}]]`)}`,
    ...frontmatterLinkList("prerequisites", prerequisiteIds.map(conceptTarget)),
    ...frontmatterLinkList("methods", methodIds.map(conceptTarget)),
    ...frontmatterLinkList("related", relatedIds.map(conceptTarget)),
    `license: ${yamlString(source.license)}`,
    `license_deed: ${yamlString(licenseDeedUrl(source.license) ?? "")}`,
    `modification_notice: ${yamlString(modificationNotice(source))}`,
    "---",
  ].join("\n");
}

function renderConcept(
  concept: Concept,
  source: Source,
  conceptById: ReadonlyMap<string, Concept>,
  prerequisiteIds: readonly string[],
  methodIds: readonly string[],
  relatedIds: readonly string[],
): string {
  const lesson = concept.lesson;
  if (!lesson) throw new Error(`validated concept ${concept.id} has no lesson`);

  const linkFor = (id: string): string => {
    const target = conceptById.get(id);
    if (!target) throw new Error(`validated concept ${concept.id} links missing concept ${id}`);
    return conceptDisplayLink(target);
  };

  const sections = [
    renderConceptFrontmatter(concept, source, prerequisiteIds, methodIds, relatedIds),
    `# ${concept.title}`,
    concept.summary,
  ];
  if (prerequisiteIds.length > 0) {
    sections.push(`## Prerequisites\n\n${bulletList(prerequisiteIds.map(linkFor))}`);
  }
  if (methodIds.length > 0) {
    sections.push(`## Methods\n\n${bulletList(methodIds.map(linkFor))}`);
  }
  if (relatedIds.length > 0) {
    sections.push(`## Related\n\n${bulletList(relatedIds.map(linkFor))}`);
  }
  sections.push(
    [
      `## Lesson: ${lesson.plainTitle}`,
      ...lesson.steps.map((step, index) => renderLessonStep(step, index, source)),
    ].join("\n\n"),
  );
  sections.push(
    [
      "## Source",
      `Adapted from ${sourceDisplayLink(source)}.`,
      markdownQuote(concept.provenance.quotedText),
    ].join("\n\n"),
  );
  return `${sections.join("\n\n")}\n`;
}

function renderSource(source: Source, citingConcepts: readonly Concept[]): string {
  const deedUrl = licenseDeedUrl(source.license);
  const frontmatter = [
    "---",
    `title: ${yamlString(source.title)}`,
    "aliases:",
    `  - ${yamlString(source.id)}`,
    ...frontmatterTagList(["source"]),
    `author: ${yamlString(source.author)}`,
    `license: ${yamlString(source.license)}`,
    `license_deed: ${yamlString(deedUrl ?? "")}`,
    `url: ${yamlString(source.url ?? "")}`,
    "---",
  ].join("\n");

  const attribution = bulletList([
    `**Author:** ${source.author}`,
    `**License:** ${deedUrl ? `[${source.license}](${deedUrl})` : source.license}`,
    ...(source.url ? [`**Source URL:** ${source.url}`] : []),
  ]);

  const sections = [frontmatter, `# ${source.title}`, modificationNotice(source), attribution];
  if (citingConcepts.length > 0) {
    sections.push(
      `## Concepts from this source\n\n${bulletList(citingConcepts.map(conceptDisplayLink))}`,
    );
  }
  return `${sections.join("\n\n")}\n`;
}

function renderStartHere(
  concepts: readonly Concept[],
  goal: Concept,
  sources: readonly Source[],
): string {
  const frontmatter = [
    "---",
    'title: "Atomic Learning Graph"',
    "aliases:",
    '  - "Start Here"',
    "tags:",
    '  - "atomic-learning-graph"',
    "---",
  ].join("\n");
  return `${[
    frontmatter,
    "# Atomic Learning Graph",
    "This is a ready-to-use Obsidian course: open this folder as a vault, start with this note, " +
      "and follow the linked concepts in order.",
    "Follow the concepts below in prerequisite order. Every concept and lesson step carries a " +
      "verbatim source receipt.",
    `**Goal:** ${conceptDisplayLink(goal)}`,
    "## Learning path",
    ...concepts.map(
      (concept, index) => `${index + 1}. ${conceptDisplayLink(concept)} — ${concept.summary}`,
    ),
    "## Sources",
    ...sources.map((source) => `- ${sourceDisplayLink(source)}`),
    "## How to use this vault",
    "Open a concept, read its lesson, and follow its prerequisite links when you need to step " +
      "back. Source passages and attribution stay beside the claims they ground.",
  ].join("\n\n")}\n`;
}

function addRelated(map: Map<string, Set<string>>, conceptId: string, relatedId: string): void {
  const current = map.get(conceptId) ?? new Set<string>();
  current.add(relatedId);
  map.set(conceptId, current);
}

/** Generate every note entirely in memory so a validation failure cannot partially write. */
export function emitObsidianVault(graph: LearningGraph): ObsidianNote[] {
  assertStructurallyEmittable(graph);

  const invalidConcepts = new Set(invalidProvenance(graph));
  for (const issue of invalidLessonCitations(graph)) invalidConcepts.add(issue.conceptId);

  const conceptById = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const prerequisitesByConcept = new Map<string, string[]>();
  const methodsByConcept = new Map<string, string[]>();
  const relatedByConcept = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.type === "prereq") {
      const current = prerequisitesByConcept.get(edge.to) ?? [];
      current.push(edge.from);
      prerequisitesByConcept.set(edge.to, current);
    }
    if (edge.type === "method") {
      const current = methodsByConcept.get(edge.to) ?? [];
      current.push(edge.from);
      methodsByConcept.set(edge.to, current);
    }
    if (edge.type === "related") {
      addRelated(relatedByConcept, edge.from, edge.to);
      addRelated(relatedByConcept, edge.to, edge.from);
    }
  }
  for (const prerequisiteIds of prerequisitesByConcept.values()) prerequisiteIds.sort();
  for (const methodIds of methodsByConcept.values()) methodIds.sort();

  const orderedConcepts = topologicalConceptOrder(graph)
    .map((id) => conceptById.get(id))
    .filter(
      (concept): concept is Concept => concept !== undefined && !invalidConcepts.has(concept.id),
    );

  const resolveIds = (ids: readonly string[]): string[] =>
    ids.filter((id) => {
      const concept = conceptById.get(id);
      return concept !== undefined && !invalidConcepts.has(concept.id);
    });

  const conceptNotes = orderedConcepts.map((concept) => {
    const source = sourceById.get(concept.provenance.sourceId);
    if (!source) throw new Error(`validated concept ${concept.id} has no source`);
    return {
      filename: conceptFilePath(concept.id),
      bytes: renderConcept(
        concept,
        source,
        conceptById,
        resolveIds(prerequisitesByConcept.get(concept.id) ?? []),
        resolveIds(methodsByConcept.get(concept.id) ?? []),
        resolveIds([...(relatedByConcept.get(concept.id) ?? [])].sort()),
      ),
    };
  });

  const referencedSourceIds = new Set<string>();
  for (const concept of orderedConcepts) {
    referencedSourceIds.add(concept.provenance.sourceId);
    for (const step of concept.lesson?.steps ?? []) {
      referencedSourceIds.add(step.citation.sourceId);
    }
  }
  const sortedSources = [...referencedSourceIds].sort().map((sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source) throw new Error(`validated source ${sourceId} is unavailable`);
    return source;
  });
  const sourceNotes = sortedSources.map((source) => ({
    filename: sourceFilePath(source.id),
    bytes: renderSource(
      source,
      orderedConcepts.filter((concept) => concept.provenance.sourceId === source.id),
    ),
  }));

  const goal = conceptById.get(graph.goalId);
  if (!goal || invalidConcepts.has(goal.id)) {
    throw new Error(`validated Obsidian goal ${graph.goalId} is unavailable`);
  }
  return [
    { filename: OBSIDIAN_START_HERE, bytes: renderStartHere(orderedConcepts, goal, sortedSources) },
    ...conceptNotes,
    ...sourceNotes,
  ];
}

function walkFiles(directory: string, base: string = directory): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory() ? walkFiles(path, base) : [relative(base, path)];
    })
    .sort();
}

export function writeObsidianVault(
  notes: readonly ObsidianNote[],
  directory: string = OBSIDIAN_PATH,
): void {
  rmSync(directory, { recursive: true, force: true });
  for (const { filename, bytes } of notes) {
    const path = resolve(directory, filename);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, "utf8");
  }
}

export function verifyObsidianVault(
  expected: readonly ObsidianNote[],
  directory: string = OBSIDIAN_PATH,
): void {
  const fail = (): never => {
    throw new Error(
      "exports/obsidian is not the exact graph-derived vault; run pnpm emit:obsidian",
    );
  };

  if (!existsSync(directory)) fail();
  const expectedFilenames = expected.map(({ filename }) => filename).sort();
  const actualFilenames = walkFiles(directory);
  if (
    expectedFilenames.length !== actualFilenames.length ||
    expectedFilenames.some((filename, index) => filename !== actualFilenames[index])
  ) {
    fail();
  }
  for (const { filename, bytes } of expected) {
    if (readFileSync(resolve(directory, filename), "utf8") !== bytes) fail();
  }
}

function currentVault(): ObsidianNote[] {
  return emitObsidianVault(loadGraph());
}

function main(): void {
  const vault = currentVault();
  if (process.argv.slice(2).includes("--verify")) {
    verifyObsidianVault(vault);
    console.log("Verified exports/obsidian against committed graph-derived bytes.");
    return;
  }
  writeObsidianVault(vault);
  console.log(`Emitted ${vault.length} markdown notes from the committed graph.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
