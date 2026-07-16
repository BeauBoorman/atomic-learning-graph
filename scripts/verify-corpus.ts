import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  MANIFEST_PATH,
  OER_DIR,
  loadManifest,
  validateManifest,
} from "../src/atomization/manifest";
import {
  D2L_COMMIT,
  D2L_LICENSE_STATEMENT,
  D2L_REPO,
  D2L_SOURCES,
  D2L_TAG,
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

const raw = loadManifest();
const validated = validateManifest(raw);
const rawSources = (raw as { sources?: unknown }).sources;
if (!Array.isArray(rawSources) || rawSources.length !== validated.length) {
  throw new Error("validated manifest and audited manifest entries differ");
}

const entries = rawSources as AuditedSourceEntry[];
const expectedIds = D2L_SOURCES.map(({ id }) => id);
if (entries.map(({ id }) => id).join("\0") !== expectedIds.join("\0")) {
  throw new Error(`manifest source IDs/order must be exactly: ${expectedIds.join(", ")}`);
}

const allowedFiles = new Set([
  "README.md",
  "sources.json",
  ...entries.flatMap((entry) => [entry.textPath, localMarkdownPath(entry.textPath)]),
]);
const unlistedFiles = readdirSync(OER_DIR).filter((name) => !allowedFiles.has(name));
if (unlistedFiles.length > 0) {
  throw new Error(`unlisted files in data/oer/: ${unlistedFiles.join(", ")}`);
}

for (const [index, entry] of entries.entries()) {
  const validatedEntry = validated[index];
  const spec = D2L_SOURCES[index];
  if (!validatedEntry || validatedEntry.id !== entry.id || spec?.id !== entry.id) {
    throw new Error(`manifest entry order mismatch at sources[${index}]`);
  }
  if (
    entry.revision?.repo !== D2L_REPO ||
    entry.revision.tag !== D2L_TAG ||
    entry.revision.commit !== D2L_COMMIT ||
    entry.revision.sourceFile !== spec.sourceFile
  ) {
    throw new Error(`source ${entry.id} does not carry the exact audited d2l revision`);
  }
  if (entry.url !== `${D2L_REPO}/blob/${D2L_COMMIT}/${spec.sourceFile}`) {
    throw new Error(`source ${entry.id} URL is not pinned to its exact commit and source file`);
  }
  if (!/^[0-9a-f]{64}$/u.test(entry.sha256) || !/^[0-9a-f]{64}$/u.test(entry.sourceSha256)) {
    throw new Error(`source ${entry.id} has an invalid extracted or upstream SHA-256`);
  }
  if (
    entry.licenseEvidence?.url !== rawD2LUrl("LICENSE") ||
    entry.licenseEvidence.statement !== D2L_LICENSE_STATEMENT ||
    entry.licenseEvidence.licenseName !== D2L_LICENSE_STATEMENT
  ) {
    throw new Error(`source ${entry.id} has incomplete or unpinned licence evidence`);
  }

  const markdownPath = resolve(OER_DIR, localMarkdownPath(entry.textPath));
  const textPath = resolve(OER_DIR, entry.textPath);
  if (!statSync(markdownPath).isFile() || !statSync(textPath).isFile()) {
    throw new Error(`source ${entry.id} is missing its Markdown or extracted text file`);
  }
  const storedMarkdown = readFileSync(markdownPath);
  const storedText = readFileSync(textPath);
  if (sha256(storedMarkdown) !== entry.sourceSha256 || sha256(storedText) !== entry.sha256) {
    throw new Error(`source ${entry.id} stored bytes do not match their recorded SHA-256 values`);
  }

  const upstreamMarkdown = await fetchPinnedText(rawD2LUrl(entry.revision.sourceFile));
  if (!storedMarkdown.equals(Buffer.from(upstreamMarkdown, "utf8"))) {
    throw new Error(`source ${entry.id} Markdown differs from its pinned upstream bytes`);
  }
  const expectedText = extractD2LText(upstreamMarkdown);
  if (!storedText.equals(Buffer.from(expectedText, "utf8"))) {
    throw new Error(`source ${entry.id} text differs from the pinned extraction transform`);
  }
}

await verifyLicenseEvidence(entries[0]!);
const repoRoot = resolve(OER_DIR, "..", "..");
const licenceText = await fetchPinnedText(rawD2LUrl("LICENSE"));
const generatedFiles = [
  ["ATTRIBUTIONS.md", renderAttributions(entries)],
  ["DATA-LICENSE", renderDataLicense(entries)],
  ["NOTICE", renderNotice(entries)],
  ["LICENSE", normalizeRepoLicense(licenceText)],
] as const;
for (const [path, expected] of generatedFiles) {
  if (readFileSync(resolve(repoRoot, path), "utf8") !== expected) {
    throw new Error(`${path} is not the exact manifest-derived corpus artefact`);
  }
}

console.log(
  `Verified ${entries.length} d2l sources at ${D2L_TAG} (${D2L_COMMIT}) against ${MANIFEST_PATH}.`
);
