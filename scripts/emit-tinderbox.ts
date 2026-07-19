// Deterministic, presentation-ready Tinderbox interchange artifact. Tinderbox imports OPML
// directly, maps matching extended attributes onto its system attributes, and promotes the rest
// to user attributes. The import therefore arrives styled and laid out in one shot while
// preserving every canonical graph edge as an explicit inspectable record. The proprietary,
// evolving TBX XML format never becomes the source of truth.

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
  pathExists,
} from "../src/graph/invariants";
import { loadGraph } from "../src/graph/load";
import { topologicalConceptOrder } from "../src/graph/path";
import { licenseDeedUrl, licenseWithDeed } from "./export-attribution";
import type { Concept, Edge, LearningGraph, Source } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");

export const TINDERBOX_PATH = resolve(repoRoot, "atomic-learning-graph.opml");

function assertEmittable(graph: LearningGraph): void {
  const duplicateConcepts = duplicateConceptIds(graph);
  if (duplicateConcepts.length > 0) {
    throw new Error(
      `refusing Tinderbox emit with duplicate concept IDs: ${duplicateConcepts.join(", ")}`,
    );
  }
  const duplicateSources = duplicateSourceIds(graph);
  if (duplicateSources.length > 0) {
    throw new Error(
      `refusing Tinderbox emit with duplicate source IDs: ${duplicateSources.join(", ")}`,
    );
  }
  const dangling = danglingEdges(graph);
  if (dangling.length > 0) {
    throw new Error(`refusing Tinderbox emit with ${dangling.length} dangling edge(s)`);
  }
  const orphans = findOrphans(graph);
  if (orphans.length > 0) {
    throw new Error(`refusing Tinderbox emit with orphan concept(s): ${orphans.join(", ")}`);
  }
  if (hasCycle(graph)) throw new Error("refusing Tinderbox emit with a prerequisite cycle");
  if (!pathExists(graph, graph.goalId)) {
    throw new Error(`refusing Tinderbox emit with unreachable goal: ${graph.goalId}`);
  }
  const invalidConcepts = invalidProvenance(graph);
  if (invalidConcepts.length > 0) {
    throw new Error(
      `refusing Tinderbox emit with invalid concept provenance: ${invalidConcepts.join(", ")}`,
    );
  }
  const invalidSteps = invalidLessonCitations(graph);
  if (invalidSteps.length > 0) {
    throw new Error(`refusing Tinderbox emit with ${invalidSteps.length} invalid lesson citation(s)`);
  }
}

function xmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r\n", "&#10;")
    .replaceAll("\r", "&#10;")
    .replaceAll("\n", "&#10;");
}

/**
 * Tinderbox 11.8 truncates imported `_note` text at an em dash even when the OPML is valid UTF-8
 * and the character is represented as a numeric XML entity. Keep the visible note body complete
 * by using an ASCII display equivalent. `ALGExactText` retains the unmodified, exact value.
 */
function tinderboxNoteText(value: string): string {
  return value.replaceAll("—", "--");
}

type OutlineAttributes = Record<string, string>;

const PRESENTATION = {
  concept: { color: "#E9C46A", badge: "book", width: "5", height: "2.5" },
  goal: { color: "#E76F51", badge: "star", width: "5", height: "2.5" },
  source: { color: "#7CB7C9", badge: "doc.text", width: "6", height: "2.5" },
  edge: { color: "#9AA5B1", badge: "arrow.right", width: "6", height: "1.5" },
  guide: { color: "#8E7DBE", badge: "info.circle", width: "7", height: "3" },
  container: { color: "#264653", badge: "folder", width: "7", height: "3" },
} as const;

function positionedStyle(
  style: (typeof PRESENTATION)[keyof typeof PRESENTATION],
  x: number,
  y: number,
): OutlineAttributes {
  return {
    Color: style.color,
    Shape: "rounded",
    Badge: style.badge,
    Width: style.width,
    Height: style.height,
    BorderColor: "#264653",
    Xpos: String(x),
    Ypos: String(y),
  };
}

function actionString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function postImportPresentation(
  conceptCount: number,
  x: number,
  y: number,
  linkedConceptIds: readonly string[] = [],
): OutlineAttributes {
  const actions = [
    "$Xpos=$ALGXpos",
    "$Ypos=$ALGYpos",
    ...linkedConceptIds.map(
      (id) =>
        `linkTo(find($ALGKind=="concept" & $ALGId==${actionString(id)}),"prereq")`,
    ),
    '$Rule=""',
  ];
  return {
    ALGXpos: String(x),
    ALGYpos: String(y),
    Rule:
      `if($ChildCount("/Atomic Learning Graph/Concepts")==${conceptCount}){` +
      `${actions.join(";")}}`,
  };
}

