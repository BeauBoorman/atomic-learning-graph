import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph } from "../src/graph/load";
import { buildRecallRubric } from "../src/graph/recall-rubric";
import type { LearningGraph } from "../src/types";
import {
  EXAM_PATH,
  emitExamArtifact,
  verifyExamArtifact,
  writeExamArtifact,
} from "./emit-exam";

function partAQuestions(artifact: string): string[] {
  const partA = artifact.split("## Part B")[0];
  return partA.split("\n").filter((line) => /^\d+\. /u.test(line));
}

describe("practice exam build artifact", () => {
  it("is byte-deterministic for the same committed input", () => {
    const first = emitExamArtifact(fixtureGraph);
    const second = emitExamArtifact(fixtureGraph);

    expect(Buffer.from(first)).toEqual(Buffer.from(second));
  });

  it("uses prerequisite order rather than graph array order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitExamArtifact(fixtureGraph);
    const actual = emitExamArtifact(shuffled);
    expect(actual).toBe(expected);

    expect(partAQuestions(actual)).toEqual(
      GOLDEN_PATH.map((id, index) => {
        const concept = fixtureGraph.concepts.find((candidate) => candidate.id === id);
        if (!concept) throw new Error(`fixture lost ${id}`);
        return `${index + 1}. In your own words, explain **${concept.title}**.`;
      }),
    );
  });

  it("emits one Part A question and one grounded key entry per atom", () => {
    const graph = loadGraph();
    const emitted = emitExamArtifact(graph);

    expect(partAQuestions(emitted)).toHaveLength(graph.concepts.length);
    for (const concept of graph.concepts) {
      const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
      if (!source) throw new Error(`committed concept ${concept.id} lost its source`);
      expect(emitted).toContain(`In your own words, explain **${concept.title}**.`);
      expect(emitted).toContain(concept.summary);
      const quotedText = concept.provenance.quotedText
        .split(/\r\n|\r|\n/u)
        .map((line) => `> ${line}`)
        .join("\n");
      expect(emitted).toContain(quotedText);
      expect(emitted).toContain(`Source ID: ${source.id}`);
      expect(emitted).toContain(`→ ${concept.title} (\`${concept.id}\`)`);
    }
  });

  it("keeps model answers out of the question sections", () => {
    const graph = loadGraph();
    const emitted = emitExamArtifact(graph);
    const answerKeyOffset = emitted.indexOf("## Answer Key — Part A");
    expect(answerKeyOffset).toBeGreaterThan(0);

    for (const concept of graph.concepts) {
      expect(emitted.indexOf(concept.summary)).toBeGreaterThan(answerKeyOffset);
    }
  });

  it("emits every used source attribution with a modification notice", () => {
    const graph = loadGraph();
    const emitted = emitExamArtifact(graph);
    const deedUrl = "https://creativecommons.org/licenses/by-sa/4.0/";
    const usedSourceIds = new Set(
      graph.concepts.map(({ provenance }) => provenance.sourceId),
    );

    for (const source of graph.sources.filter(({ id }) => usedSourceIds.has(id))) {
      expect(emitted).toContain(`### ${source.id}`);
      expect(emitted).toContain(`- License: ${source.license} (${deedUrl})`);
      expect(emitted).toContain(
        `Adapted (translated to plain English; atomized into concept lessons; recast as ` +
          `practice-exam questions) from ${source.title} by ${source.author}, ` +
          `${source.license} (${deedUrl}).`,
      );
    }
  });

  it("emits one source-anchored recall rubric per concept", () => {
    const graph = loadGraph();
    const emitted = emitExamArtifact(graph);

    expect(emitted.match(/^#### Recall rubric$/gmu)).toHaveLength(graph.concepts.length);
    for (const concept of graph.concepts) {
      const rubric = buildRecallRubric(concept);
      for (const item of rubric.items) {
        expect(emitted).toContain(
          `must mention: ${item.mustMention.map((term) => `\`${term}\``).join(", ")}`,
        );
        expect(emitted).toContain(`Verbatim source span (\`${item.sourceId}\`)`);
        expect(emitted).toContain(
          item.quotedText
            .split(/\r\n|\r|\n/u)
            .map((line) => `> ${line}`)
            .join("\n"),
        );
      }
    }
  });

  it("fails loudly rather than dropping orphaned or dangling graph content", () => {
    const orphaned = structuredClone(fixtureGraph);
    orphaned.concepts.push({ ...structuredClone(orphaned.concepts[0]), id: "orphan" });
    expect(() => emitExamArtifact(orphaned)).toThrow("orphan concept(s): orphan");

    const dangling = structuredClone(fixtureGraph);
    dangling.edges.push({ from: "vectors", to: "missing", type: "related" });
    expect(() => emitExamArtifact(dangling)).toThrow("1 dangling edge(s)");
  });

  it("fails closed rather than emitting an ungrounded recall-rubric item", () => {
    const tampered = structuredClone(fixtureGraph);
    tampered.concepts[0].lesson!.steps[1].citation.quotedText =
      "This fabricated rubric quote does not occur anywhere inside the source document.";

    expect(() => emitExamArtifact(tampered)).toThrow(
      "invalid recall rubric citations: vectors[1]:quote-not-found",
    );
  });

  it("matches the committed graph-derived bytes", () => {
    const expected = emitExamArtifact(loadGraph());
    expect(Buffer.from(readFileSync(EXAM_PATH, "utf8"))).toEqual(Buffer.from(expected));
  });

  it("makes verification fail on a one-character committed-file edit", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-exam-"));
    const path = join(directory, "atomic-learning-graph-exam.md");

    try {
      const expected = emitExamArtifact(fixtureGraph);
      writeExamArtifact(expected, path);
      expect(() => verifyExamArtifact(expected, path)).not.toThrow();

      writeFileSync(path, `${readFileSync(path, "utf8")}x`, "utf8");
      expect(() => verifyExamArtifact(expected, path)).toThrow(
        "atomic-learning-graph-exam.md is not the exact graph-derived artifact",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
