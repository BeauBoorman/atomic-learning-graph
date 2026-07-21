import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph } from "../src/graph/load";
import type { LearningGraph } from "../src/types";
import {
  ANKI_PATH,
  emitAnkiArtifact,
  escapeAnkiField,
  getCardQuestion,
  verifyAnkiArtifact,
  writeAnkiArtifact,
} from "./emit-anki";

function cardRows(artifact: string): string[] {
  return artifact
    .trimEnd()
    .split("\n")
    .filter((line) => !line.startsWith("#"));
}

describe("Anki build artifact", () => {
  it("declares its own deck and tag so imports do not collide with other courses", () => {
    const emitted = emitAnkiArtifact(fixtureGraph);
    expect(emitted).toContain("#deck:Atomic Learning Graph");
    expect(emitted).toContain("#tags:atomic-learning-graph::d2l");
  });

  it("starts with plain-language Anki import directions that do not become a card", () => {
    const emitted = emitAnkiArtifact(fixtureGraph);
    expect(emitted).toContain(
      "# This is a ready-to-study Anki deck: choose File > Import, select this .tsv file",
    );
    expect(cardRows(emitted)).toHaveLength(fixtureGraph.concepts.length);
  });

  it("is byte-deterministic for the same committed input", () => {
    const first = emitAnkiArtifact(fixtureGraph);
    const second = emitAnkiArtifact(fixtureGraph);

    expect(Buffer.from(first)).toEqual(Buffer.from(second));
  });

  it("uses prerequisite order rather than graph array order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitAnkiArtifact(fixtureGraph);
    const actual = emitAnkiArtifact(shuffled);
    expect(actual).toBe(expected);

    expect(cardRows(actual).map((row) => row.split("\t", 1)[0])).toEqual(
      GOLDEN_PATH.map((id) => {
        const concept = fixtureGraph.concepts.find((candidate) => candidate.id === id);
        if (!concept) throw new Error(`fixture lost ${id}`);
        return `ALG :: ${getCardQuestion(concept.title)}`;
      }),
    );
  });

  it("emits one Basic card per atom with its source receipt", () => {
    const graph = loadGraph();
    const rows = cardRows(emitAnkiArtifact(graph));
    const deedUrl = "https://creativecommons.org/licenses/by-sa/4.0/";

    expect(rows).toHaveLength(graph.concepts.length);
    for (const concept of graph.concepts) {
      const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
      if (!source) throw new Error(`committed concept ${concept.id} lost its source`);
      const row = rows.find((candidate) =>
        candidate.startsWith(`ALG :: ${getCardQuestion(concept.title)}\t`),
      );
      expect(row).toBeDefined();

      const fields = row!.split("\t");
      expect(fields).toHaveLength(3);

      const backField = fields[1];
      const attrField = fields[2];

      expect(backField).toContain(concept.summary);
      expect(backField).toContain(escapeAnkiField(concept.provenance.quotedText));

      expect(attrField).toContain(`Source ID: ${source.id}`);
      expect(attrField).toContain(`Title: ${source.title}`);
      expect(attrField).toContain(`Author: ${source.author}`);
      expect(attrField).toContain(`License: ${source.license} (${deedUrl})`);
      if (source.url) expect(attrField).toContain(`URL: ${source.url}`);
      expect(attrField).toContain(
        `Adapted (translated to plain English; atomized into concept lessons) from ` +
          `${source.title} by ${source.author}, ${source.license} (${deedUrl}).`,
      );
    }
  });

  it("emits every used source attribution in leading comment lines", () => {
    const graph = loadGraph();
    const emitted = emitAnkiArtifact(graph);
    const deedUrl = "https://creativecommons.org/licenses/by-sa/4.0/";
    const firstCardOffset = emitted.indexOf(cardRows(emitted)[0]);
    const usedSourceIds = new Set(
      graph.concepts.map(({ provenance }) => provenance.sourceId),
    );

    for (const source of graph.sources.filter(({ id }) => usedSourceIds.has(id))) {
      const notice =
        `Adapted (translated to plain English; atomized into concept lessons) from ` +
        `${source.title} by ${source.author}, ${source.license} (${deedUrl}).`;
      for (const expected of [
        `# Attribution source: ${source.id}`,
        `# Title: ${source.title}`,
        `# Author: ${source.author}`,
        `# License: ${source.license} (${deedUrl})`,
        `# URL: ${source.url ?? ""}`,
        `# ${notice}`,
      ]) {
        const offset = emitted.indexOf(expected);
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThan(firstCardOffset);
      }
    }
  });

  it("escapes tabs, newlines, and HTML-significant receipt text without adding card rows", () => {
    const graph = structuredClone(fixtureGraph);
    const concept = graph.concepts[0];
    const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
    if (!source) throw new Error("fixture lost source");

    concept.title = "Vectors\tand <coordinates>";
    concept.summary = "Line one\r\nLine two & more";
    const quote = "A grounded quote\twith enough content words\nfor deterministic Anki escaping.";
    concept.provenance.quotedText = quote;
    source.text = `${source.text}\n${quote}`;

    const rows = cardRows(emitAnkiArtifact(graph));
    expect(rows).toHaveLength(graph.concepts.length);
    expect(rows[0]).toContain("ALG :: What is vectors&#9;and &lt;coordinates&gt;?");
    expect(rows[0]).toContain("Line one<br>Line two &amp; more");
    expect(rows[0]).toContain(
      "A grounded quote&#9;with enough content words<br>for deterministic Anki escaping.",
    );
    expect(rows.every((row) => row.split("\t").length === 3)).toBe(true);
  });

  it("converts TeX delimiters before escaping card HTML for Anki MathJax", () => {
    expect(escapeAnkiField("Inline $x < y$ and $$z & w$$.")).toBe(
      "Inline \\(x &lt; y\\) and \\[z &amp; w\\].",
    );
  });

  it("fails loudly rather than dropping orphaned or dangling graph content", () => {
    const orphaned = structuredClone(fixtureGraph);
    orphaned.concepts.push({ ...structuredClone(orphaned.concepts[0]), id: "orphan" });
    expect(() => emitAnkiArtifact(orphaned)).toThrow("orphan concept(s): orphan");

    const dangling = structuredClone(fixtureGraph);
    dangling.edges.push({ from: "vectors", to: "missing", type: "related" });
    expect(() => emitAnkiArtifact(dangling)).toThrow("1 dangling edge(s)");
  });

  it("matches the committed graph-derived bytes", () => {
    const expected = emitAnkiArtifact(loadGraph());
    expect(Buffer.from(readFileSync(ANKI_PATH, "utf8"))).toEqual(Buffer.from(expected));
  });

  it("makes verification fail on a one-character committed-file edit", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-anki-"));
    const path = join(directory, "atomic-learning-graph-anki.tsv");

    try {
      const expected = emitAnkiArtifact(fixtureGraph);
      writeAnkiArtifact(expected, path);
      expect(() => verifyAnkiArtifact(expected, path)).not.toThrow();

      writeFileSync(path, `${readFileSync(path, "utf8")}x`, "utf8");
      expect(() => verifyAnkiArtifact(expected, path)).toThrow(
        "atomic-learning-graph-anki.tsv is not the exact graph-derived artifact",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
