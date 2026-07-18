import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { fixtureGraph, GOLDEN_PATH } from "../src/graph/fixture-graph";
import { loadGraph, loadRenderingsForVerification } from "../src/graph/load";
import type { LearningGraph, RenderingSet } from "../src/types";
import {
  emitLlmsArtifacts,
  verifyLlmsArtifacts,
  writeLlmsArtifacts,
} from "./emit-llms";

const README = `# Test Learning Graph

Every generated line has a grounded receipt.
`;

const noRenderings: RenderingSet = { renderings: [] };

describe("llms.txt build artifacts", () => {
  it("is byte-deterministic for the same committed inputs", () => {
    const first = emitLlmsArtifacts(fixtureGraph, noRenderings, README);
    const second = emitLlmsArtifacts(fixtureGraph, noRenderings, README);

    expect(Buffer.from(first.index)).toEqual(Buffer.from(second.index));
    expect(Buffer.from(first.full)).toEqual(Buffer.from(second.full));
  });

  it("uses prerequisite order rather than graph or rendering array order", () => {
    const shuffled: LearningGraph = {
      ...structuredClone(fixtureGraph),
      concepts: [...fixtureGraph.concepts].reverse(),
      edges: [...fixtureGraph.edges].reverse(),
      sources: [...fixtureGraph.sources].reverse(),
    };

    const expected = emitLlmsArtifacts(fixtureGraph, noRenderings, README);
    const actual = emitLlmsArtifacts(shuffled, noRenderings, README);
    expect(actual).toEqual(expected);

    const anchorOffsets = GOLDEN_PATH.map((id) => actual.full.indexOf(`<a id="${id}"></a>`));
    expect(anchorOffsets.every((offset) => offset >= 0)).toBe(true);
    expect(anchorOffsets).toEqual([...anchorOffsets].sort((left, right) => left - right));
  });

  it("excludes a concept whose concept provenance does not resolve", () => {
    const unresolved = structuredClone(fixtureGraph);
    const concept = unresolved.concepts.find(({ id }) => id === "vectors");
    if (!concept) throw new Error("fixture lost vectors");
    concept.provenance.sourceId = "missing-source";

    const emitted = emitLlmsArtifacts(unresolved, noRenderings, README);
    expect(emitted.full).not.toContain('<a id="vectors"></a>');
    expect(emitted.index).not.toContain("llms-full.txt#vectors");
    expect(emitted.full).toContain('<a id="dot-product"></a>');
  });

  it("emits link-only when the generated summary is absent instead of inventing copy", () => {
    const summaryless = structuredClone(fixtureGraph);
    const concept = summaryless.concepts.find(({ id }) => id === "vectors");
    if (!concept) throw new Error("fixture lost vectors");
    delete (concept as { summary?: string }).summary;

    const emitted = emitLlmsArtifacts(summaryless, noRenderings, README);
    expect(emitted.index).toContain("- [vectors](llms-full.txt#vectors)\n");
    expect(emitted.index).not.toContain("- [vectors](llms-full.txt#vectors):");
  });

  it("fails loudly rather than dropping orphaned or dangling graph content", () => {
    const orphaned = structuredClone(fixtureGraph);
    orphaned.concepts.push({ ...structuredClone(orphaned.concepts[0]), id: "orphan" });
    expect(() => emitLlmsArtifacts(orphaned, noRenderings, README)).toThrow(
      "orphan concept(s): orphan",
    );

    const dangling = structuredClone(fixtureGraph);
    dangling.edges.push({ from: "vectors", to: "missing", type: "related" });
    expect(() => emitLlmsArtifacts(dangling, noRenderings, README)).toThrow(
      "1 dangling edge(s)",
    );
  });

  it("includes every committed concept and all 20 grounded alternate renderings", () => {
    const graph = loadGraph();
    const renderings = loadRenderingsForVerification();
    const emitted = emitLlmsArtifacts(graph, renderings, readFileSync("README.md", "utf8"));

    expect(renderings.renderings).toHaveLength(20);
    expect(emitted.full.match(/^<a id=/gmu)).toHaveLength(graph.concepts.length);
    expect(emitted.full.match(/^#### Why it exists:/gmu)).toHaveLength(10);
    expect(emitted.full.match(/^#### How it works:/gmu)).toHaveLength(10);
  });

  it("makes verification fail on a one-character committed-file edit", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-llms-"));
    const paths = {
      index: join(directory, "llms.txt"),
      full: join(directory, "llms-full.txt"),
    };

    try {
      const expected = emitLlmsArtifacts(fixtureGraph, noRenderings, README);
      writeLlmsArtifacts(expected, paths);
      expect(() => verifyLlmsArtifacts(expected, paths)).not.toThrow();

      writeFileSync(paths.index, `${readFileSync(paths.index, "utf8")}x`, "utf8");
      expect(() => verifyLlmsArtifacts(expected, paths)).toThrow(
        "llms.txt is not the exact graph-derived artifact",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
