import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CC_BY_SA_4_DEED,
  D2L_AUTHOR,
  D2L_COMMIT,
  D2L_LICENSE_STATEMENT,
  D2L_REPO,
  D2L_SOURCES,
  D2L_TAG,
  d2lBlobUrl,
  extractD2LText,
  fetchPinnedText,
  localMarkdownPath,
  normalizeRepoLicense,
  rawD2LUrl,
  renderAttributions,
  renderDataLicense,
  renderNotice,
  sha256,
  verifyLicenseEvidence,
  type AuditedSourceEntry,
} from "./corpus";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oerDir = resolve(repoRoot, "data", "oer");
const legacyWikipediaFiles = [
  "wikipedia-attention.txt",
  "wikipedia-dot-product.txt",
  "wikipedia-euclidean-vector.txt",
  "wikipedia-softmax-function.txt",
];

const expectedD2LFiles = D2L_SOURCES.flatMap((spec) => [
  spec.textPath,
  localMarkdownPath(spec.textPath),
]);
const knownFiles = new Set([
  "README.md",
  "sources.json",
  ...legacyWikipediaFiles,
  ...expectedD2LFiles,
]);
const unexpected = readdirSync(oerDir).filter((name) => !knownFiles.has(name));
if (unexpected.length > 0) {
  throw new Error(`refusing to fetch over unlisted data/oer files: ${unexpected.join(", ")}`);
}

const licenceUrl = rawD2LUrl("LICENSE");
const licenceText = await fetchPinnedText(licenceUrl);
if (!licenceText.includes(D2L_LICENSE_STATEMENT)) {
  throw new Error(`pinned d2l LICENSE lacks ${JSON.stringify(D2L_LICENSE_STATEMENT)}`);
}

const fetched = await Promise.all(
  D2L_SOURCES.map(async (spec) => {
    const markdown = await fetchPinnedText(rawD2LUrl(spec.sourceFile));
    const text = extractD2LText(markdown);
    const entry: AuditedSourceEntry = {
      id: spec.id,
      title: spec.title,
      url: d2lBlobUrl(spec.sourceFile),
      license: "CC-BY-SA-4.0",
      textPath: spec.textPath,
      sha256: sha256(text),
      sourceSha256: sha256(markdown),
      author: D2L_AUTHOR,
      revision: {
        repo: D2L_REPO,
        tag: D2L_TAG,
        commit: D2L_COMMIT,
        sourceFile: spec.sourceFile,
      },
      licenseEvidence: {
        url: licenceUrl,
        statement: D2L_LICENSE_STATEMENT,
        licenseName: D2L_LICENSE_STATEMENT,
      },
      modifications:
        "Extracted from the pinned Markdown: fenced code blocks, display and inline math, tables, emphasis delimiters, and inline role directives (:numref:, :eqref:, :cite:) were removed; links and reference anchors were resolved to plain text; whitespace was collapsed. Section headings and tab directives (:begin_tab: / :end_tab:) are retained inline.",
      licenseDeed: CC_BY_SA_4_DEED,
    };
    return { spec, markdown, text, entry };
  })
);

await verifyLicenseEvidence(fetched[0]!.entry);

for (const { spec, markdown, text } of fetched) {
  writeFileSync(resolve(oerDir, localMarkdownPath(spec.textPath)), markdown, "utf8");
  writeFileSync(resolve(oerDir, spec.textPath), text, "utf8");
}

const entries = fetched.map(({ entry }) => entry);
writeFileSync(resolve(oerDir, "sources.json"), `${JSON.stringify({ sources: entries }, null, 2)}\n`);
writeFileSync(resolve(repoRoot, "ATTRIBUTIONS.md"), renderAttributions(entries), "utf8");
writeFileSync(resolve(repoRoot, "DATA-LICENSE"), renderDataLicense(entries), "utf8");
writeFileSync(resolve(repoRoot, "NOTICE"), renderNotice(entries), "utf8");
writeFileSync(resolve(repoRoot, "LICENSE"), normalizeRepoLicense(licenceText), "utf8");

for (const legacyFile of legacyWikipediaFiles) {
  rmSync(resolve(oerDir, legacyFile), { force: true });
}

console.log(
  `Fetched ${entries.length} d2l sources pinned to ${D2L_TAG} (${D2L_COMMIT}) and applied the pinned extraction transform.`
);
