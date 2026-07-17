import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRenderings, loadRenderingsForVerification } from "./load";

describe("loadRenderings", () => {
  it("returns an empty optional set when renderings.json is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-learning-renderings-load-"));
    try {
      expect(loadRenderings(join(directory, "renderings.json"))).toEqual({ renderings: [] });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails verification when renderings.json is absent", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-learning-renderings-load-"));
    const path = join(directory, "renderings.json");
    try {
      expect(() => loadRenderingsForVerification(path)).toThrow(
        `no renderings artifact at ${path}`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails verification when renderings.json is present but empty", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-learning-renderings-load-"));
    const path = join(directory, "renderings.json");
    try {
      writeFileSync(path, JSON.stringify({ renderings: [] }));
      expect(() => loadRenderingsForVerification(path)).toThrow(
        `empty renderings artifact at ${path}`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("throws when a present renderings.json is malformed", () => {
    const directory = mkdtempSync(join(tmpdir(), "atomic-learning-renderings-load-"));
    const path = join(directory, "renderings.json");
    try {
      writeFileSync(path, JSON.stringify({ renderings: "not-an-array" }));
      expect(() => loadRenderings(path)).toThrow(`invalid renderings artifact at ${path}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