function conceptPositions(graph: LearningGraph): Map<string, { x: number; y: number }> {
  const order = topologicalConceptOrder(graph);
  const depthById = new Map(order.map((id) => [id, 0]));
  const inbound = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type !== "prereq") continue;
    const values = inbound.get(edge.to) ?? [];
    values.push(edge.from);
    inbound.set(edge.to, values);
  }

  for (const id of order) {
    const depth = Math.max(
      0,
      ...(inbound.get(id) ?? []).map((sourceId) => (depthById.get(sourceId) ?? 0) + 1),
    );
    depthById.set(id, depth);
  }

  const rowsByDepth = new Map<number, string[]>();
  for (const id of order) {
    const depth = depthById.get(id) ?? 0;
    const values = rowsByDepth.get(depth) ?? [];
    values.push(id);
    rowsByDepth.set(depth, values);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [depth, ids] of rowsByDepth) {
    ids.forEach((id, row) => positions.set(id, { x: 2 + depth * 6, y: 5 + row * 3.5 }));
  }
  return positions;
}

function presentationPrototypes(conceptCount: number): string[] {
  const definitions = [
    ["ALG Concept", "Presentation prototype for grounded learning concepts.", "concept"],
    ["ALG Goal", "Presentation prototype for the selected learning goal.", "goal"],
    ["ALG Source", "Presentation prototype for licensed source records.", "source"],
    ["ALG Edge", "Presentation prototype for canonical relationship records.", "edge"],
    ["ALG Guide", "Presentation prototype for explanatory guide notes.", "guide"],
    ["ALG Container", "Presentation prototype for course containers.", "container"],
  ] as const;

  return definitions.map(([name, note, kind], index) => {
    const style = PRESENTATION[kind];
    return outline(
      {
        text: name,
        _note: note,
        ALGKind: "prototype",
        IsPrototype: "true",
        ...(kind === "goal" ? { Prototype: "ALG Concept" } : {}),
        Color: style.color,
        Shape: "rounded",
        Badge: style.badge,
        Width: style.width,
        Height: style.height,
        BorderColor: "#264653",
        Xpos: String(index * 6.5),
        Ypos: "0",
        ...postImportPresentation(conceptCount, index * 6.5, 0),
      },
      [],
      4,
    );
  });
}

function outline(
  attributes: OutlineAttributes,
  children: readonly string[] = [],
  depth = 0,
): string {
  const indent = "  ".repeat(depth);
  const serialized = Object.entries(attributes)
    .map(([name, value]) => `${name}="${xmlAttribute(value)}"`)
    .join(" ");
  if (children.length === 0) return `${indent}<outline ${serialized}/>`;
  return [
    `${indent}<outline ${serialized}>`,
    ...children,
    `${indent}</outline>`,
  ].join("\n");
}

function modificationNotice(source: Source): string {
  return (
    `Adapted (translated to plain English; atomized into concept lessons) from ${source.title} ` +
    `by ${source.author}, ${licenseWithDeed(source.license)}.`
  );
}

function sourceText(source: Source): string {
  return [
    source.title,
    `Source ID: ${source.id}`,
    `Author: ${source.author}`,
    `License: ${licenseWithDeed(source.license)}`,
    `URL: ${source.url ?? ""}`,
    `Modification notice: ${modificationNotice(source)}`,
    "",
    "Source text",
    source.text,
  ].join("\n");
}

function conceptText(concept: Concept, source: Source): string {
  const lesson = concept.lesson;
  if (!lesson) throw new Error(`validated concept ${concept.id} has no lesson`);

  return [
    concept.summary,
    "",
    `Lesson: ${lesson.plainTitle}`,
    ...lesson.steps.flatMap((step, index) => [
      "",
      `Step ${index + 1} (${step.stepTier})`,
      step.text,
      `Source: ${step.citation.sourceId}`,
      "Quoted passage:",
      step.citation.quotedText,
    ]),
    "",
    "Concept source receipt",
    `Source: ${concept.provenance.sourceId}`,
    concept.provenance.quotedText,
    "",
    modificationNotice(source),
  ].join("\n");
}

function edgeKey(edge: Edge): string {
  return `${edge.type}\u0000${edge.from}\u0000${edge.to}`;
}

