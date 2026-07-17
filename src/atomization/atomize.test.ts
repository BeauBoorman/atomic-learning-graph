import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadSources,
  main,
  parseAtomizeArgs,
  selectToySource,
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
