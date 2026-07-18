import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph } from "../src/graph/load";
import type { LearningGraph } from "../src/types";
import {
  emitObsidianVault,
  OBSIDIAN_PATH,
  verifyObsidianVault,
  writeObsidianVault,
} from "./emit-obsidian";

describe("Obsidian markdown vault", () => {
  it("is byte-deterministic and uses prerequisite order rather than graph array order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitObsidianVault(fixtureGraph);
    const actual = emitObsidianVault(shuffled);

    expect(actual).toEqual(expected);
    expect(actual.map(({ filename }) => filename)).toEqual(
      GOLDEN_PATH.map((id) => `${id}.md`),
    );
    for (const [index, note] of actual.entries()) {
      expect(Buffer.from(note.bytes)).toEqual(Buffer.from(expected[index].bytes));
    }
  });

  it("emits portable frontmatter, sorted tags, edge wikilinks, and verbatim provenance", () => {
    const graph = structuredClone(fixtureGraph);
    graph.sources[0].url = "https://example.test/primer";
    const goal = graph.concepts.find(({ id }) => id === "self-attention");
    if (!goal) throw new Error("fixture lost self-attention");
    goal.tags = ["transformers", "llm"];
    graph.edges.push({ from: "vectors", to: "self-attention", type: "related" });
    graph.edges.push({ from: "self-attention", to: "softmax", type: "method" });

    const notes = emitObsidianVault(graph);
    const goalNote = notes.find(({ filename }) => filename === "self-attention.md")?.bytes;
    const vectorsNote = notes.find(({ filename }) => filename === "vectors.md")?.bytes;
    if (!goalNote || !vectorsNote) throw new Error("emitter dropped a fixture note");

    expect(goalNote).toBe(`---
id: "self-attention"
title: "self-attention"
source: "s1"
source_title: "How LLMs work (primer)"
url: "https://example.test/primer"
author: "Fixture author"
license: "CC-BY-SA-4.0"
modification_notice: "Adapted (translated to plain English; atomized into concept lessons) from How LLMs work (primer) by Fixture author, CC-BY-SA-4.0."
tags:
  - "llm"
  - "transformers"
---

single concept: self-attention

## Prerequisites

- [[qkv]]

## Related

- [[vectors]]

## Source

Source: s1

URL: https://example.test/primer

> Self-attention scores every token against every other token.
`);
    expect(vectorsNote).toContain("## Related\n\n- [[self-attention]]");
    expect(goalNote).not.toContain("[[softmax]]");
  });

  it("omits empty relationship sections", () => {
    const notes = emitObsidianVault(fixtureGraph);
    const vectors = notes.find(({ filename }) => filename === "vectors.md")?.bytes;
    if (!vectors) throw new Error("emitter dropped vectors");

    expect(vectors).not.toContain("## Prerequisites");
    expect(vectors).not.toContain("## Related");
    expect(vectors).toContain("## Source");
  });

  it("attributes the source and identifies the adaptation in every note", () => {
    const graph = loadGraph();
    const notes = emitObsidianVault(graph);
    const noteById = new Map(
      notes.map(({ filename, bytes }) => [filename.slice(0, -3), bytes]),
    );

    for (const concept of graph.concepts) {
      const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
      if (!source) throw new Error(`committed concept ${concept.id} lost its source`);
      const note = noteById.get(concept.id);
      expect(note).toBeDefined();
      expect(note).toContain(`source_title: ${JSON.stringify(source.title)}`);
      expect(note).toContain(`author: ${JSON.stringify(source.author)}`);
      expect(note).toContain(`license: ${JSON.stringify(source.license)}`);
      expect(note).toContain(
        `modification_notice: ${JSON.stringify(
          `Adapted (translated to plain English; atomized into concept lessons) from ` +
            `${source.title} by ${source.author}, ${source.license}.`,
        )}`,
      );
    }
  });

  it("includes every committed concept and every prerequisite edge", () => {
    const graph = loadGraph();
    const notes = emitObsidianVault(graph);
    const noteById = new Map(
      notes.map(({ filename, bytes }) => [filename.slice(0, -3), bytes]),
    );

    expect(notes).toHaveLength(graph.concepts.length);
    for (const concept of graph.concepts) expect(noteById.has(concept.id)).toBe(true);
    for (const edge of graph.edges.filter(({ type }) => type === "prereq")) {
      expect(noteById.get(edge.to)).toContain(`- [[${edge.from}]]`);
    }
  });

  it("excludes a concept whose concept provenance does not resolve", () => {
    const unresolved = structuredClone(fixtureGraph);
    const concept = unresolved.concepts.find(({ id }) => id === "vectors");
    if (!concept) throw new Error("fixture lost vectors");
    concept.provenance.sourceId = "missing-source";

    const filenames = emitObsidianVault(unresolved).map(({ filename }) => filename);
    expect(filenames).not.toContain("vectors.md");
    expect(filenames).toContain("dot-product.md");
  });

  it("fails loudly rather than dropping orphaned or dangling graph content", () => {
    const orphaned = structuredClone(fixtureGraph);
    orphaned.concepts.push({ ...structuredClone(orphaned.concepts[0]), id: "orphan" });
    expect(() => emitObsidianVault(orphaned)).toThrow("orphan concept(s): orphan");

    const dangling = structuredClone(fixtureGraph);
    dangling.edges.push({ from: "vectors", to: "missing", type: "related" });
    expect(() => emitObsidianVault(dangling)).toThrow("1 dangling edge(s)");
  });

  it("matches the committed graph-derived vault exactly", () => {
    expect(() => verifyObsidianVault(emitObsidianVault(loadGraph()), OBSIDIAN_PATH)).not.toThrow();
  });

  it("detects per-file drift plus extra and missing files", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-obsidian-"));

    try {
      const expected = emitObsidianVault(fixtureGraph);
      writeObsidianVault(expected, directory);
      expect(() => verifyObsidianVault(expected, directory)).not.toThrow();

      const firstPath = join(directory, expected[0].filename);
      writeFileSync(firstPath, `${readFileSync(firstPath, "utf8")}x`, "utf8");
      expect(() => verifyObsidianVault(expected, directory)).toThrow(
        "exports/obsidian is not the exact graph-derived vault",
      );

      writeObsidianVault(expected, directory);
      writeFileSync(join(directory, "extra.md"), "extra\n", "utf8");
      expect(() => verifyObsidianVault(expected, directory)).toThrow(
        "exports/obsidian is not the exact graph-derived vault",
      );

      writeObsidianVault(expected, directory);
      unlinkSync(firstPath);
      expect(() => verifyObsidianVault(expected, directory)).toThrow(
        "exports/obsidian is not the exact graph-derived vault",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
