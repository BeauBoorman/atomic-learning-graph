import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  D2L_COMMIT,
  D2L_SOURCES,
  D2L_TAG,
  extractAuditedSource,
  extractD2LText,
  extractOpenStaxText,
  verifyLicenseEvidence,
  localSourcePath,
  type AuditedSourceEntry,
} from "./corpus";
import { verifyGoldenAnchors } from "./verify-anchors";
import { invalidProvenance } from "../src/graph/invariants";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oerDir = resolve(repoRoot, "data", "oer");

describe("the pinned d2l extraction transform", () => {
  it("removes executable, directive, role, and markup syntax while preserving inline math verbatim", () => {
    const markdown = `Before **plain** $x + y$ and $1$ [linked words](https://example.test).

\`\`\`{.python}
print("must disappear")
\`\`\`

.. figure:: hidden.png
   :width: 10px
   hidden caption

After *words* :cite:\`someone\` [reference anchor].`;

    expect(extractD2LText(markdown)).toBe(
      "Before plain $x + y$ and $1$ linked words. After words reference anchor.\n"
    );
  });

  it("preserves formula punctuation because LaTeX is no longer stripped", () => {
    const markdown = `Given two vectors $\\mathbf{x}, \\mathbf{y}$,
their *dot product* (also known as *inner product*, $\\langle x, y \\rangle$)
is a sum over products at the same position: $x^T y = \\sum_i x_i y_i$.
The norm is expressed as ($\\sum_i x_i^2$).`;

    const extracted = extractD2LText(markdown);
    expect(extracted).toBe(
      "Given two vectors $\\mathbf{x}, \\mathbf{y}$, their dot product (also known as inner product, $\\langle x, y \\rangle$) is a sum over products at the same position: $x^T y = \\sum_i x_i y_i$. The norm is expressed as ($\\sum_i x_i^2$).\n",
    );
  });

  it("preserves display and inline LaTeX bytes through markdown cleanup", () => {
    const display = "$$\n\\begin{aligned}\ns_i &= q^T k_i \\\\\np_i &= \\operatorname{softmax}(s_i)\n\\end{aligned}\n$$";
    const inline = "$p_i = \\frac{e^{s_i}}{\\sum_j e^{s_j}}$";
    const extracted = extractD2LText(`Before **math** ${display}\nAfter ${inline} exactly.`);

    expect(extracted).toContain(display);
    expect(extracted).toContain(inline);
    expect(Buffer.from(extracted).includes(Buffer.from(display))).toBe(true);
    expect(Buffer.from(extracted).includes(Buffer.from(inline))).toBe(true);
  });

  it("keeps a LaTeX-bearing quotedText byte-exact and valid under the provenance invariant", () => {
    const quotedText = "The attention score $s_i = q^T k_i$ ranks each candidate key for selection.";
    const sourceText = extractD2LText(`## Scores\n\n${quotedText}`);
    const graph = {
      sources: [{
        id: "math-source",
        title: "Math source",
        license: "CC0-1.0",
        author: "Test",
        text: sourceText,
      }],
      concepts: [{
        id: "attention-score",
        title: "Attention score",
        summary: "A score ranks candidate keys.",
        provenance: { sourceId: "math-source", quotedText },
        tags: [],
      }],
      edges: [],
      goalId: "attention-score",
    };

    expect(Buffer.from(sourceText).includes(Buffer.from(quotedText))).toBe(true);
    expect(invalidProvenance(graph)).toEqual([]);
  });

  it("keeps the audited tag and full immutable commit on every manifest row", () => {
    const manifest = JSON.parse(readFileSync(resolve(oerDir, "sources.json"), "utf8")) as {
      sources: AuditedSourceEntry[];
    };
    expect(manifest.sources.map(({ id }) => id)).toEqual(D2L_SOURCES.map(({ id }) => id));
    for (const source of manifest.sources) {
      expect(source.author).not.toBe("");
      expect(source.revision.tag).toBe(D2L_TAG);
      expect(source.revision.commit).toBe(D2L_COMMIT);
    }
  });

  it("keeps every golden citation anchor verbatim in its declared source", () => {
    const manifest = JSON.parse(readFileSync(resolve(oerDir, "sources.json"), "utf8")) as {
      sources: AuditedSourceEntry[];
    };
    expect(() =>
      verifyGoldenAnchors(manifest.sources, (textPath) =>
        readFileSync(resolve(oerDir, textPath), "utf8")
      )
    ).not.toThrow();
  });

  it("keeps the stored d2l extraction bytes equal to the LaTeX-preserving transform", () => {
    const manifest = JSON.parse(readFileSync(resolve(oerDir, "sources.json"), "utf8")) as {
      sources: AuditedSourceEntry[];
    };
    for (const entry of manifest.sources) {
      const upstream = readFileSync(resolve(oerDir, localSourcePath(entry)), "utf8");
      const stored = readFileSync(resolve(oerDir, entry.textPath), "utf8");
      expect(extractD2LText(upstream)).toBe(stored);
    }
  });
});

