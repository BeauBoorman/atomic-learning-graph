import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDEN_ANCHORS, type AuditedSourceEntry } from "./corpus";

export function verifyGoldenAnchors(
  entries: readonly AuditedSourceEntry[],
  readText: (textPath: string) => string
): void {
  for (const anchor of GOLDEN_ANCHORS) {
    const source = entries.find(({ id }) => id === anchor.sourceId);
    if (!source) {
      throw new Error(`${anchor.conceptId}: anchor source ${anchor.sourceId} is missing`);
    }
    if (/…|—/u.test(anchor.text)) {
      throw new Error(`${anchor.conceptId}: anchor contains a forbidden elision character`);
    }
    if (/[$`\n\r]/u.test(anchor.text)) {
      throw new Error(`${anchor.conceptId}: anchor is not contiguous math-free prose`);
    }
    if (anchor.conceptId === "qkv" && !/[.!?]$/u.test(anchor.text)) {
      throw new Error("qkv: anchor must be a complete sentence");
    }
    const text = readText(source.textPath);
    if (!text.includes(anchor.text)) {
      throw new Error(
        `${anchor.conceptId}: anchor does not occur verbatim in ${source.textPath}: ${JSON.stringify(anchor.text)}`
      );
    }
  }
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const oerDir = resolve(repoRoot, "data", "oer");
  const manifest = JSON.parse(readFileSync(resolve(oerDir, "sources.json"), "utf8")) as {
    sources: AuditedSourceEntry[];
  };

  verifyGoldenAnchors(manifest.sources, (textPath) =>
    readFileSync(resolve(oerDir, textPath), "utf8")
  );
  console.log(`Verified ${GOLDEN_ANCHORS.length} golden anchors verbatim in the extracted corpus.`);
}
