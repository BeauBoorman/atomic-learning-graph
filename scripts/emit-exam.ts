// Deterministic practice-exam emit target. This module reads the committed graph artifact; it
// never calls a model, reaches the network, or authors per-question prose. Every question is
// derived mechanically from a gated concept, and every answer in the key carries the verbatim,
// graph-validated source passage that grounds it — no claim without a receipt.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  danglingEdges,
  duplicateConceptIds,
  duplicateSourceIds,
  findOrphans,
  hasCycle,
  invalidProvenance,
  invalidRubricCitations,
} from "../src/graph/invariants";
import { loadGraph } from "../src/graph/load";
import { topologicalConceptOrder } from "../src/graph/path";
import { buildRecallRubric } from "../src/graph/recall-rubric";
import type { Concept, LearningGraph, RecallRubric, Source } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");

export const EXAM_PATH = resolve(repoRoot, "atomic-learning-graph-exam.md");

function assertStructurallyEmittable(graph: LearningGraph): void {
  const duplicateConcepts = duplicateConceptIds(graph);
  if (duplicateConcepts.length > 0) {
    throw new Error(
      `refusing exam emit with duplicate concept IDs: ${duplicateConcepts.join(", ")}`,
    );
  }
  const duplicateSources = duplicateSourceIds(graph);
  if (duplicateSources.length > 0) {
    throw new Error(
      `refusing exam emit with duplicate source IDs: ${duplicateSources.join(", ")}`,
    );
  }
  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    throw new Error(`refusing exam emit with ${dangling.length} dangling edge(s)`);
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    throw new Error(`refusing exam emit with orphan concept(s): ${orphans.join(", ")}`);
  }
  if (hasCycle(graph)) throw new Error("refusing exam emit with a prerequisite cycle");

  const rubricIssues = invalidRubricCitations(graph);
  if (rubricIssues.length > 0) {
    throw new Error(
      `refusing exam emit with invalid recall rubric citations: ${rubricIssues
        .map((issue) => `${issue.conceptId}[${issue.itemIndex}]:${issue.reason}`)
        .join(", ")}`,
    );
  }
}

function modificationNotice(source: Source): string {
  return (
    `Adapted (translated to plain English; atomized into concept lessons; recast as ` +
    `practice-exam questions) from ${source.title} by ${source.author}, ${source.license}.`
  );
}

function mdQuote(value: string): string {
  return value
    .split(/\r\n|\r|\n/u)
    .map((line) => `> ${line}`)
    .join("\n");
}

function renderSourceAttribution(source: Source): string {
  return [
    `### ${source.id}`,
    `- Title: ${source.title}`,
    `- Author: ${source.author}`,
    `- License: ${source.license}`,
    `- URL: ${source.url ?? ""}`,
    `- Modification notice: ${modificationNotice(source)}`,
  ].join("\n");
}

function renderReceipt(concept: Concept, source: Source): string {
  return [
    mdQuote(concept.provenance.quotedText),
    "",
    [
      `Source ID: ${source.id}`,
      `Title: ${source.title}`,
      `Author: ${source.author}`,
      `License: ${source.license}`,
      ...(source.url ? [`URL: ${source.url}`] : []),
    ].join("  \n"),
  ].join("\n");
}

function renderRecallRubric(rubric: RecallRubric): string {
  const items = rubric.items.map((item, itemIndex) =>
    [
      `- Item ${itemIndex + 1} must mention: ${item.mustMention.map((term) => `\`${term}\``).join(", ")}`,
      `  Verbatim source span (\`${item.sourceId}\`):`,
      "",
      mdQuote(item.quotedText),
    ].join("\n"),
  );
  return [
    "#### Recall rubric",
    "A self-check passes an item only when every listed source-derived term appears in the answer.",
    ...items,
  ].join("\n\n");
}