describe("per-source licence evidence", () => {
  const openStax = {
    id: "openstax-physics-newtons-first-law",
    title: "OpenStax Physics — Newton's First Law of Motion: Inertia",
    url: "https://github.com/openstax/osbooks-physics/blob/8044b7aa50bddadf631dee0a9c62e54ca238a8c8/modules/m54138/index.cnxml",
    license: "CC-BY-4.0",
    textPath: "openstax-physics-newtons-first-law.txt",
    sha256: "0".repeat(64),
    sourceSha256: "1".repeat(64),
    author: "OpenStax, Rice University",
    revision: {
      repo: "https://github.com/openstax/osbooks-physics",
      tag: "commit-8044b7a",
      commit: "8044b7aa50bddadf631dee0a9c62e54ca238a8c8",
      sourceFile: "modules/m54138/index.cnxml",
    },
    licenseEvidence: {
      url: "https://raw.githubusercontent.com/openstax/osbooks-physics/8044b7aa50bddadf631dee0a9c62e54ca238a8c8/LICENSE",
      statement: "Creative Commons Attribution 4.0 International Public License",
      licenseName: "Creative Commons Attribution 4.0 International Public License",
    },
    modifications: "CNXML markup removed and whitespace collapsed.",
    licenseDeed: "https://creativecommons.org/licenses/by/4.0/",
  } satisfies AuditedSourceEntry;

  it("verifies each source against its own recorded URL and verbatim statement", async () => {
    const requested: string[] = [];
    await expect(
      verifyLicenseEvidence(openStax, async (url) => {
        requested.push(url);
        return `# Physics\n${openStax.licenseEvidence.statement}\n`;
      }),
    ).resolves.toBeUndefined();
    expect(requested).toEqual([openStax.licenseEvidence.url]);
  });

  it("REJECTS missing or unverifiable recorded evidence", async () => {
    await expect(verifyLicenseEvidence(openStax, async () => "no licence statement here"))
      .rejects.toThrow(/licence evidence/i);
    await expect(
      verifyLicenseEvidence(
        { ...openStax, licenseEvidence: undefined } as unknown as AuditedSourceEntry,
        async () => openStax.licenseEvidence.statement,
      ),
    ).rejects.toThrow(/licence evidence/i);
  });
});

describe("the pinned OpenStax proof corpus", () => {
  const corpusDir = resolve(repoRoot, "data", "corpora", "openstax-physics");
  const manifest = JSON.parse(readFileSync(resolve(corpusDir, "sources.json"), "utf8")) as {
    sources: AuditedSourceEntry[];
  };

  it("contains exactly one revision-pinned CC-BY-4.0 source", () => {
    expect(manifest.sources).toHaveLength(1);
    expect(manifest.sources[0]).toMatchObject({
      id: "openstax-physics-newtons-first-law",
      license: "CC-BY-4.0",
      revision: { commit: "8044b7aa50bddadf631dee0a9c62e54ca238a8c8" },
    });
  });

  it("matches the recorded source and extracted-text SHA-256 values", () => {
    const entry = manifest.sources[0]!;
    const source = readFileSync(resolve(corpusDir, "openstax-physics-newtons-first-law.cnxml"));
    const text = readFileSync(resolve(corpusDir, entry.textPath));
    expect(createHash("sha256").update(source).digest("hex")).toBe(entry.sourceSha256);
    expect(createHash("sha256").update(text).digest("hex")).toBe(entry.sha256);
    expect(extractOpenStaxText(source.toString("utf8"))).toBe(text.toString("utf8"));
  });
});
