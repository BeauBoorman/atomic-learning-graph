import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  MANIFEST_PATH,
  OER_DIR,
  loadManifest,
  validateManifest,
} from "../src/atomization/manifest";
import {
  fetchPinnedText,
  renderAttributions,
  sha256,
  verifyLicenseEvidence,
  wikipediaRevision,
  type AuditedSourceEntry,
} from "./corpus";

const raw = loadManifest();
const validated = validateManifest(raw);
const rawSources = (raw as { sources?: unknown }).sources;
if (!Array.isArray(rawSources) || rawSources.length !== validated.length) {
  throw new Error("validated manifest and audited manifest entries differ");
}

const entries = rawSources as AuditedSourceEntry[];
const allowedFiles = new Set(["README.md", "sources.json", ...validated.map((entry) => entry.textPath)]);
const unlistedFiles = readdirSync(OER_DIR).filter((name) => !allowedFiles.has(name));
if (unlistedFiles.length > 0) {
  throw new Error(`unlisted files in data/oer/: ${unlistedFiles.join(", ")}`);
}

for (const [index, entry] of entries.entries()) {
  const validatedEntry = validated[index];
  if (!validatedEntry || validatedEntry.id !== entry.id) {
    throw new Error(`manifest entry order mismatch at sources[${index}]`);
  }
  if (typeof entry.url !== "string" || /REVID|<PINNED_SHA>|placeholder/i.test(entry.url)) {
    throw new Error(`source ${entry.id} has a missing or placeholder URL pin`);
  }

  const isPinnedWikipedia = wikipediaRevision(entry.url) !== undefined;
  const isPinnedGithub =
    /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\/.+/i.test(entry.url);
  if (!isPinnedWikipedia && !isPinnedGithub) {
    throw new Error(`source ${entry.id} URL is not revision-pinned: ${entry.url}`);
  }
  if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
    throw new Error(`source ${entry.id} has no valid recorded sha256`);
  }
  if (
    !entry.licenseEvidence ||
    typeof entry.licenseEvidence.url !== "string" ||
    typeof entry.licenseEvidence.statement !== "string" ||
    typeof entry.licenseEvidence.licenseName !== "string" ||
    entry.licenseEvidence.statement.trim().length === 0
  ) {
    throw new Error(`source ${entry.id} has incomplete licence evidence`);
  }

  const textPath = resolve(OER_DIR, entry.textPath);
  if (!statSync(textPath).isFile()) {
    throw new Error(`source ${entry.id} textPath is not a file: ${entry.textPath}`);
  }
  const stored = readFileSync(textPath);
  if (stored.toString("utf8").trim().length === 0) {
    throw new Error(`source ${entry.id} text is empty`);
  }
  if (sha256(stored) !== entry.sha256) {
    throw new Error(`source ${entry.id} stored text does not match its recorded sha256`);
  }

  const fetched = await fetchPinnedText(entry.url);
  if (sha256(fetched) !== entry.sha256 || !stored.equals(Buffer.from(fetched, "utf8"))) {
    throw new Error(`source ${entry.id} differs from its pinned upstream bytes`);
  }
  await verifyLicenseEvidence(entry);
}

const repoRoot = resolve(OER_DIR, "..", "..");
const expectedAttributions = renderAttributions(entries);
const actualAttributions = readFileSync(resolve(repoRoot, "ATTRIBUTIONS.md"), "utf8");
if (actualAttributions !== expectedAttributions) {
  throw new Error("ATTRIBUTIONS.md is not the exact manifest-derived attribution report");
}

console.log(`Verified ${entries.length} pinned corpus sources against ${MANIFEST_PATH}.`);