/** Generate the artifact entirely in memory so a validation failure cannot partially write. */
export function emitExamArtifact(graph: LearningGraph): string {
  assertStructurallyEmittable(graph);

  const invalidConcepts = new Set(invalidProvenance(graph));
  const conceptById = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const orderedConcepts = topologicalConceptOrder(graph)
    .map((id) => conceptById.get(id))
    .filter(
      (concept): concept is Concept =>
        concept !== undefined && !invalidConcepts.has(concept.id),
    );

  const conceptsWithSources = orderedConcepts.map((concept) => {
    const source = sourceById.get(concept.provenance.sourceId);
    if (!source) throw new Error(`validated concept ${concept.id} has no source`);
    return { concept, source };
  });

  // Passage order is the quote's own sort order, not prerequisite order, so Part B is not
  // answerable by position alone. Sorting bytes keeps the emit deterministic without randomness.
  const passages = [...conceptsWithSources].sort((a, b) =>
    a.concept.provenance.quotedText < b.concept.provenance.quotedText ? -1 : 1,
  );
  const passageLabelByConceptId = new Map(
    passages.map(({ concept }, index) => [concept.id, `P${index + 1}`]),
  );

  const partA = conceptsWithSources.map(
    ({ concept }, index) => `${index + 1}. In your own words, explain **${concept.title}**.`,
  );

  const partB = passages.map(({ concept, source }, index) =>
    [
      `**P${index + 1}** — from ${source.title} (${source.id}):`,
      "",
      mdQuote(concept.provenance.quotedText),
    ].join("\n"),
  );

  const answerKeyA = conceptsWithSources.map(({ concept, source }, index) => {
    const rubric = buildRecallRubric(concept);
    return [
      `### A${index + 1}. ${concept.title}`,
      "",
      concept.summary,
      "",
      "Source receipt:",
      "",
      renderReceipt(concept, source),
      "",
      renderRecallRubric(rubric),
    ].join("\n");
  });

  const answerKeyB = passages.map(
    ({ concept }, index) => `- P${index + 1} → ${concept.title} (\`${concept.id}\`)`,
  );

  const sourceAttributions = [
    "## Source Attributions",
    ...[...new Set(conceptsWithSources.map(({ source }) => source.id))].sort().map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`validated source attribution ${sourceId} has no source`);
      return renderSourceAttribution(source);
    }),
  ].join("\n\n");

  return `${[
    "# Atomic Learning Graph — Practice Exam",
    "Every answer in the key carries the verbatim source passage that grounds it. Questions follow " +
      "prerequisite order, so earlier answers are fair to assume in later ones.",
    "## Part A — Explain each concept",
    partA.join("\n"),
    "## Part B — Match each passage to the concept it grounds",
    "Passages are listed in passage-text order, not exam order.",
    ...partB,
    "## Answer Key — Part A",
    ...answerKeyA,
    "## Answer Key — Part B",
    answerKeyB.join("\n"),
    sourceAttributions,
  ].join("\n\n")}\n`;
}

export function writeExamArtifact(
  artifact: string,
  path: string = EXAM_PATH,
): void {
  writeFileSync(path, artifact, "utf8");
}

export function verifyExamArtifact(
  expected: string,
  path: string = EXAM_PATH,
): void {
  if (!existsSync(path) || readFileSync(path, "utf8") !== expected) {
    throw new Error(
      "atomic-learning-graph-exam.md is not the exact graph-derived artifact; run pnpm emit:exam",
    );
  }
}

function currentArtifact(): string {
  return emitExamArtifact(loadGraph());
}

function main(): void {
  const artifact = currentArtifact();
  if (process.argv.slice(2).includes("--verify")) {
    verifyExamArtifact(artifact);
    console.log("Verified atomic-learning-graph-exam.md against committed graph-derived bytes.");
    return;
  }
  writeExamArtifact(artifact);
  console.log("Emitted atomic-learning-graph-exam.md from the committed graph.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
