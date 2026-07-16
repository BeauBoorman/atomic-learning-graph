// THE ATOMIZER'S INPUT CONTRACT — the licence gate.
//
// `Source.license` is REQUIRED by the graph model (types.ts), but nothing was enforcing it at
// INGESTION, and the full source text is embedded in `data/graph.json` in a PUBLIC repo. Without a
// gate here, the project's central legal/credibility claim — "built from openly (5R) licensed open
// educational resources" — is an assertion nobody checked. This module is where that claim becomes
// a computation.
//
// WHY A MANIFEST FILE AND NOT PER-SOURCE FRONT-MATTER:
//   1. Zero new dependencies. The repo has typescript/tsx/vitest and nothing else; YAML front-matter
//      needs a parser, and `resolveJsonModule` is already on. An 8-day build should not add a dep to
//      express five fields.
//   2. A licence audit should be ONE reviewable file, not a fact scattered across N documents. A
//      judge (or Beau) can read `data/oer/sources.json` in ten seconds and see every licence.
//   3. It is an ALLOWLIST, not a directory scan. A `.txt` sitting in `data/oer/` that is not listed
//      in the manifest is NOT a source and MUST NOT be ingested. Filenames are not source IDs —
//      a dropped-in file with no licence must be inert, not silently atomized.
//   4. It is the checksum target for the atomizer's run log (corpus checksum + graph checksum).
//
// WHY THESE TYPES LIVE HERE AND NOT IN `types.ts`: `types.ts` is the GRAPH model — what the product
// ships. This is the BUILD-STEP input contract — what the atomizer is allowed to read. A manifest
// entry is not a `Source`: it points at text on disk (`textPath`), while a `Source` embeds the text.
// The atomizer's job is precisely to turn the former into the latter.
//
// `validateManifest` is a STUB — Codex implements it. The tests in `manifest.test.ts` are the spec.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const OER_DIR = resolve(repoRoot, "data", "oer");
export const MANIFEST_PATH = resolve(OER_DIR, "sources.json");

/**
 * One entry in `data/oer/sources.json`. Every field except `url` is required.
 */
export interface SourceManifestEntry {
  /** Stable source ID. Provenance cites this; it must NOT be derived from the filename. Unique. */
  id: string;
  title: string;
  /** Where the source came from. Optional only because some open corpora ship offline. */
  url?: string;
  /** SPDX licence identifier. MUST be in ALLOWED_LICENSES — see the fail-closed rule below. */
  license: string;
  /** Required attribution copied into the shipped graph. */
  author: string;
  /** Path to the source text, RELATIVE to `data/oer/`. The file must exist and be non-empty. */
  textPath: string;
}

export interface SourceManifest {
  sources: SourceManifestEntry[];
}

/**
 * The open licences this project will ingest. EXACT-MATCH SPDX identifiers, deliberately — a regex
 * or a fuzzy `includes("CC")` is a gate an atomizer can walk straight through ("CC-BY-NC-ND" and
 * "CC BY, sort of" both contain "CC").
 *
 * FAIL CLOSED: a licence string that is not in this list is REJECTED, including an unrecognised but
 * plausibly-open one. Adding a licence is a deliberate human act — a typo must never widen the gate.
 *
 * WHY THESE AND NOT OTHERS. OER means the 5R permissions (Retain, Reuse, Revise, Remix,
 * Redistribute). `-ND` (NoDerivatives) forbids Revise and Remix, so it is NOT OER and is excluded.
 * `-NC` (NonCommercial) is excluded too — it is the conservative call, not a settled one: NC content
 * technically permits the 5Rs, but it constrains what this can ever become, and the pitch says "no
 * paywall", not "no commerce". If Beau wants NC in, it is one line — but it should be a decision,
 * not a default.
 */
export const ALLOWED_LICENSES: readonly string[] = [
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "public-domain",
] as const;

