import { afterEach, describe, expect, it } from "vitest";
import { appendFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyCorpus } from "./verify-corpus-lib";

const repoRoot = resolve(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];

function corpusFixture(): string {
  const directory = mkdtempSync(join(tmpdir(), "atomic-corpus-verifier-"));
  temporaryDirectories.push(directory);
  cpSync(resolve(repoRoot, "data", "oer"), resolve(directory, "data", "oer"), { recursive: true });
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("committed-corpus verification", () => {
  it("rejects a mutation to a stored source before it can be accepted as pinned corpus", async () => {
    const directory = corpusFixture();
    appendFileSync(
      resolve(directory, "data", "oer", "d2l-linear-algebra.txt"),
      "tampered source bytes\n",
      "utf8",
    );

    await expect(verifyCorpus({ repoRoot: directory })).rejects.toThrow(
      /stored bytes do not match their recorded SHA-256 values/,
    );
  });
});
