import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph } from "../src/graph/load";
import type { LearningGraph } from "../src/types";
import {
  emitObsidianVault,
  OBSIDIAN_CONCEPTS_DIR,
  OBSIDIAN_PATH,
  OBSIDIAN_SOURCES_DIR,
  OBSIDIAN_START_HERE,
  type ObsidianNote,
  verifyObsidianVault,
  writeObsidianVault,
} from "./emit-obsidian";

const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/gu;

function noteMap(notes: readonly ObsidianNote[]): Map<string, string> {
  return new Map(notes.map(({ filename, bytes }) => [filename, bytes]));
}

function frontmatterBlock(bytes: string): string {
  expect(bytes.startsWith("---\n")).toBe(true);
  const end = bytes.indexOf("\n---\n", 4);
  expect(end).toBeGreaterThan(0);
  return bytes.slice(4, end);
}

function wikilinkTargets(bytes: string): string[] {
  return [...bytes.matchAll(WIKILINK)].map((match) => match[1]);
}

describe("Obsidian markdown vault", () => {
  it("uses a native vault layout: Start Here, Concepts/, and Sources/ in prerequisite order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitObsidianVault(fixtureGraph);
    const actual = emitObsidianVault(shuffled);

    expect(actual).toEqual(expected);
    expect(actual.map(({ filename }) => filename)).toEqual([
      OBSIDIAN_START_HERE,
      ...GOLDEN_PATH.map((id) => `${OBSIDIAN_CONCEPTS_DIR}/${id}.md`),
      `${OBSIDIAN_SOURCES_DIR}/s1.md`,
    ]);
    for (const [index, note] of actual.entries()) {
      expect(Buffer.from(note.bytes)).toEqual(Buffer.from(expected[index].bytes));
    }
  });

  it("gives every concept note valid frontmatter with typed link properties and tags", () => {
    const graph = structuredClone(fixtureGraph);
    const goal = graph.concepts.find(({ id }) => id === "self-attention");
    if (!goal) throw new Error("fixture lost self-attention");
    goal.tags = ["transformers", "llm attention"];
    graph.edges.push({ from: "vectors", to: "self-attention", type: "related" });
    graph.edges.push({ from: "softmax", to: "self-attention", type: "method" });

    const notes = noteMap(emitObsidianVault(graph));
    const goalNote = notes.get(`${OBSIDIAN_CONCEPTS_DIR}/self-attention.md`);
    if (!goalNote) throw new Error("emitter dropped the goal note");
    const fm = frontmatterBlock(goalNote);

    expect(fm).toContain('title: "self-attention"');
    expect(fm).toContain("aliases:\n");
    // tags are namespaced, space-free, and sorted; the "concept" type tag is always present.
    expect(fm).toContain("  - \"concept\"");
    expect(fm).toContain("  - \"llm-attention\"");
    expect(fm).toContain("  - \"transformers\"");
    expect(fm).not.toMatch(/ - "[^"]* [^"]*"/u);
    // relations are Dataview-queryable link properties.
    expect(fm).toContain('source: "[[Sources/s1]]"');
    expect(fm).toContain('prerequisites:\n  - "[[Concepts/qkv]]"');
    expect(fm).toContain('methods:\n  - "[[Concepts/softmax]]"');
    expect(fm).toContain('related:\n  - "[[Concepts/vectors]]"');
    // attribution travels with the note.
    expect(fm).toContain('license: "CC-BY-SA-4.0"');
    expect(fm).toContain('license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"');
    expect(fm).toContain("modification_notice:");

    // body carries the same relations as human-readable, path-qualified wikilinks.
    expect(goalNote).toContain("## Prerequisites\n\n- [[Concepts/qkv|qkv]]");
    expect(goalNote).toContain("## Methods\n\n- [[Concepts/softmax|softmax]]");
    expect(goalNote).toContain("## Related\n\n- [[Concepts/vectors|vectors]]");
    // every lesson step cites its source as a resolvable wikilink.
    expect(goalNote).toContain("**Source receipt — [[Sources/s1|How LLMs work (primer)]]**");
    expect(goalNote).toContain("## Source\n\nAdapted from [[Sources/s1|How LLMs work (primer)]].");
  });

  it("emits a source hub note per cited source with attribution and concept backlinks", () => {
    const notes = noteMap(emitObsidianVault(fixtureGraph));
    const sourceNote = notes.get(`${OBSIDIAN_SOURCES_DIR}/s1.md`);
    if (!sourceNote) throw new Error("emitter dropped the source hub");
    const fm = frontmatterBlock(sourceNote);

    expect(fm).toContain('title: "How LLMs work (primer)"');
    expect(fm).toContain('  - "source"');
    expect(fm).toContain('author: "Fixture author"');
    expect(fm).toContain('license: "CC-BY-SA-4.0"');
    expect(fm).toContain('license_deed: "https://creativecommons.org/licenses/by-sa/4.0/"');
    expect(sourceNote).toContain(
      "- **License:** [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)",
    );
    expect(sourceNote).toContain("## Concepts from this source");
    for (const id of GOLDEN_PATH) expect(sourceNote).toContain(`[[Concepts/${id}|${id}]]`);
  });

  it("resolves every wikilink to a real note path — the graph view has no dead links", () => {
    for (const graph of [fixtureGraph, loadGraph()]) {
      const notes = emitObsidianVault(graph);
      const filenames = new Set(notes.map(({ filename }) => filename));
      for (const { bytes } of notes) {
        for (const target of wikilinkTargets(bytes)) {
          expect(filenames.has(`${target}.md`)).toBe(true);
        }
      }
    }
  });

  it("opens with a human-readable learning path, goal link, and source index", () => {
    const notes = noteMap(emitObsidianVault(fixtureGraph));
    const startHere = notes.get(OBSIDIAN_START_HERE);
    if (!startHere) throw new Error("emitter dropped Start Here");

    expect(startHere).toContain("# Atomic Learning Graph");
    expect(startHere).toContain("**Goal:** [[Concepts/self-attention|self-attention]]");
    const path = startHere.slice(startHere.indexOf("## Learning path"), startHere.indexOf("## Sources"));
    const pathOffsets = GOLDEN_PATH.map((id) => path.indexOf(`[[Concepts/${id}|${id}]]`));
    expect(pathOffsets.every((offset) => offset >= 0)).toBe(true);
    expect(pathOffsets).toEqual([...pathOffsets].sort((left, right) => left - right));
    expect(startHere).toContain("## Sources\n\n- [[Sources/s1|How LLMs work (primer)]]");

    for (const concept of fixtureGraph.concepts) {
      const note = notes.get(`${OBSIDIAN_CONCEPTS_DIR}/${concept.id}.md`);
      if (!note || !concept.lesson) throw new Error(`emitter dropped ${concept.id}`);
      expect(note).toContain(`# ${concept.title}`);
      expect(note).toContain(`## Lesson: ${concept.lesson.plainTitle}`);
      for (const step of concept.lesson.steps) {
        expect(note).toContain(step.text);
        expect(note).toContain(step.citation.quotedText);
      }
    }
  });

  it("omits empty relationship sections and their frontmatter keys", () => {
    const notes = noteMap(emitObsidianVault(fixtureGraph));
    const vectors = notes.get(`${OBSIDIAN_CONCEPTS_DIR}/vectors.md`);
    if (!vectors) throw new Error("emitter dropped vectors");

    expect(vectors).not.toContain("## Prerequisites");
    expect(vectors).not.toContain("## Methods");
    expect(vectors).not.toContain("## Related");
    expect(vectors).not.toContain("prerequisites:");
    expect(vectors).toContain("## Source");
  });

  it("attributes the source and identifies the adaptation across concept and source notes", () => {
    const graph = loadGraph();
    const notes = noteMap(emitObsidianVault(graph));
    const deedUrl = "https://creativecommons.org/licenses/by-sa/4.0/";

    for (const concept of graph.concepts) {
      const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
      if (!source) throw new Error(`committed concept ${concept.id} lost its source`);
      const conceptNote = notes.get(`${OBSIDIAN_CONCEPTS_DIR}/${concept.id}.md`);
      expect(conceptNote).toBeDefined();
      expect(conceptNote).toContain(`license: ${JSON.stringify(source.license)}`);
      expect(conceptNote).toContain(`license_deed: ${JSON.stringify(deedUrl)}`);
      expect(conceptNote).toContain(`source: "[[Sources/${source.id}]]"`);

      const sourceNote = notes.get(`${OBSIDIAN_SOURCES_DIR}/${source.id}.md`);
      expect(sourceNote).toBeDefined();
      expect(sourceNote).toContain(`author: ${JSON.stringify(source.author)}`);
      expect(sourceNote).toContain(`license: ${JSON.stringify(source.license)}`);
      expect(sourceNote).toContain(
        `Adapted (translated to plain English; atomized into concept lessons) from ` +
          `${source.title} by ${source.author}, ${source.license} (${deedUrl}).`,
      );
    }
  });

  it("includes every committed concept and every prerequisite edge", () => {
    const graph = loadGraph();
    const notes = noteMap(emitObsidianVault(graph));

    for (const concept of graph.concepts) {
      expect(notes.has(`${OBSIDIAN_CONCEPTS_DIR}/${concept.id}.md`)).toBe(true);
    }
    for (const edge of graph.edges.filter(({ type }) => type === "prereq")) {
      const target = notes.get(`${OBSIDIAN_CONCEPTS_DIR}/${edge.to}.md`);
      expect(target).toContain(`[[Concepts/${edge.from}|`);
    }
  });

  it("excludes a concept whose concept provenance does not resolve", () => {
    const unresolved = structuredClone(fixtureGraph);
    const concept = unresolved.concepts.find(({ id }) => id === "vectors");
    if (!concept) throw new Error("fixture lost vectors");
    concept.provenance.sourceId = "missing-source";

    const filenames = emitObsidianVault(unresolved).map(({ filename }) => filename);
    expect(filenames).not.toContain(`${OBSIDIAN_CONCEPTS_DIR}/vectors.md`);
    expect(filenames).toContain(`${OBSIDIAN_CONCEPTS_DIR}/dot-product.md`);
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

  it("detects per-file drift plus extra and missing files across folders", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-obsidian-"));

    try {
      const expected = emitObsidianVault(fixtureGraph);
      writeObsidianVault(expected, directory);
      expect(() => verifyObsidianVault(expected, directory)).not.toThrow();

      const nestedPath = join(directory, expected[1].filename);
      writeFileSync(nestedPath, `${readFileSync(nestedPath, "utf8")}x`, "utf8");
      expect(() => verifyObsidianVault(expected, directory)).toThrow(
        "exports/obsidian is not the exact graph-derived vault",
      );

      writeObsidianVault(expected, directory);
      const extraPath = join(directory, OBSIDIAN_CONCEPTS_DIR, "extra.md");
      mkdirSync(dirname(extraPath), { recursive: true });
      writeFileSync(extraPath, "extra\n", "utf8");
      expect(() => verifyObsidianVault(expected, directory)).toThrow(
        "exports/obsidian is not the exact graph-derived vault",
      );

      writeObsidianVault(expected, directory);
      unlinkSync(join(directory, expected[1].filename));
      expect(() => verifyObsidianVault(expected, directory)).toThrow(
        "exports/obsidian is not the exact graph-derived vault",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
