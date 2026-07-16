import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  D2L_COMMIT,
  D2L_SOURCES,
  D2L_TAG,
  extractD2LText,
  type AuditedSourceEntry,
} from "./corpus";
import { verifyGoldenAnchors } from "./verify-anchors";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oerDir = resolve(repoRoot, "data", "oer");

describe("the pinned d2l extraction transform", () => {
  it("removes executable, directive, math, role, and markup syntax deterministically", () => {
    const markdown = `Before **plain** $x + y$ and $1$ [linked words](https://example.test).

\`\`\`{.python}
print("must disappear")
\`\`\`

.. figure:: hidden.png
   :width: 10px
   hidden caption

After *words* :cite:\`someone\` [reference anchor].`;

    expect(extractD2LText(markdown)).toBe(
      "Before plain and 1 linked words. After words reference anchor.\n"
    );
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
});
