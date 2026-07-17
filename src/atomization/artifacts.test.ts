import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import { writeGraphArtifact, writeJsonArtifact } from "./artifacts";

describe("artifact writes", () => {
  it("uses exclusive creation and cannot clobber an existing graph", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "atomic-artifact-"));
    const path = resolve(dir, "graph.json");
    const first = writeGraphArtifact(path, fixtureGraph);

    expect(() => writeGraphArtifact(path, { ...fixtureGraph, goalId: "self-attention" }))
      .toThrow(/EEXIST|exist/i);
    expect(readFileSync(path)).toEqual(first);
  });

  it("requires an explicit overwrite option for run-log replacement", () => {
    const dir = mkdtempSync(resolve(tmpdir(), "atomic-run-log-"));
    const path = resolve(dir, "graph.run.json");
    writeJsonArtifact(path, { run: 1 });

    expect(() => writeJsonArtifact(path, { run: 2 })).toThrow(/EEXIST|exist/i);
    writeJsonArtifact(path, { run: 2 }, { overwriteExisting: true });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ run: 2 });
  });
});
