import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest, validateManifest } from "../src/atomization/manifest";
import {
  D2L_COMMIT,
  D2L_TAG,
  extractAuditedSource,
  fetchPinnedText,
  localSourcePath,
  normalizeRepoLicense,
  pinnedSourceUrl,
  rawD2LUrl,
  renderAttributions,
  renderDataLicense,
  renderNotice,
  sha256,
  verifyLicenseEvidence,
  type AuditedSourceEntry,
} from "./corpus";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultManifestPath = resolve(repoRoot, "data", "oer", "sources.json");
const legacyWikipediaFiles = [
  "wikipedia-attention.txt",
  "wikipedia-dot-product.txt",
  "wikipedia-euclidean-vector.txt",
  "wikipedia-softmax-function.txt",
];

function manifestFromArgs(args: readonly string[]): string {
  if (args.length === 0) return defaultManifestPath;
  if (args.length !== 2 || args[0] !== "--manifest" || !args[1]) {
    throw new Error("usage: pnpm fetch:corpus -- --manifest <path-to-sources.json>");
  }
  return resolve(repoRoot, args[1]);
}

function auditedEntries(raw: unknown, manifestPath: string): AuditedSourceEntry[] {
  const corpusDir = dirname(manifestPath);
  const validated = validateManifest(raw, corpusDir);
  const rawSources = (raw as { sources?: unknown }).sources;
  if (!Array.isArray(rawSources) || rawSources.length !== validated.length) {
    throw new Error("validated manifest and audited manifest entries differ");
  }

  return rawSources.map((value, index) => {
    const entry = value as AuditedSourceEntry;
    if (entry.id !== validated[index]?.id) {
      throw new Error(`manifest entry order mismatch at sources[${index}]`);
    }
    if (!/^[0-9a-f]{64}$/u.test(entry.sha256) || !/^[0-9a-f]{64}$/u.test(entry.sourceSha256)) {
      throw new Error(`source ${entry.id} has an invalid extracted or upstream SHA-256`);
    }
    const expectedUrl = `${entry.revision?.repo}/blob/${entry.revision?.commit}/${entry.revision?.sourceFile}`;
    if (entry.url !== expectedUrl) {
      throw new Error(`source ${entry.id} URL is not pinned to its exact commit and source file`);
    }
    return entry;
  });
}

export async function fetchCorpus(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const manifestPath = manifestFromArgs(args);
  const corpusDir = dirname(manifestPath);
  const raw = loadManifest(manifestPath);
  const entries = auditedEntries(raw, manifestPath);
  const defaultCorpus = manifestPath === defaultManifestPath;

  const knownFiles = new Set([
    "README.md",
    ...(defaultCorpus ? legacyWikipediaFiles : []),
    "sources.json",
    ...entries.flatMap((entry) => [entry.textPath, localSourcePath(entry)]),
  ]);
  const unexpected = readdirSync(corpusDir).filter((name) => !knownFiles.has(name));
  if (unexpected.length > 0) {
    throw new Error(`refusing to fetch over unlisted corpus files: ${unexpected.join(", ")}`);
  }

  const fetched = await Promise.all(
    entries.map(async (entry) => {
      await verifyLicenseEvidence(entry);
      const sourceText = await fetchPinnedText(pinnedSourceUrl(entry));
      const text = extractAuditedSource(entry, sourceText);
      if (sha256(sourceText) !== entry.sourceSha256 || sha256(text) !== entry.sha256) {
        throw new Error(
          `source ${entry.id} bytes do not match the revision-pinned SHA-256 values in its manifest`,
        );
      }
      return { entry, sourceText, text };
    }),
  );

  for (const { entry, sourceText, text } of fetched) {
    writeFileSync(resolve(corpusDir, localSourcePath(entry)), sourceText, "utf8");
    writeFileSync(resolve(corpusDir, entry.textPath), text, "utf8");
  }

  if (defaultCorpus) {
    const licenseText = await fetchPinnedText(rawD2LUrl("LICENSE"));
    writeFileSync(resolve(repoRoot, "ATTRIBUTIONS.md"), renderAttributions(entries), "utf8");
    writeFileSync(resolve(repoRoot, "DATA-LICENSE"), renderDataLicense(entries), "utf8");
    writeFileSync(resolve(repoRoot, "NOTICE"), renderNotice(entries), "utf8");
    writeFileSync(resolve(repoRoot, "LICENSE"), normalizeRepoLicense(licenseText), "utf8");
    for (const legacyFile of legacyWikipediaFiles) {
      rmSync(resolve(corpusDir, legacyFile), { force: true });
    }
  }

  console.log(
    defaultCorpus
      ? `Fetched ${entries.length} d2l sources pinned to ${D2L_TAG} (${D2L_COMMIT}) and applied the pinned extraction transform.`
      : `Fetched ${entries.length} source(s) from ${manifestPath}; every revision, license statement, and SHA-256 matched.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fetchCorpus().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
