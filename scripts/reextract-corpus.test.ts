import { describe, expect, it } from "vitest";
import { LATEX_PRESERVING_MODIFICATIONS, sha256, type AuditedSourceEntry } from "./corpus";
import { prepareLocalReextraction } from "./reextract-corpus";

const markdown = Buffer.from("## Dot product\n\nThe score is $x^T y = \\sum_i x_i y_i$.\n", "utf8");
const entry: AuditedSourceEntry = {
  id: "local-math",
  title: "Local math",
  url: "https://example.test/blob/0123456789012345678901234567890123456789/math.md",
  license: "CC-BY-SA-4.0",
  author: "Test",
  textPath: "local-math.txt",
  sha256: "0".repeat(64),
  sourceSha256: sha256(markdown),
  revision: {
    repo: "https://example.test",
    tag: "test",
    commit: "0123456789012345678901234567890123456789",
    sourceFile: "math.md",
  },
  licenseEvidence: { url: "https://example.test/license", statement: "CC", licenseName: "CC" },
  modifications: "legacy extraction",
  licenseDeed: "https://creativecommons.org/licenses/by-sa/4.0/",
};

describe("local-only corpus re-extraction", () => {
  it("derives LaTeX-preserved text and a new hash from committed source bytes", () => {
    const prepared = prepareLocalReextraction(
      { sources: [entry] },
      "/not-read-from-disk",
      () => markdown,
    );

    expect(prepared).toHaveLength(1);
    expect(prepared[0]?.text).toContain("$x^T y = \\sum_i x_i y_i$");
    expect(prepared[0]?.entry.sha256).toBe(sha256(prepared[0]?.text ?? ""));
    expect(prepared[0]?.entry.modifications).toBe(LATEX_PRESERVING_MODIFICATIONS);
  });

  it("fails closed when the committed source bytes do not match sourceSha256", () => {
    expect(() => prepareLocalReextraction(
      { sources: [entry] },
      "/not-read-from-disk",
      () => Buffer.from("drifted", "utf8"),
    )).toThrow(/do not match sourceSha256/u);
  });
});
