import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph } from "../src/graph/load";
import type { LearningGraph } from "../src/types";
import {
  emitOrgRoamArtifact,
  ORG_ROAM_PATH,
  verifyOrgRoamArtifact,
  writeOrgRoamArtifact,
} from "./emit-orgroam";

describe("org-roam build artifact", () => {
  it("is byte-deterministic for the same committed input", () => {
    const first = emitOrgRoamArtifact(fixtureGraph);
    const second = emitOrgRoamArtifact(fixtureGraph);

    expect(Buffer.from(first)).toEqual(Buffer.from(second));
  });

  it("uses prerequisite order rather than graph array order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitOrgRoamArtifact(fixtureGraph);
    const actual = emitOrgRoamArtifact(shuffled);
    expect(actual).toBe(expected);

    const nodeOffsets = GOLDEN_PATH.map((id) => actual.indexOf(`:ID: ${id}`));
    expect(nodeOffsets.every((offset) => offset >= 0)).toBe(true);
    expect(nodeOffsets).toEqual([...nodeOffsets].sort((left, right) => left - right));
  });

  it("emits stable org-roam IDs, source refs, and prerequisite links", () => {
    const emitted = emitOrgRoamArtifact(fixtureGraph);

    expect(emitted).toContain(":ID: self-attention");
    // Each concept must own a UNIQUE :ROAM_REFS: value (org-roam indexes it as an external
    // identifier). Concepts that cite the same source would collide on the bare source URL,
    // so the emitter appends a per-concept URL fragment.
    const refsMatches = [...emitted.matchAll(/:ROAM_REFS: ([^\n]+)\n/gu)];
    expect(refsMatches.length).toBe(fixtureGraph.concepts.length);
    const refsValues = refsMatches.map((match) => match[1]);
    expect(new Set(refsValues).size).toBe(refsValues.length);
    for (const concept of fixtureGraph.concepts) {
      const source = fixtureGraph.sources.find(({ id }) => id === concept.provenance.sourceId);
      if (!source) throw new Error(`fixture lost source for ${concept.id}`);
      const baseUrl = source.url ?? source.id;
      expect(emitted).toContain(`:ROAM_REFS: ${baseUrl}#${concept.id}`);
    }
    expect(emitted).toContain("- [[id:qkv]]");
    expect(emitted).not.toContain("- [[id:self-attention]]");
  });

  it("opens with the prerequisite-ordered learning path and leaves attribution after the course", () => {
    const emitted = emitOrgRoamArtifact(fixtureGraph);

    expect(emitted).toContain("#+startup: overview");
    expect(emitted).toContain(
      "This is a ready-to-use org-roam course: put this file in your org-roam folder",
    );
    expect(emitted).toContain("* Learning Path");
    expect(emitted).toContain("Goal: [[id:self-attention][self-attention]]");
    const path = emitted.slice(emitted.indexOf("1. [[id:vectors]"));
    const pathOffsets = GOLDEN_PATH.map((id) => path.indexOf(`[[id:${id}][${id}]]`));
    expect(pathOffsets.every((offset) => offset >= 0)).toBe(true);
    expect(pathOffsets).toEqual([...pathOffsets].sort((left, right) => left - right));
    expect(emitted.indexOf("* Learning Path")).toBeLessThan(emitted.indexOf(":ID: vectors"));
    expect(emitted.indexOf("* Source Attributions")).toBeGreaterThan(
      emitted.indexOf(":ID: self-attention"),
    );
  });

  it("emits summaries, lesson prose, and provenance quotes verbatim", () => {
    const concept = fixtureGraph.concepts.find(({ id }) => id === "vectors");
    if (!concept?.lesson) throw new Error("fixture lost vectors lesson");

    const emitted = emitOrgRoamArtifact(fixtureGraph);
    expect(emitted).toContain(concept.summary);
    expect(emitted).toContain(concept.provenance.quotedText);
    for (const step of concept.lesson.steps) {
      expect(emitted).toContain(step.text);
      expect(emitted).toContain(step.citation.quotedText);
    }
  });

  it("attributes every source and identifies the adaptation", () => {
    const graph = loadGraph();
    const emitted = emitOrgRoamArtifact(graph);
    const deedUrl = "https://creativecommons.org/licenses/by-sa/4.0/";

    for (const source of graph.sources) {
      const notice =
        `Adapted (translated to plain English; atomized into concept lessons) from ` +
        `${source.title} by ${source.author}, ${source.license} (${deedUrl}).`;
      expect(emitted).toContain("* Source Attributions");
      expect(emitted).toContain(`Title: ${source.title}`);
      expect(emitted).toContain(`Author: ${source.author}`);
      expect(emitted).toContain(`License: ${source.license} (${deedUrl})`);
      expect(emitted).toContain(`URL: ${source.url ?? ""}`);
      expect(emitted).toContain(notice);
    }
  });

  it("includes every committed concept and every prerequisite edge", () => {
    const graph = loadGraph();
    const emitted = emitOrgRoamArtifact(graph);

    expect(emitted.match(/^:ID:/gmu)).toHaveLength(graph.concepts.length);
    for (const edge of graph.edges.filter(({ type }) => type === "prereq")) {
      const nodeStart = emitted.indexOf(`:ID: ${edge.to}\n`);
      expect(nodeStart).toBeGreaterThanOrEqual(0);
      const nextNode = emitted.indexOf("\n* ", nodeStart);
      const node = emitted.slice(nodeStart, nextNode < 0 ? undefined : nextNode);
      expect(node).toContain(`- [[id:${edge.from}]]`);
    }
  });

  it("excludes a concept whose concept provenance does not resolve", () => {
    const unresolved = structuredClone(fixtureGraph);
    const concept = unresolved.concepts.find(({ id }) => id === "vectors");
    if (!concept) throw new Error("fixture lost vectors");
    concept.provenance.sourceId = "missing-source";

    const emitted = emitOrgRoamArtifact(unresolved);
    expect(emitted).not.toContain(":ID: vectors");
    expect(emitted).toContain(":ID: dot-product");
  });

  it("fails loudly rather than dropping orphaned or dangling graph content", () => {
    const orphaned = structuredClone(fixtureGraph);
    orphaned.concepts.push({ ...structuredClone(orphaned.concepts[0]), id: "orphan" });
    expect(() => emitOrgRoamArtifact(orphaned)).toThrow("orphan concept(s): orphan");

    const dangling = structuredClone(fixtureGraph);
    dangling.edges.push({ from: "vectors", to: "missing", type: "related" });
    expect(() => emitOrgRoamArtifact(dangling)).toThrow("1 dangling edge(s)");
  });

  it("matches the committed graph-derived bytes", () => {
    const expected = emitOrgRoamArtifact(loadGraph());
    expect(Buffer.from(readFileSync(ORG_ROAM_PATH, "utf8"))).toEqual(Buffer.from(expected));
  });

  it("makes verification fail on a one-character committed-file edit", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-orgroam-"));
    const path = join(directory, "atomic-learning-graph.org");

    try {
      const expected = emitOrgRoamArtifact(fixtureGraph);
      writeOrgRoamArtifact(expected, path);
      expect(() => verifyOrgRoamArtifact(expected, path)).not.toThrow();

      writeFileSync(path, `${readFileSync(path, "utf8")}x`, "utf8");
      expect(() => verifyOrgRoamArtifact(expected, path)).toThrow(
        "atomic-learning-graph.org is not the exact graph-derived artifact",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
