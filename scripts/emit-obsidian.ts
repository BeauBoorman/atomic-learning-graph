// Deterministic portable markdown-vault emit target. This module reads the committed graph
// artifact; it never calls a model, reaches the network, or authors per-concept prose. Concept
// summaries, quotes, and provenance are emitted verbatim from the gated graph.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
import { licenseDeedUrl, licenseWithDeed } from "./export-attribution";
import type { Concept, LearningGraph, Source } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");

export const OBSIDIAN_PATH = resolve(repoRoot, "exports", "obsidian");

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

function markdownQuote(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");
}

function modificationNotice(source: Source): string {
  return (
    `Adapted (translated to plain English; atomized into concept lessons) from ${source.title} ` +
    `by ${source.author}, ${licenseWithDeed(source.license)}.`
  );
}

function renderFrontmatter(concept: Concept, source: Source): string {
  const tags = [...concept.tags].sort();
  return [
    "---",
    `id: ${yamlString(concept.id)}`,
    `title: ${yamlString(concept.title)}`,
    `source: ${yamlString(source.id)}`,
    `source_title: ${yamlString(source.title)}`,
    `url: ${yamlString(source.url ?? "")}`,
    `author: ${yamlString(source.author)}`,
    `license: ${yamlString(source.license)}`,
    `license_deed: ${yamlString(licenseDeedUrl(source.license) ?? "")}`,
    `modification_notice: ${yamlString(modificationNotice(source))}`,
    ...(tags.length > 0
      ? ["tags:", ...tags.map((tag) => `  - ${yamlString(tag)}`)]
      : ["tags: []"]),
    "---",
  ].join("\n");
}

function renderConcept(
  concept: Concept,
  source: Source,
  prerequisiteIds: readonly string[],
  relatedIds: readonly string[],
): string {
  const sections = [renderFrontmatter(concept, source), concept.summary];
  if (prerequisiteIds.length > 0) {
    sections.push(
      ["## Prerequisites", ...prerequisiteIds.map((id) => `- [[${id}]]`)].join("\n\n"),
    );
  }
  if (relatedIds.length > 0) {
    sections.push(["## Related", ...relatedIds.map((id) => `- [[${id}]]`)].join("\n\n"));
  }
  sections.push(
    [
      "## Source",
      `Source: ${concept.provenance.sourceId}`,
      `URL: ${source.url ?? ""}`,
      markdownQuote(concept.provenance.quotedText),
    ].join("\n\n"),
  );
  return `${sections.join("\n\n")}\n`;
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
  const relatedByConcept = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.type === "prereq") {
      const current = prerequisitesByConcept.get(edge.to) ?? [];
      current.push(edge.from);
      prerequisitesByConcept.set(edge.to, current);
    }
    if (edge.type === "related") {
      addRelated(relatedByConcept, edge.from, edge.to);
      addRelated(relatedByConcept, edge.to, edge.from);
    }
  }
  for (const prerequisiteIds of prerequisitesByConcept.values()) prerequisiteIds.sort();

  const orderedConcepts = topologicalConceptOrder(graph)
    .map((id) => conceptById.get(id))
    .filter((concept): concept is Concept => concept !== undefined && !invalidConcepts.has(concept.id));

  return orderedConcepts.map((concept) => {
    const source = sourceById.get(concept.provenance.sourceId);
    if (!source) throw new Error(`validated concept ${concept.id} has no source`);
    const relatedIds = [...(relatedByConcept.get(concept.id) ?? [])].sort();
    return {
      filename: `${concept.id}.md`,
      bytes: renderConcept(
        concept,
        source,
        prerequisitesByConcept.get(concept.id) ?? [],
        relatedIds,
      ),
    };
  });
}

export function writeObsidianVault(
  notes: readonly ObsidianNote[],
  directory: string = OBSIDIAN_PATH,
): void {
  mkdirSync(directory, { recursive: true });
  const expectedFilenames = new Set(notes.map(({ filename }) => filename));
  for (const entry of readdirSync(directory)) {
    if (!expectedFilenames.has(entry)) rmSync(resolve(directory, entry), { recursive: true, force: true });
  }
  for (const { filename, bytes } of notes) writeFileSync(resolve(directory, filename), bytes, "utf8");
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
  const actualFilenames = readdirSync(directory).sort();
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
