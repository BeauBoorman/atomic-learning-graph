import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AtomizedConcept, Source } from "../types";
import type { ResponsesClient } from "./client";
import {
  chunkSourceText,
  discoverRelationships,
  loadSources,
  main,
  parseAtomizeArgs,
  pinInventoryToSpine,
  pinRelationshipsToSpine,
  planChunks,
  selectToySource,
  writeAtomizationRunLog,
} from "./atomize";
import { FULL_GRAPH_SPINE } from "./repair";

const repoRoot = resolve(import.meta.dirname, "..", "..");

describe("unpinned source chunking", () => {
  it("splits long text into bounded chunks while preserving every passage", () => {
    const passages = [
      "Alpha introduces the first idea.",
      "Beta develops the second idea.",
      "Gamma finishes the third idea.",
    ];
    const chunks = chunkSourceText(passages.join("\n\n"), 65);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 65)).toBe(true);
    expect(chunks.join("\n\n")).toBe(passages.join("\n\n"));
  });

  it("ships one oversized passage whole instead of splitting it", () => {
    const oversized = `${"Long sentence material ".repeat(8).trim()}.`;
    expect(chunkSourceText(oversized, 40)).toEqual([oversized]);
  });

  it("returns one chunk for empty and short input", () => {
    expect(chunkSourceText("")).toEqual([""]);
    expect(chunkSourceText("One short passage.")).toEqual(["One short passage."]);
  });

  it("plans every chunk from every source in manifest order", () => {
    const sources: Source[] = [
      {
        id: "source-a",
        title: "Source A",
        license: "CC0-1.0",
        author: "Test",
        text: "First source passage.",
      },
      {
        id: "source-b",
        title: "Source B",
        license: "CC0-1.0",
        author: "Test",
        text: "Second source passage.",
      },
    ];

    expect(planChunks(sources).map(({ sourceId, index, total }) => ({ sourceId, index, total })))
      .toEqual([
        { sourceId: "source-a", index: 0, total: 1 },
        { sourceId: "source-b", index: 0, total: 1 },
      ]);
  });
});

describe("unpinned relationship discovery", () => {
  const concept = (id: string): AtomizedConcept => ({
    id,
    title: id,
    summary: `Summary for ${id}.`,
    provenance: {
      sourceId: "source",
      quotedText: `${id} has a substantial grounded quote copied from the source passage.`,
    },
    tags: [],
    prerequisites: [],
    related: [],
  });

  it("applies valid edges and drops self-loop and unknown-ID edges", async () => {
    const client = {
      request: vi.fn().mockResolvedValue({
        edges: [
          { from: "alpha", to: "beta" },
          { from: "beta", to: "gamma" },
          { from: "gamma", to: "gamma" },
          { from: "missing", to: "gamma" },
        ],
      }),
    } as unknown as ResponsesClient;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const related = await discoverRelationships(client, [
        concept("alpha"),
        concept("beta"),
        concept("gamma"),
      ]);
      expect(related.find(({ id }) => id === "beta")?.prerequisites).toEqual(["alpha"]);
      expect(related.find(({ id }) => id === "gamma")?.prerequisites).toEqual(["beta"]);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it("drops an edge that would close a prerequisite cycle", async () => {
    const client = {
      request: vi.fn().mockResolvedValue({
        edges: [
          { from: "alpha", to: "beta" },
          { from: "beta", to: "gamma" },
          { from: "gamma", to: "alpha" },
        ],
      }),
    } as unknown as ResponsesClient;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const related = await discoverRelationships(client, [
        concept("alpha"),
        concept("beta"),
        concept("gamma"),
      ]);
      expect(related.find(({ id }) => id === "alpha")?.prerequisites).toEqual([]);
      expect(related.find(({ id }) => id === "beta")?.prerequisites).toEqual(["alpha"]);
      expect(related.find(({ id }) => id === "gamma")?.prerequisites).toEqual(["beta"]);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/would create a cycle/i));
    } finally {
      warn.mockRestore();
    }
  });
});

