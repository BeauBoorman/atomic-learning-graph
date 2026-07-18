import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest, validateManifest } from "../src/atomization/manifest";
import {
  LATEX_PRESERVING_MODIFICATIONS,
  extractAuditedSource,
  localSourcePath,
  renderAttributions,
  renderDataLicense,
  renderNotice,
  sha256,
  type AuditedSourceEntry,
} from "./corpus";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = resolve(repoRoot, "data", "oer", "sources.json");

export interface LocalReextraction {
  entry: AuditedSourceEntry;
  text: string;
}

/**
 * Rebuild extracted corpus bytes solely from the already-committed source files. This path never
 * calls fetch: the immutable source hash in the manifest must match before any output is written.
 */
export function prepareLocalReextraction(
  raw: unknown,
  corpusDir: string,
  readSource: (path: string) => Buffer = (path) => readFileSync(path),
): LocalReextraction[] {
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
    const sourcePath = resolve(corpusDir, localSourcePath(entry));
    const sourceBytes = readSource(sourcePath);
    if (sha256(sourceBytes) !== entry.sourceSha256) {
      throw new Error(`source ${entry.id} committed source bytes do not match sourceSha256`);
    }
    const text = extractAuditedSource(entry, sourceBytes.toString("utf8"));
    return {
      entry: {
        ...entry,
        sha256: sha256(text),
        modifications: LATEX_PRESERVING_MODIFICATIONS,
      },
      text,
    };
  });
}

export function reextractCommittedCorpus(): void {
  const corpusDir = dirname(manifestPath);
  const prepared = prepareLocalReextraction(loadManifest(manifestPath), corpusDir);
  const entries = prepared.map(({ entry }) => entry);

  // All reads, validation, extraction, and hashes complete before the first write.
  for (const { entry, text } of prepared) {
    writeFileSync(resolve(corpusDir, entry.textPath), text, "utf8");
  }
  writeFileSync(manifestPath, `${JSON.stringify({ sources: entries }, null, 2)}\n`, "utf8");
  writeFileSync(resolve(repoRoot, "ATTRIBUTIONS.md"), renderAttributions(entries), "utf8");
  writeFileSync(resolve(repoRoot, "DATA-LICENSE"), renderDataLicense(entries), "utf8");
  writeFileSync(resolve(repoRoot, "NOTICE"), renderNotice(entries), "utf8");
  console.log(
    `Re-extracted ${entries.length} sources from committed local source files; no network fetch performed.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    reextractCommittedCorpus();
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  }
}
