// Deterministic org-roam emit target. This module reads the committed graph artifact; it never
// calls a model, reaches the network, or authors per-concept prose. Concept summaries, lesson
// text, quotes, and provenance are emitted verbatim from the gated graph.

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
} from "../src/graph/invariants";
import { loadGraph } from "../src/graph/load";
import { topologicalConceptOrder } from "../src/graph/path";
import { licenseWithDeed } from "./export-attribution";
import type { Concept, LearningGraph, LessonStep, Source } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");

export const ORG_ROAM_PATH = resolve(repoRoot, "atomic-learning-graph.org");

function assertStructurallyEmittable(graph: LearningGraph): void {
  const duplicateConcepts = duplicateConceptIds(graph);
  if (duplicateConcepts.length > 0) {
    throw new Error(
      `refusing org-roam emit with duplicate concept IDs: ${duplicateConcepts.join(", ")}`,
    );
  }
  const duplicateSources = duplicateSourceIds(graph);
  if (duplicateSources.length > 0) {
    throw new Error(
      `refusing org-roam emit with duplicate source IDs: ${duplicateSources.join(", ")}`,
    );
  }
  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    throw new Error(`refusing org-roam emit with ${dangling.length} dangling edge(s)`);
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    throw new Error(`refusing org-roam emit with orphan concept(s): ${orphans.join(", ")}`);
  }
  if (hasCycle(graph)) throw new Error("refusing org-roam emit with a prerequisite cycle");
}

function orgQuote(value: string): string {
  return `#+begin_quote\n${value}\n#+end_quote`;
}

function sourceReference(source: Source): string {
  return [source.id, source.url].filter((value): value is string => value !== undefined).join(" ");
}

function modificationNotice(source: Source): string {
  return (
    `Adapted (translated to plain English; atomized into concept lessons) from ${source.title} ` +
    `by ${source.author}, ${licenseWithDeed(source.license)}.`
  );
}

function renderSourceAttribution(source: Source): string {
  return [
    `** ${source.id}`,
    `Title: ${source.title}`,
    `Author: ${source.author}`,
    `License: ${licenseWithDeed(source.license)}`,
    `URL: ${source.url ?? ""}`,
    `Modification notice: ${modificationNotice(source)}`,
  ].join("\n");
}

function renderCitation(step: LessonStep, index: number): string {
  return [
    `*** Step ${index + 1} (${step.stepTier})`,
    step.text,
    `Source: ${step.citation.sourceId}`,
    orgQuote(step.citation.quotedText),
  ].join("\n\n");
}

function renderConcept(
  concept: Concept,
  source: Source,
  prerequisiteIds: readonly string[],
): string {
  const lesson = concept.lesson;
  if (!lesson) throw new Error(`validated concept ${concept.id} has no lesson`);

  const sections = [
    `* ${concept.title}\n:PROPERTIES:\n:ID: ${concept.id}\n:ROAM_REFS: ${sourceReference(source)}\n:END:`,
    concept.summary,
  ];
  if (prerequisiteIds.length > 0) {
    sections.push(
      ["** Prerequisites", ...prerequisiteIds.map((id) => `- [[id:${id}]]`)].join("\n"),
    );
  }
  sections.push(
    [
      "** Source",
      `Source: ${concept.provenance.sourceId}`,
      ...(source.url ? [`URL: ${source.url}`] : []),
      orgQuote(concept.provenance.quotedText),
    ].join("\n\n"),
    [
      `** Lesson: ${lesson.plainTitle}`,
      ...lesson.steps.map((step, index) => renderCitation(step, index)),
    ].join("\n\n"),
  );
  return sections.join("\n\n");
}

function renderLearningPath(concepts: readonly Concept[], goal: Concept): string {
  return [
    "* Learning Path",
    "Follow these concepts in prerequisite order. Every concept and lesson step carries a " +
      "verbatim source receipt.",
    `Goal: [[id:${goal.id}][${goal.title}]]`,
    ...concepts.map(
      (concept, index) =>
        `${index + 1}. [[id:${concept.id}][${concept.title}]] — ${concept.summary}`,
    ),
  ].join("\n\n");
}

/** Generate the artifact entirely in memory so a validation failure cannot partially write. */
export function emitOrgRoamArtifact(graph: LearningGraph): string {
  assertStructurallyEmittable(graph);

  const invalidConcepts = new Set(invalidProvenance(graph));
  for (const issue of invalidLessonCitations(graph)) invalidConcepts.add(issue.conceptId);

  const conceptById = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const prerequisitesByConcept = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "prereq") continue;
    const current = prerequisitesByConcept.get(edge.to) ?? [];
    current.push(edge.from);
    prerequisitesByConcept.set(edge.to, current);
  }
  for (const prerequisiteIds of prerequisitesByConcept.values()) prerequisiteIds.sort();

  const orderedConcepts = topologicalConceptOrder(graph)
    .map((id) => conceptById.get(id))
    .filter((concept): concept is Concept => concept !== undefined && !invalidConcepts.has(concept.id));

  const conceptSections = orderedConcepts.map((concept) => {
    const source = sourceById.get(concept.provenance.sourceId);
    if (!source) throw new Error(`validated concept ${concept.id} has no source`);
    return renderConcept(concept, source, prerequisitesByConcept.get(concept.id) ?? []);
  });

  const goal = conceptById.get(graph.goalId);
  if (!goal || invalidConcepts.has(goal.id)) {
    throw new Error(`validated org-roam goal ${graph.goalId} is unavailable`);
  }

  const sourceAttributions = [
    "* Source Attributions",
    ...[...new Set(orderedConcepts.map(({ provenance }) => provenance.sourceId))]
      .sort()
      .map((sourceId) => {
        const source = sourceById.get(sourceId);
        if (!source) throw new Error(`validated source attribution ${sourceId} has no source`);
        return renderSourceAttribution(source);
      }),
  ].join("\n\n");

  return `${[
    ["#+title: Atomic Learning Graph", "#+startup: overview", "#+options: toc:2"].join("\n"),
    "This is a ready-to-use org-roam course: put this file in your org-roam folder, open it in " +
      "Emacs, run ~M-x org-roam-db-sync~ once, and begin at Learning Path.",
    renderLearningPath(orderedConcepts, goal),
    ...conceptSections,
    sourceAttributions,
  ].join("\n\n")}\n`;
}

export function writeOrgRoamArtifact(
  artifact: string,
  path: string = ORG_ROAM_PATH,
): void {
  writeFileSync(path, artifact, "utf8");
}

export function verifyOrgRoamArtifact(
  expected: string,
  path: string = ORG_ROAM_PATH,
): void {
  if (!existsSync(path) || readFileSync(path, "utf8") !== expected) {
    throw new Error(
      "atomic-learning-graph.org is not the exact graph-derived artifact; run pnpm emit:orgroam",
    );
  }
}

function currentArtifact(): string {
  return emitOrgRoamArtifact(loadGraph());
}

function main(): void {
  const artifact = currentArtifact();
  if (process.argv.slice(2).includes("--verify")) {
    verifyOrgRoamArtifact(artifact);
    console.log("Verified atomic-learning-graph.org against committed graph-derived bytes.");
    return;
  }
  writeOrgRoamArtifact(artifact);
  console.log("Emitted atomic-learning-graph.org from the committed graph.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