describe("atomizer input and output selection", () => {
  it("requires an explicit output directory for every non-toy run", () => {
    expect(() => parseAtomizeArgs([])).toThrow(/--out-dir/);
    expect(parseAtomizeArgs(["--out-dir", ".artifacts/demo"])).toMatchObject({
      outDir: resolve(repoRoot, ".artifacts/demo"),
      overwriteExisting: false,
      toyOnly: false,
    });
  });

  it("accepts only the unmistakable overwrite flag", () => {
    expect(parseAtomizeArgs(["--out-dir", ".artifacts/demo", "--overwrite-existing"]))
      .toMatchObject({ overwriteExisting: true });
    expect(() => parseAtomizeArgs(["--out-dir", ".artifacts/demo", "--force"]))
      .toThrow(/unknown option/i);
  });

  it("keeps the LLM atomicity judge opt-in and off by default", () => {
    expect(parseAtomizeArgs(["--out-dir", ".artifacts/demo"])).toMatchObject({
      atomicityJudge: false,
    });
    expect(
      parseAtomizeArgs(["--out-dir", ".artifacts/demo", "--atomicity-judge"]),
    ).toMatchObject({ atomicityJudge: true });
  });

  it("keeps response IDs by default and makes their omission explicit", () => {
    expect(parseAtomizeArgs(["--out-dir", ".artifacts/demo"])).toMatchObject({
      omitResponseIds: false,
    });
    expect(
      parseAtomizeArgs(["--out-dir", ".artifacts/demo", "--no-response-ids"]),
    ).toMatchObject({ omitResponseIds: true });
  });

  it("writes atomization run logs with response IDs by default and without them on opt-in", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "atomic-run-log-"));
    const defaultPath = resolve(directory, "graph.default.run.json");
    const omittedPath = resolve(directory, "graph.omitted.run.json");
    const metadata = {
      model: "fake-model",
      graphSha256: "graph-sha",
      manifestSha256: "manifest-sha",
      promptVersion: "prompt-v3",
      convergence: [{ attempt: 1, issues: [] }],
    };

    try {
      writeAtomizationRunLog(defaultPath, metadata, ["resp_1", "resp_2"], false);
      writeAtomizationRunLog(omittedPath, metadata, ["resp_1", "resp_2"], true);
      const defaultRun = JSON.parse(readFileSync(defaultPath, "utf8")) as Record<string, unknown>;
      const omittedRun = JSON.parse(readFileSync(omittedPath, "utf8")) as Record<string, unknown>;
      expect(defaultRun).toEqual({ ...metadata, responseIds: ["resp_1", "resp_2"] });
      expect(omittedRun).toEqual(metadata);
      expect(omittedRun).not.toHaveProperty("responseIds");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses an occupied --out-dir before initializing a model client", async () => {
    const outDir = mkdtempSync(resolve(tmpdir(), "atomic-out-dir-"));
    writeFileSync(resolve(outDir, "graph.json"), "do not clobber\n", "utf8");
    await expect(main(["--out-dir", outDir])).rejects.toThrow(/refusing to overwrite/i);
  });

  it("resolves a second manifest relative to its own corpus directory", () => {
    const manifestPath = resolve(
      repoRoot,
      "data/corpora/openstax-physics/sources.json",
    );
    const { sources } = loadSources(manifestPath);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      id: "openstax-physics-newtons-first-law",
      license: "CC-BY-4.0",
    });
    expect(sources[0]?.text).toContain("Newton’s first law");
  });

  it("selects one source for the toy proof without assuming a D2L source ID", () => {
    const source = {
      id: "openstax-physics-newtons-first-law",
      title: "OpenStax Physics",
      license: "CC-BY-4.0",
      author: "OpenStax, Rice University",
      text: "A body at rest tends to remain at rest.",
    };
    expect(selectToySource([source])).toEqual(source);
  });
});

describe("full-graph spine", () => {
  const sources: Source[] = [...new Set(FULL_GRAPH_SPINE.concepts.map(({ sourceId }) => sourceId))]
    .map((sourceId) => ({
      id: sourceId,
      title: sourceId,
      license: "CC-BY-SA-4.0",
      author: "Test Author",
      text: FULL_GRAPH_SPINE.concepts
        .filter((concept) => concept.sourceId === sourceId)
        .map(({ id }) => `${id} has a substantial grounded quote in its assigned source.`)
        .join(" "),
    }));

  const proposed: AtomizedConcept[] = FULL_GRAPH_SPINE.concepts.map(({ id }) => ({
    id,
    title: id,
    summary: `One generated summary for ${id}.`,
    provenance: {
      sourceId: "model-chose-the-wrong-source",
      quotedText: `${id} has a substantial grounded quote in its assigned source.`,
    },
    tags: ["generated"],
    prerequisites: [],
    related: [],
  }));

  it("projects inventory onto exactly the ten pinned IDs and source assignments", () => {
    const pinned = pinInventoryToSpine(
      [
        ...proposed,
        {
          ...proposed[0]!,
          id: "model-discovered-drift",
          title: "Model-discovered drift",
        },
      ],
      sources,
      FULL_GRAPH_SPINE,
    );

    expect(pinned.map(({ id, provenance }) => ({ id, sourceId: provenance.sourceId }))).toEqual(
      FULL_GRAPH_SPINE.concepts,
    );
  });

  it("projects relationship output onto exactly the nine pinned prerequisite edges", () => {
    const inventory = pinInventoryToSpine(proposed, sources, FULL_GRAPH_SPINE);
    const modelRelations = inventory.map((concept) => ({
      ...concept,
      prerequisites: concept.id === "vectors" ? ["positional-encoding"] : ["drift-edge"],
      related: ["vectors"],
    }));

    const pinned = pinRelationshipsToSpine(inventory, modelRelations, FULL_GRAPH_SPINE);
    const edges = pinned.flatMap((concept) =>
      concept.prerequisites.map((from) => ({ from, to: concept.id, type: "prereq" as const })),
    );

    expect(edges).toHaveLength(9);
    expect(edges).toEqual(expect.arrayContaining([...FULL_GRAPH_SPINE.prereqEdges]));
    expect(pinned.every(({ related }) => related.length === 0)).toBe(true);
  });
});
