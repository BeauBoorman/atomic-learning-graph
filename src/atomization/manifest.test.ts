// THE LICENCE GATE, as a test. RED until Codex implements `validateManifest`, and RED on the real
// corpus until `data/oer/sources.json` exists.
//
// The project's claim is "built from openly (5R) licensed OER" and it embeds the full source text
// in a PUBLIC repo. That claim is worth exactly as much as the check behind it. These tests are the
// check: a source without a licence must be REJECTED, not warned about, and the atomizer must be
// unable to reach GPT-5.6 with it.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALLOWED_LICENSES,
  MANIFEST_PATH,
  OER_DIR,
  loadManifest,
  validateManifest,
  type SourceManifestEntry,
} from "./manifest";

const valid: SourceManifestEntry = {
  id: "wikipedia-attention",
  title: "Attention (machine learning)",
  url: "https://en.wikipedia.org/wiki/Attention_(machine_learning)",
  license: "CC-BY-SA-4.0",
  author: "Wikipedia contributors",
  textPath: "wikipedia-attention.txt",
};

/** A manifest around one entry, with the given field overridden/removed. */
const manifestWith = (overrides: Record<string, unknown>) => ({
  sources: [{ ...valid, ...overrides }],
});

/** A manifest with a field deleted outright (not just emptied). */
const manifestWithout = (field: keyof SourceManifestEntry) => {
  const entry: Record<string, unknown> = { ...valid };
  delete entry[field];
  return { sources: [entry] };
};

/**
 * Assert the manifest is REJECTED — it throws, and NOT merely because the function is an
 * unimplemented stub.
 *
 * A bare `expect(...).toThrow()` here is a FALSE GREEN: the stub throws `not implemented`, so every
 * rejection test below would pass against a function that does nothing at all — the licence gate
 * would report itself working while being empty. It would ALSO pass against an implementation that
 * throws unconditionally, which rejects valid corpora too. So: it must throw, it must not be the
 * stub, and the `accepts...` tests above pin that valid input is NOT rejected.
 */
const expectRejected = (raw: unknown) => {
  let thrown: unknown;
  try {
    validateManifest(raw);
  } catch (e) {
    thrown = e;
  }
  expect(thrown, "expected the manifest to be REJECTED, but validateManifest returned").toBeInstanceOf(
    Error
  );
  expect(
    (thrown as Error).message,
    "rejected only because the function is a stub — that is not a licence gate"
  ).not.toMatch(/not implemented/i);
};

describe("validateManifest — the licence gate", () => {
  it("accepts a complete, openly-licensed source", () => {
    expect(validateManifest({ sources: [valid] })).toEqual([valid]);
  });

  it("accepts a source with no url (some open corpora ship offline)", () => {
    expect(validateManifest(manifestWithout("url"))).toHaveLength(1);
  });

  // THE HEADLINE REJECTION. This is the one the pitch depends on.
  it("REJECTS a source with no licence", () => {
    expectRejected(manifestWithout("license"));
  });

  it("REJECTS a source with an empty or whitespace-only licence", () => {
    expectRejected(manifestWith({ license: "" }));
    expectRejected(manifestWith({ license: "   " }));
  });

  // -ND forbids Revise and Remix, so it fails the 5R definition of OER outright.
  it("REJECTS a NoDerivatives licence (it is not OER — no Revise, no Remix)", () => {
    expectRejected(manifestWith({ license: "CC-BY-ND-4.0" }));
    expectRejected(manifestWith({ license: "CC-BY-NC-ND-4.0" }));
  });

  it("REJECTS an all-rights-reserved source", () => {
    expectRejected(manifestWith({ license: "All rights reserved" }));
    expectRejected(manifestWith({ license: "proprietary" }));
  });

  // FAIL CLOSED. KILLS a fuzzy check like `license.includes("CC")` — every string below contains
  // "CC" or reads as open to a human, and none is an exact SPDX identifier this project has vetted.
  // An unrecognised licence is a licence nobody checked; it must not widen the gate.
  it("REJECTS an unrecognised licence string, even a plausibly-open one (fail closed)", () => {
    expectRejected(manifestWith({ license: "CC-BY, probably" }));
    expectRejected(manifestWith({ license: "free to use" }));
    expectRejected(manifestWith({ license: "open" }));
    expectRejected(manifestWith({ license: "CC-BY-5.0" }));
  });

  it("REJECTS a source missing id, title, or textPath", () => {
    expectRejected(manifestWithout("id"));
    expectRejected(manifestWithout("title"));
    expectRejected(manifestWithout("textPath"));
    expectRejected(manifestWith({ id: "  " }));
  });

  it("REJECTS a source with missing or blank attribution", () => {
    expectRejected(manifestWithout("author"));
    expectRejected(manifestWith({ author: "" }));
    expectRejected(manifestWith({ author: "   " }));
  });

  // Downstream, `invalidProvenance` rejects a concept citing an ambiguous source ID. Reject it here
  // too — the atomizer should never be able to MINT the ambiguity in the first place.
  it("REJECTS duplicate source IDs (provenance citing them would be unresolvable)", () => {
    const dupes = { sources: [valid, { ...valid, title: "A different doc" }] };
    expectRejected(dupes);
  });

  // An empty corpus is a failure, never an empty graph — an empty graph vacuously satisfies several
  // invariants and produces a FALSE GREEN (same reasoning as load.ts).
  it("REJECTS an empty or absent source list", () => {
    expectRejected({ sources: [] });
    expectRejected({});
    expectRejected(null);
    expectRejected("sources.json");
  });

  // The corpus is a closed set. A textPath that escapes data/oer/ is either a bug or an attempt to
  // ingest something that was never licence-checked.
  it("REJECTS a textPath that escapes data/oer/", () => {
    expectRejected(manifestWith({ textPath: "../../.env" }));
    expectRejected(manifestWith({ textPath: "/etc/passwd" }));
  });

  it("only allows exact SPDX identifiers from the vetted list", () => {
    for (const license of ALLOWED_LICENSES) {
      expect(() => validateManifest(manifestWith({ license }))).not.toThrow();
    }
  });
});

// --- The REAL corpus. RED until data/oer/sources.json exists — which is correct: there is no
// licence audit until there is a manifest, and there is no graph until there is a licence audit. ---
describe("the real data/oer/sources.json", () => {
  it("exists and every source passes the licence gate", () => {
    const entries = validateManifest(loadManifest());
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) expect(ALLOWED_LICENSES).toContain(e.license);
  });

  // A `textPath` pointing at nothing is a citation-shaped string. Provenance is verified against
  // this text, so if it is missing or empty the whole credibility claim has no ground truth.
  it("points every source at a text file that exists and is not empty", () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true);
    const entries = validateManifest(loadManifest());
    for (const e of entries) {
      const path = resolve(OER_DIR, e.textPath);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, "utf8").trim().length).toBeGreaterThan(0);
    }
  });
});
