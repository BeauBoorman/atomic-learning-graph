import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadSources,
  main,
  parseAtomizeArgs,
  selectToySource,
  writeAtomizationRunLog,
} from "./atomize";

const repoRoot = resolve(import.meta.dirname, "..", "..");

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
