// Deterministic Anki Basic-note emit target. This module reads the committed graph artifact; it
// never calls a model, reaches the network, or authors per-concept prose. Each card carries the
// concept summary and its verbatim, graph-validated source receipt.

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
} from "../src/graph/invariants";
import { loadGraph } from "../src/graph/load";
import { topologicalConceptOrder } from "../src/graph/path";
import { licenseWithDeed } from "./export-attribution";
import type { Concept, LearningGraph, Source } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");

export const ANKI_PATH = resolve(repoRoot, "atomic-learning-graph-anki.tsv");

const ANKI_HEADERS = [
  "#separator:Tab",
  "#html:true",
  "#notetype:Basic",
  "#columns:Front\tBack",
  "# This is a ready-to-study Anki deck: choose File > Import, select this .tsv file, keep the Basic note type, then choose Study Now.",
] as const;

function assertStructurallyEmittable(graph: LearningGraph): void {
  const duplicateConcepts = duplicateConceptIds(graph);
  if (duplicateConcepts.length > 0) {
    throw new Error(
      `refusing Anki emit with duplicate concept IDs: ${duplicateConcepts.join(", ")}`,
    );
  }
  const duplicateSources = duplicateSourceIds(graph);
  if (duplicateSources.length > 0) {
    throw new Error(
      `refusing Anki emit with duplicate source IDs: ${duplicateSources.join(", ")}`,
    );
  }
  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    throw new Error(`refusing Anki emit with ${dangling.length} dangling edge(s)`);
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    throw new Error(`refusing Anki emit with orphan concept(s): ${orphans.join(", ")}`);
  }
  if (hasCycle(graph)) throw new Error("refusing Anki emit with a prerequisite cycle");
}

/** Keep each Basic-note field on one TSV row while preserving its displayed text in Anki. */
export function escapeAnkiField(value: string): string {
  // Anki's MathJax recognises `\(...\)` and `\[...\]`, not Markdown's dollar delimiters.
  // Convert before HTML escaping so the TeX payload still receives the normal field protection.
  const ankiMath = value
    .replace(/\$\$([\s\S]*?)\$\$/gu, "\\[$1\\]")
    .replace(/\$([^$\r\n]+?)\$/gu, "\\($1\\)");
  return ankiMath
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/\t/gu, "&#9;")
    .replace(/\r\n|\r|\n/gu, "<br>");
}

function modificationNotice(source: Source): string {
  return (
    `Adapted (translated to plain English; atomized into concept lessons) from ${source.title} ` +
    `by ${source.author}, ${licenseWithDeed(source.license)}.`
  );
}

function commentValue(value: string): string {
  return value.replace(/\t/gu, " ").replace(/\r\n|\r|\n/gu, " ");
}

function renderSourceAttribution(source: Source): string[] {
  return [
    `# Attribution source: ${commentValue(source.id)}`,
    `# Title: ${commentValue(source.title)}`,
    `# Author: ${commentValue(source.author)}`,
    `# License: ${commentValue(licenseWithDeed(source.license))}`,
    `# URL: ${commentValue(source.url ?? "")}`,
    `# ${commentValue(modificationNotice(source))}`,
  ];
}

function renderCard(concept: Concept, source: Source): string {
  const front = escapeAnkiField(`What is ${concept.title}?`);
  const back = escapeAnkiField(
    [
      concept.summary,
      "",
      "Source receipt",
      concept.provenance.quotedText,
      `Source ID: ${source.id}`,
      `Title: ${source.title}`,
      `Author: ${source.author}`,
      `License: ${licenseWithDeed(source.license)}`,
      ...(source.url ? [`URL: ${source.url}`] : []),
      `Modification notice: ${modificationNotice(source)}`,
    ].join("\n"),
  );
  return `${front}\t${back}`;
}

/** Generate the artifact entirely in memory so a validation failure cannot partially write. */
export function emitAnkiArtifact(graph: LearningGraph): string {
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

  const cards = orderedConcepts.map((concept) => {
    const source = sourceById.get(concept.provenance.sourceId);
    if (!source) throw new Error(`validated concept ${concept.id} has no source`);
    return renderCard(concept, source);
  });

  const sourceAttributions = [
    ...new Set(orderedConcepts.map(({ provenance }) => provenance.sourceId)),
  ]
    .sort()
    .flatMap((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`validated source attribution ${sourceId} has no source`);
      return renderSourceAttribution(source);
    });

  return `${[...ANKI_HEADERS, ...sourceAttributions, ...cards].join("\n")}\n`;
}

export function writeAnkiArtifact(
  artifact: string,
  path: string = ANKI_PATH,
): void {
  writeFileSync(path, artifact, "utf8");
}

export function verifyAnkiArtifact(
  expected: string,
  path: string = ANKI_PATH,
): void {
  if (!existsSync(path) || readFileSync(path, "utf8") !== expected) {
    throw new Error(
      "atomic-learning-graph-anki.tsv is not the exact graph-derived artifact; run pnpm emit:anki",
    );
  }
}

function currentArtifact(): string {
  return emitAnkiArtifact(loadGraph());
}

function main(): void {
  const artifact = currentArtifact();
  if (process.argv.slice(2).includes("--verify")) {
    verifyAnkiArtifact(artifact);
    console.log("Verified atomic-learning-graph-anki.tsv against committed graph-derived bytes.");
    return;
  }
  writeAnkiArtifact(artifact);
  console.log("Emitted atomic-learning-graph-anki.tsv from the committed graph.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