/** Generate the complete OPML artifact in memory so validation cannot leave a partial file. */
export function emitTinderboxArtifact(graph: LearningGraph): string {
  assertEmittable(graph);

  const sourceById = new Map(graph.sources.map((source) => [source.id, source]));
  const conceptById = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const prerequisites = new Map<string, string[]>();
  const methods = new Map<string, string[]>();
  const related = new Map<string, Set<string>>();
  const mapPositions = conceptPositions(graph);

  for (const edge of graph.edges) {
    if (edge.type === "prereq") {
      const values = prerequisites.get(edge.to) ?? [];
      values.push(edge.from);
      prerequisites.set(edge.to, values);
    } else if (edge.type === "method") {
      const values = methods.get(edge.to) ?? [];
      values.push(edge.from);
      methods.set(edge.to, values);
    } else {
      const from = related.get(edge.from) ?? new Set<string>();
      from.add(edge.to);
      related.set(edge.from, from);
      const to = related.get(edge.to) ?? new Set<string>();
      to.add(edge.from);
      related.set(edge.to, to);
    }
  }
  for (const values of prerequisites.values()) values.sort();
  for (const values of methods.values()) values.sort();

  const sourceNotes = [...graph.sources]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((source, index) => {
      const exactText = sourceText(source);
      return outline(
        {
          text: source.title,
          _note: tinderboxNoteText(exactText),
          ALGKind: "source",
          ALGId: source.id,
          ALGTitle: source.title,
          ALGAuthor: source.author,
          ALGLicense: source.license,
          ALGLicenseDeed: licenseDeedUrl(source.license) ?? "",
          ALGURL: source.url ?? "",
          ALGExactText: exactText,
          Prototype: "ALG Source",
          ...positionedStyle(PRESENTATION.source, index * 6.5, 4),
          ...postImportPresentation(graph.concepts.length, index * 6.5, 4),
          DisplayedAttributes: "ALGId;ALGLicense;ALGURL",
        },
        [],
        4,
      );
    });

  const conceptNotes = topologicalConceptOrder(graph).map((conceptId) => {
    const concept = conceptById.get(conceptId);
    if (!concept) throw new Error(`validated concept order contains unknown concept ${conceptId}`);
    const source = sourceById.get(concept.provenance.sourceId);
    if (!source) throw new Error(`validated concept ${concept.id} has no source`);
    const exactText = conceptText(concept, source);
    const position = mapPositions.get(concept.id);
    if (!position) throw new Error(`validated concept ${concept.id} has no map position`);
    const style = concept.id === graph.goalId ? PRESENTATION.goal : PRESENTATION.concept;
    const linkedConceptIds = graph.edges
      .filter((edge) => edge.type === "prereq" && edge.from === concept.id)
      .map((edge) => edge.to)
      .sort();
    return outline(
      {
        text: concept.title,
        _note: tinderboxNoteText(exactText),
        ALGKind: "concept",
        ALGId: concept.id,
        ALGTitle: concept.title,
        ALGSourceId: concept.provenance.sourceId,
        ALGQuotedText: concept.provenance.quotedText,
        ALGTags: [...concept.tags].sort().join(";"),
        ALGPrerequisites: (prerequisites.get(concept.id) ?? []).join(";"),
        ALGMethods: (methods.get(concept.id) ?? []).join(";"),
        ALGRelated: [...(related.get(concept.id) ?? [])].sort().join(";"),
        ALGIsGoal: String(concept.id === graph.goalId),
        ALGExactText: exactText,
        Prototype: concept.id === graph.goalId ? "ALG Goal" : "ALG Concept",
        ...positionedStyle(style, position.x, position.y),
        ...postImportPresentation(
          graph.concepts.length,
          position.x,
          position.y,
          linkedConceptIds,
        ),
        DisplayedAttributes: "ALGId;ALGSourceId;ALGKind;ALGIsGoal",
      },
      [],
      4,
    );
  });

  const edgeNotes = [...graph.edges]
    .sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)))
    .map((edge, index) =>
      outline(
        {
          text: `${edge.type}: ${edge.from} → ${edge.to}`,
          _note: `Canonical ${edge.type} edge from ${edge.from} to ${edge.to}.`,
          ALGKind: "edge",
          ALGFrom: edge.from,
          ALGTo: edge.to,
          ALGEdgeType: edge.type,
          Prototype: "ALG Edge",
          ...positionedStyle(PRESENTATION.edge, (index % 5) * 6.5, 4 + Math.floor(index / 5) * 2),
          ...postImportPresentation(
            graph.concepts.length,
            (index % 5) * 6.5,
            4 + Math.floor(index / 5) * 2,
          ),
          DisplayedAttributes: "ALGFrom;ALGTo;ALGEdgeType",
        },
        [],
        4,
      ),
    );

  const setup = outline(
    {
      text: "Read Me",
      _note: [
        "Atomic Learning Graph for Tinderbox",
        "",
        "This is a ready-to-use visual course. Double-click atomic-learning-graph.tbx to open it " +
          "in Tinderbox, then open Concepts in Map view and follow the connected notes. To use " +
          "the portable copy instead, open atomic-learning-graph.opml in Tinderbox once; its map " +
          "and styling are applied during import.",
        "",
        "Open Concepts in Map view to explore the course. Note names are human-facing titles; " +
          "ALGId retains each stable graph key. Sources retain the complete licensed source " +
          "text. Edges retain every canonical relation from data/graph.json.",
        "",
        "This OPML is a deterministic, offline, presentation-ready projection of the committed " +
          "graph. Its opinionated prototypes, colors, badges, dimensions, and prerequisite-layer " +
          "layout are applied by Tinderbox during the same import. It makes no model or network " +
          "call and is never an authority over data/graph.json.",
      ].join("\n"),
      ALGKind: "readme",
      Prototype: "ALG Guide",
      ...positionedStyle(PRESENTATION.guide, 0, 0),
      ...postImportPresentation(graph.concepts.length, 0, 0),
    },
    [],
    3,
  );

  const root = outline(
    {
      text: "Atomic Learning Graph",
      _note:
        "Open this course in Tinderbox, choose Concepts in Map view, and follow the connected " +
        "concept notes in learning order.",
      ALGKind: "course",
      ALGFormatVersion: "2",
      ALGGoalId: graph.goalId,
      ALGPresentation: "styled-one-shot",
      Color: "#264653",
      Shape: "rounded",
      Badge: "point.3.connected.trianglepath.dotted",
      Width: "8",
      Height: "3",
    },
    [
      outline(
        {
          text: "Prototypes",
          ALGKind: "container",
          Prototype: "ALG Container",
          ...positionedStyle(PRESENTATION.container, 32, 0),
          ...postImportPresentation(graph.concepts.length, 32, 0),
        },
        presentationPrototypes(graph.concepts.length),
        3,
      ),
      setup,
      outline(
        {
          text: "Concepts",
          ALGKind: "container",
          Prototype: "ALG Container",
          ...positionedStyle(PRESENTATION.container, 8, 0),
          ...postImportPresentation(graph.concepts.length, 8, 0),
        },
        conceptNotes,
        3,
      ),
      outline(
        {
          text: "Sources",
          ALGKind: "container",
          Prototype: "ALG Container",
          ...positionedStyle(PRESENTATION.container, 16, 0),
          ...postImportPresentation(graph.concepts.length, 16, 0),
        },
        sourceNotes,
        3,
      ),
      outline(
        {
          text: "Edges",
          ALGKind: "container",
          Prototype: "ALG Container",
          ...positionedStyle(PRESENTATION.container, 24, 0),
          ...postImportPresentation(graph.concepts.length, 24, 0),
        },
        edgeNotes,
        3,
      ),
    ],
    2,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>Atomic Learning Graph</title>",
    "  </head>",
    "  <body>",
    root,
    "  </body>",
    "</opml>",
    "",
  ].join("\n");
}

export function writeTinderboxArtifact(
  artifact: string,
  path: string = TINDERBOX_PATH,
): void {
  writeFileSync(path, artifact, "utf8");
}

export function verifyTinderboxArtifact(
  expected: string,
  path: string = TINDERBOX_PATH,
): void {
  if (!existsSync(path) || readFileSync(path, "utf8") !== expected) {
    throw new Error(
      "atomic-learning-graph.opml is not the exact graph-derived artifact; run pnpm emit:tinderbox",
    );
  }
}

function currentArtifact(): string {
  return emitTinderboxArtifact(loadGraph());
}

function main(): void {
  const artifact = currentArtifact();
  if (process.argv.slice(2).includes("--verify")) {
    verifyTinderboxArtifact(artifact);
    console.log("Verified atomic-learning-graph.opml against committed graph-derived bytes.");
    return;
  }
  writeTinderboxArtifact(artifact);
  console.log("Emitted atomic-learning-graph.opml from the committed graph.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
