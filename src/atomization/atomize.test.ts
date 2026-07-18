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

  it("returns only byte-exact source substrings for mixed structured input", () => {
    const text = [
      "Introductory prose about vectors.",
      "",
      "$$",
      "q_i = W_q x_i",
      "$$",
      "",
      "| Symbol | Meaning |",
      "|---|---|",
      "| q | query |",
      "",
      "```js",
      "arr.push(x).",
      "```",
    ].join("\n");

    const chunks = chunkSourceText(text, 48);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => text.includes(chunk))).toBe(true);
  });

  it("keeps display math and begin/end environments atomic at their outer edges", () => {
    const displayMath = "$$\nq_i = W_q x_i\n$$";
    const alignedMath = "\\begin{align}\na &= b + c \\\\\nd &= e\n\\end{align}";
    const text = `Lead prose.\n\n${displayMath}\n\nBridge prose.\n\n${alignedMath}\n\nTail prose.`;

    const chunks = chunkSourceText(text, 32);

    expect(chunks).toContain(displayMath);
    expect(chunks).toContain(alignedMath);
    expect(chunks.some((chunk) => chunk.includes("\\begin{align}") !== chunk.includes("\\end{align}")))
      .toBe(false);
  });

  it("disarms an unmatched dollar before the next hard boundary", () => {
    const text = "it cost $5 today.\n\n# Chapter 2\n\nNew prose here about vectors.";
    const chunks = chunkSourceText(text, 30);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.includes("today") && chunk.includes("# Chapter 2")))
      .toBe(false);
  });

  it("never lets a chunk cross a top-level heading or book boundary", () => {
    const text = "Opening with $x$ notation.\n\n# Chapter 2\n\nNew material.\n\nBOOK III\n\nFinal material.";
    const chunks = chunkSourceText(text, 200);

    expect(chunks).toHaveLength(3);
    expect(chunks.some((chunk) => chunk.includes("Opening") && chunk.includes("# Chapter 2")))
      .toBe(false);
    expect(chunks.some((chunk) => chunk.includes("# Chapter 2") && chunk.includes("BOOK III")))
      .toBe(false);
  });

  it("maps a latex fence before considering math openers inside it", () => {
    const fence = [
      "```latex",
      "\\begin{align}",
      "a &= b.",
      "\\end{align}",
      "```",
    ].join("\n");

    expect(chunkSourceText(fence, 24)).toEqual([fence]);
  });

  it("keeps fenced code atomic despite interior sentence punctuation", () => {
    const fence = "```js\narr.push(x).\nreturn arr;\n```";
    const text = `Before code.\n\n${fence}\n\nAfter code.`;
    const chunks = chunkSourceText(text, 24);

    expect(chunks).toContain(fence);
    expect(chunks.some((chunk) => chunk.includes("arr.push(x).") && !chunk.includes("```")))
      .toBe(false);
  });

  it("suppresses abbreviation, initial, decimal, and diagnostic-code false boundaries", () => {
    const first = "See Fig. 2 and Dr. A. Smith et al. 2020.";
    const second = "New sentence uses p < 0.05 and code F32.1.";
    const text = `## Notes\n\n${first} ${second}`;
    const chunks = chunkSourceText(text, 52);

    expect(chunks.some((chunk) => chunk.includes(first))).toBe(true);
    expect(chunks).toContain(second);
    expect(chunks.some((chunk) => /(?:Fig|Dr|A|al)\.$/.test(chunk))).toBe(false);
  });

  it("keeps pipe-table bytes, including the separator row and row newlines", () => {
    const table = "| Name | Value |\n|---|---|\n| alpha | 1 |\n| beta | 2 |";
    const text = `Table follows.\n\n${table}\n\nDiscussion follows.`;
    const chunks = chunkSourceText(text, 28);

    expect(chunks).toContain(table);
    expect(chunks.join("\n")).toContain("|---|---|");
    expect(chunks.some((chunk) => chunk.includes("| alpha | 1 || beta | 2 |"))).toBe(false);
  });

  it("keeps scripture couplets and a short verse in one marker-preserving range", () => {
    const verses = [
      "1:1 In the beginning was the Word,",
      "1:2 and the Word was with God.",
      "1:3 Light came.",
    ].join("\n");
    const text = `Reading\n\n${verses}\n\nCommentary after the range.`;
    const chunks = chunkSourceText(text, 44);

    expect(chunks).toContain(verses);
    expect(chunks.find((chunk) => chunk.includes("Light came."))).toContain("1:3");
  });

  it("welds a short colon stem to its list but lets budget beat long-list cohesion", () => {
    const shortList = "Criteria:\n- grounded quote\n- stable identifier";
    expect(chunkSourceText(shortList, 80)).toEqual([shortList]);

    const longList = [
      "Criteria:",
      "- grounded quotation copied exactly from the source text.",
      "- deterministic identifier retained across repeated build runs.",
      "- prerequisite relationship checked before artifact emission.",
    ].join("\n");
    const chunks = chunkSourceText(longList, 45);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 45)).toBe(true);
    expect(chunks.every((chunk) => longList.includes(chunk))).toBe(true);
  });

  it("degrades an over-ceiling protected span into bounded verbatim sub-slices", () => {
    const text = `$$${"x+".repeat(100)}x$$`;
    const chunks = chunkSourceText(text, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(80);
    expect(chunks.every((chunk) => text.includes(chunk))).toBe(true);
  });

  it("rejects edge-only boundaries and terminates without empty chunks", () => {
    const text = "# Edge\n\nSmall text.\n\n# End";
    const chunks = chunkSourceText(text, 10);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.length > 0)).toBe(true);
    expect(chunks).not.toContain("");
  });

  it("is deterministic for identical structured input", () => {
    const text = "## Formula\n\n$x = y$. New sentence.\n\n- first\n- second";
    expect(chunkSourceText(text, 24)).toEqual(chunkSourceText(text, 24));
  });

  it("keeps chunk planning confined to unpinned discovery", () => {
    const source = readFileSync(resolve(repoRoot, "src/atomization/atomize.ts"), "utf8");

    expect(source).toMatch(/function sourcePassages[\s\S]*?function legacyChunkSourceText/);
    expect(source).toMatch(/export async function discoverInventory[\s\S]*?for \(const chunk of planChunks\(sources\)\)/);
    expect(source).not.toMatch(/function selectExcerpt[\s\S]*?chunkSourceText/);
    expect(source).not.toMatch(/function targetedQuoteExcerpt[\s\S]*?chunkSourceText/);
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
