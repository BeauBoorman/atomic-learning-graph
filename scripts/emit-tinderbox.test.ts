import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph } from "../src/graph/load";
import type { LearningGraph } from "../src/types";
import {
  emitTinderboxArtifact,
  TINDERBOX_PATH,
  verifyTinderboxArtifact,
  writeTinderboxArtifact,
} from "./emit-tinderbox";
import { stripControlChars } from "./emit-utils";

describe("Tinderbox OPML artifact", () => {
  it("carries a complete one-shot Tinderbox presentation contract", () => {
    const emitted = emitTinderboxArtifact(fixtureGraph);

    expect(emitted).toContain('ALGPresentation="styled-one-shot"');
    expect(emitted).toContain(
      "This is a ready-to-use visual course. Double-click atomic-learning-graph.tbx",
    );
    expect(emitted).toContain(
      "open atomic-learning-graph.opml in Tinderbox once; its map and styling are applied during import",
    );
    expect(emitted).toContain(
      'text="ALG Concept" _note="Presentation prototype for grounded learning concepts." ALGKind="prototype" IsPrototype="true" Color="#E9C46A" Shape="rounded" Badge="book" Width="5" Height="2.5"',
    );
    expect(emitted).toContain(
      'text="ALG Goal" _note="Presentation prototype for the selected learning goal." ALGKind="prototype" IsPrototype="true" Prototype="ALG Concept" Color="#E76F51" Shape="rounded" Badge="star" Width="5" Height="2.5"',
    );

    const concepts = [...emitted.matchAll(/<outline text="[^"]+"[^>]*ALGKind="concept"[^>]*\/>/gu)];
    expect(concepts).toHaveLength(fixtureGraph.concepts.length);
    for (const match of concepts) {
      expect(match[0]).toMatch(/Prototype="ALG (?:Concept|Goal)"/u);
      expect(match[0]).toMatch(/Color="#[0-9A-F]{6}"/u);
      expect(match[0]).toContain('Shape="rounded"');
      expect(match[0]).toMatch(/Badge="(?:book|star)"/u);
      expect(match[0]).toContain('Width="5"');
      expect(match[0]).toContain('Height="2.5"');
      expect(match[0]).toMatch(/Xpos="\d+(?:\.\d+)?"/u);
      expect(match[0]).toMatch(/Ypos="\d+(?:\.\d+)?"/u);
    }

    const positions = concepts.map((match) => {
      const x = match[0].match(/Xpos="([^"]+)"/u)?.[1];
      const y = match[0].match(/Ypos="([^"]+)"/u)?.[1];
      return `${x},${y}`;
    });
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("self-materializes graph positions and native prerequisite links after OPML reflow", () => {
    const emitted = emitTinderboxArtifact(fixtureGraph);
    const concepts = [...emitted.matchAll(/<outline text="[^"]+"[^>]*ALGKind="concept"[^>]*\/>/gu)];

    for (const match of concepts) {
      expect(match[0]).toMatch(/ALGXpos="\d+(?:\.\d+)?"/u);
      expect(match[0]).toMatch(/ALGYpos="\d+(?:\.\d+)?"/u);
      expect(match[0]).toContain(
        'Rule="if($ChildCount(&quot;/Atomic Learning Graph/Concepts&quot;)==5)',
      );
      expect(match[0]).toContain('$Xpos=$ALGXpos;$Ypos=$ALGYpos;');
      expect(match[0]).toContain('$Rule=&quot;&quot;}"');
    }

    expect(emitted.match(/linkTo\(/gu)).toHaveLength(
      fixtureGraph.edges.filter(({ type }) => type === "prereq").length,
    );
    expect(emitted).toContain(
      'linkTo(find($ALGKind==&quot;concept&quot; &amp; $ALGId==&quot;dot-product&quot;),&quot;prereq&quot;)',
    );
  });

  it("is byte-deterministic and uses prerequisite order rather than graph array order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitTinderboxArtifact(fixtureGraph);
    const actual = emitTinderboxArtifact(shuffled);

    expect(Buffer.from(actual)).toEqual(Buffer.from(expected));
    const offsets = GOLDEN_PATH.map((id) => actual.indexOf(`ALGId="${id}"`));
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
  });

  it("emits importable concept, source, and canonical edge records", () => {
    const graph = structuredClone(fixtureGraph);
    graph.edges.push({ from: "vectors", to: "self-attention", type: "related" });
    graph.edges.push({ from: "self-attention", to: "softmax", type: "method" });

    const emitted = emitTinderboxArtifact(graph);

    expect(emitted).toContain('<opml version="2.0">');
    expect(emitted.match(/ALGKind="concept"/gu)).toHaveLength(graph.concepts.length);
    expect(emitted.match(/ALGKind="source"/gu)).toHaveLength(graph.sources.length);
    expect(emitted.match(/ALGKind="edge"/gu)).toHaveLength(graph.edges.length);
    expect(emitted).toContain(
      'ALGKind="edge" ALGFrom="vectors" ALGTo="self-attention" ALGEdgeType="related"',
    );
    expect(emitted).toContain(
      'ALGKind="edge" ALGFrom="self-attention" ALGTo="softmax" ALGEdgeType="method"',
    );
  });

  it("carries titles, lessons, provenance, attribution, and modification notices", () => {
    const graph = loadGraph();
    const emitted = emitTinderboxArtifact(graph);
    const deedUrl = "https://creativecommons.org/licenses/by-sa/4.0/";

    for (const concept of graph.concepts) {
      const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
      if (!source || !concept.lesson) throw new Error(`committed concept ${concept.id} is incomplete`);
      expect(emitted).toContain(`ALGId="${concept.id}"`);
      expect(emitted).toContain(`text="${xmlEscaped(concept.title)}"`);
      expect(emitted).toContain(`ALGTitle="${concept.title.replaceAll("&", "&amp;")}"`);
      expect(emitted).toContain(xmlEscaped(concept.summary));
      expect(emitted).toContain(xmlEscaped(concept.provenance.quotedText));
      for (const step of concept.lesson.steps) {
        expect(emitted).toContain(xmlEscaped(stripControlChars(step.text)));
        expect(emitted).toContain(xmlEscaped(stripControlChars(step.citation.quotedText)));
      }
      expect(emitted).toContain(`ALGSourceId="${source.id}"`);
    }

    for (const source of graph.sources) {
      expect(emitted).toContain(`ALGId="${source.id}"`);
      expect(emitted).toContain(`ALGAuthor="${xmlEscaped(source.author)}"`);
      expect(emitted).toContain(`ALGLicense="${source.license}"`);
      expect(emitted).toContain(`ALGLicenseDeed="${deedUrl}"`);
      expect(emitted).toContain(
        xmlEscaped(
          `Adapted (translated to plain English; atomized into concept lessons) from ` +
            `${source.title} by ${source.author}, ${source.license} (${deedUrl}).`,
        ),
      );
    }
  });

  it("XML-escapes hostile attribute text without losing line breaks", () => {
    const graph = structuredClone(fixtureGraph);
    const concept = graph.concepts[0];
    const source = graph.sources[0];
    concept.title = 'Vectors & "coordinates" <tensors>';
    concept.summary = "First line\nSecond line";
    source.text += "\nFirst line Second line with enough grounded words for a valid quotation.";

    const emitted = emitTinderboxArtifact(graph);
    expect(emitted).toContain('ALGTitle="Vectors &amp; &quot;coordinates&quot; &lt;tensors&gt;"');
    expect(emitted).toContain("First line&#10;Second line");
    expect(emitted).not.toContain('ALGTitle="Vectors & "coordinates"');
  });

  it("keeps Tinderbox note bodies importable across em dashes without losing exact text", () => {
    const graph = structuredClone(fixtureGraph);
    const source = graph.sources[0];
    source.title = "Open Math Notes — Matrices & Attention";
    source.text += " A display clause — followed by source text that must survive import.";

    const emitted = emitTinderboxArtifact(graph);

    expect(emitted).toContain('text="Open Math Notes — Matrices &amp; Attention"');
    expect(emitted).toContain(
      'ALGTitle="Open Math Notes — Matrices &amp; Attention"',
    );
    expect(emitted).toContain(
      '_note="Open Math Notes -- Matrices &amp; Attention&#10;Source ID: s1',
    );
    expect(emitted).toContain(
      'A display clause -- followed by source text that must survive import.',
    );
    expect(emitted).toContain(
      'ALGExactText="Open Math Notes — Matrices &amp; Attention&#10;Source ID: s1',
    );
    expect(emitted).toContain(
      'A display clause — followed by source text that must survive import.',
    );
  });

  it("fails closed instead of emitting structurally or citation-invalid content", () => {
    const orphaned = structuredClone(fixtureGraph);
    orphaned.concepts.push({ ...structuredClone(orphaned.concepts[0]), id: "orphan" });
    expect(() => emitTinderboxArtifact(orphaned)).toThrow("orphan concept(s): orphan");

    const dangling = structuredClone(fixtureGraph);
    dangling.edges.push({ from: "vectors", to: "missing", type: "related" });
    expect(() => emitTinderboxArtifact(dangling)).toThrow("1 dangling edge(s)");

    const ungrounded = structuredClone(fixtureGraph);
    ungrounded.concepts[0].provenance.quotedText = "fabricated source passage";
    expect(() => emitTinderboxArtifact(ungrounded)).toThrow("invalid concept provenance");
  });

  it("matches the committed graph-derived bytes", () => {
    const expected = emitTinderboxArtifact(loadGraph());
    expect(Buffer.from(readFileSync(TINDERBOX_PATH, "utf8"))).toEqual(Buffer.from(expected));
  });

  it("makes verification fail on a one-character committed-file edit", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-tinderbox-"));
    const path = join(directory, "atomic-learning-graph.opml");

    try {
      const expected = emitTinderboxArtifact(fixtureGraph);
      writeTinderboxArtifact(expected, path);
      expect(() => verifyTinderboxArtifact(expected, path)).not.toThrow();

      writeFileSync(path, `${readFileSync(path, "utf8")}x`, "utf8");
      expect(() => verifyTinderboxArtifact(expected, path)).toThrow(
        "atomic-learning-graph.opml is not the exact graph-derived artifact",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function xmlEscaped(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r\n", "&#10;")
    .replaceAll("\r", "&#10;")
    .replaceAll("\n", "&#10;");
}
