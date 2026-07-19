import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyBundle } from "./verify-bundle-lib";

const temporaryDirectories: string[] = [];

function bundleFixture(javascript: string): string {
  const directory = mkdtempSync(join(tmpdir(), "atomic-bundle-verifier-"));
  temporaryDirectories.push(directory);
  mkdirSync(resolve(directory, "dist", "assets"), { recursive: true });
  writeFileSync(resolve(directory, "llms.txt"), "course index\n", "utf8");
  writeFileSync(resolve(directory, "llms-full.txt"), "course contents\n", "utf8");
  writeFileSync(resolve(directory, "dist", "llms.txt"), "course index\n", "utf8");
  writeFileSync(resolve(directory, "dist", "llms-full.txt"), "course contents\n", "utf8");
  writeFileSync(resolve(directory, "dist", "index.html"), "<main></main>\n", "utf8");
  writeFileSync(resolve(directory, "dist", "assets", "app.js"), javascript, "utf8");
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("shipped-bundle verification", () => {
  it("accepts a local-only emitted bundle", () => {
    expect(() => verifyBundle(bundleFixture("console.log('local only');\n"))).not.toThrow();
  });

  it("rejects a mutation that smuggles a remote fetch through globalThis", () => {
    const property = ["fet", "ch"].join("");
    const remote = ["ht", "tps"].join("") + "://example.test/lesson";
    const bundle = `globalThis[${JSON.stringify(property)}](${JSON.stringify(remote)});\n`;

    expect(() => verifyBundle(bundleFixture(bundle))).toThrow(/global fetch property client/);
  });

  it.each([
    ["dynamic import", `import(${JSON.stringify("https://example.test/chunk.js")});`, /remote dynamic import/],
    ["worker", `new Worker(${JSON.stringify("https://example.test/worker.js")});`, /remote worker/],
  ])("rejects a remote %s mutation", (_name, javascript, expected) => {
    expect(() => verifyBundle(bundleFixture(javascript))).toThrow(expected);
  });
});