/**
 * Validate the raw parsed contents of `data/oer/sources.json`. THROWS on the first violation —
 * this is a fail-closed gate, not a linter that returns warnings.
 *
 * THE CONTRACT THE ATOMIZER MUST SATISFY: `src/atomization/atomize.ts` reads its corpus ONLY
 * through this function. It must never `readdir(data/oer)` and ingest what it finds. A source that
 * is missing a licence, carries a non-open licence, or is simply not listed here MUST NOT reach
 * GPT-5.6 and MUST NOT appear in `data/graph.json`. "The model already read it" is not a licence.
 *
 * REJECT (throw) when:
 *   - the parsed value is not an object with a non-empty `sources` array. An EMPTY corpus is a
 *     failure, never an empty graph: an empty graph vacuously satisfies several invariants and
 *     produces a FALSE GREEN (same reasoning as `load.ts`);
 *   - any entry is missing `id`, `title`, `license`, `author` or `textPath`, or is empty/blank;
 *   - any `license` is not an EXACT member of ALLOWED_LICENSES (this is the whole point);
 *   - two entries share an `id` — provenance citing an ambiguous source ID is unresolvable
 *     (see `invalidProvenance` in ../graph/invariants.ts, which rejects the same thing downstream);
 *   - any `textPath` escapes `data/oer/` (`..`, absolute paths). The corpus is a closed set.
 *
 * Returns the validated entries, in manifest order.
 */
export function validateManifest(raw: unknown): SourceManifestEntry[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("invalid source manifest: expected an object with a non-empty sources array");
  }

  const sources = (raw as Record<string, unknown>).sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("invalid source manifest: sources must be a non-empty array");
  }

  const seenIds = new Set<string>();
  const entries: SourceManifestEntry[] = [];

  for (const [index, rawEntry] of sources.entries()) {
    if (typeof rawEntry !== "object" || rawEntry === null || Array.isArray(rawEntry)) {
      throw new Error(`invalid source manifest: sources[${index}] must be an object`);
    }

    const entry = rawEntry as Record<string, unknown>;
    for (const field of ["id", "title", "license", "author", "textPath"] as const) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
        throw new Error(`invalid source manifest: sources[${index}].${field} must be a non-blank string`);
      }
    }

    const id = entry.id as string;
    const title = entry.title as string;
    const license = entry.license as string;
    const author = entry.author as string;
    const textPath = entry.textPath as string;

    if (!ALLOWED_LICENSES.includes(license)) {
      throw new Error(
        `invalid source manifest: sources[${index}].license is not allowlisted: ${JSON.stringify(license)}`
      );
    }

    if (seenIds.has(id)) {
      throw new Error(`invalid source manifest: duplicate source id ${JSON.stringify(id)}`);
    }
    seenIds.add(id);

    const hasParentSegment = textPath.split(/[\\/]+/).includes("..");
    const looksLikeWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(textPath) || /^\\\\/.test(textPath);
    const resolvedTextPath = resolve(OER_DIR, textPath);
    const pathWithinOer = relative(OER_DIR, resolvedTextPath);
    if (
      hasParentSegment ||
      isAbsolute(textPath) ||
      looksLikeWindowsAbsolute ||
      pathWithinOer === ".." ||
      pathWithinOer.startsWith("../") ||
      pathWithinOer.startsWith("..\\") ||
      isAbsolute(pathWithinOer)
    ) {
      throw new Error(
        `invalid source manifest: sources[${index}].textPath escapes data/oer/: ${JSON.stringify(textPath)}`
      );
    }

    const validated: SourceManifestEntry = { id, title, license, author, textPath };
    if (entry.url !== undefined) {
      if (typeof entry.url !== "string") {
        throw new Error(`invalid source manifest: sources[${index}].url must be a string when present`);
      }
      validated.url = entry.url;
    }
    entries.push(validated);
  }

  return entries;
}

/**
 * Read and JSON-parse `data/oer/sources.json`. Deliberately dumb — it does NOT validate; that is
 * `validateManifest`'s job, and keeping them apart is what lets the validator be unit-tested
 * against hostile input without touching the filesystem.
 *
 * Throws if the manifest is absent. A missing manifest is a missing licence audit, and the atomizer
 * must refuse to run rather than quietly atomize an unlicensed corpus.
 */
export function loadManifest(path: string = MANIFEST_PATH): unknown {
  if (!existsSync(path)) {
    throw new Error(
      `no source manifest at ${path} — every OER source must be listed with an open licence before ` +
        `\`pnpm atomize\` may read it. See data/oer/README.md for the schema.`
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
