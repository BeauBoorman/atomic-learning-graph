---
name: alg-corpus
description: Corpus and source-license management for atomic-learning-graph — the manifest at data/oer/sources.json, the fail-closed SPDX allowlist, hermetic vs upstream corpus verification, and fetch vs reextract paths. Load when adding or replacing a source, debugging a license or attribution error, or running pnpm verify:corpus / pnpm fetch:corpus / pnpm reextract:corpus. Triggers "pnpm verify:corpus", "corpus manifest", "sources.json", "license allowlist", "validateManifest", "ALLOWED_LICENSES", "CC-BY-SA", "CC-BY", "add a source", "fetch:corpus", "reextract:corpus", "license evidence", "revision pin".
---

# alg-corpus — sources, licenses, attribution

The corpus is the ground truth `invalidProvenance` checks quotes against. Fabricated source
text breaks the project's headline claim. Every rule here exists to keep the corpus honest.

## Read first

- `src/atomization/AGENTS.md` — `validateManifest` contract, extractive-quote rule,
  complete-source-text rule.
- `src/atomization/manifest.ts` docstring — the allowlist, the fail-closed contract.
- `data/oer/sources.json` — the actual manifest.
- `scripts/corpus.ts` — renderers for `ATTRIBUTIONS.md`, `DATA-LICENSE`, `NOTICE`.

## The single ingestion surface

`data/oer/sources.json` is the ONLY way a source reaches the atomizer. Each entry has:

- `id` — short stable identifier (e.g. `d2l-linear-algebra`)
- `title`, `author` — human-readable
- `license` — MUST be an exact member of `ALLOWED_LICENSES`
- `licenseEvidence` — `{ url, statement, licenseName }` from the upstream CC statement
- `textPath` — relative path under `data/oer/` to the extracted `.txt`
- `url` — the pinned upstream URL (see Revision pinning below)
- `sourceSha256` — sha256 of the upstream Markdown at the pinned revision
- `sha256` — sha256 of the extracted `.txt` this entry resolves to
- `modifications` — the human-readable transform description (e.g. "fenced code blocks,
  tables, and emphasis delimiters removed; LaTeX preserved verbatim")

Nothing unlisted may sit in `data/oer/`. The manifest is closed, not open.

## ALLOWED_LICENSES (exact match, no regex)

`CC0-1.0`, `CC-BY-3.0`, `CC-BY-4.0`, `CC-BY-SA-3.0`, `CC-BY-SA-4.0`, `public-domain`.

`-ND` and `-NC` are EXCLUDED. `includes("CC")` is forbidden — a substring shortcut is the
exact failure mode the gate exists to catch.

## Revision pinning (REQUIRED)

Every `url` must carry a resolved pin. Acceptable forms:

- Wikipedia: `?oldid=<numeric>`
- GitHub raw blob: a 40-hex commit SHA URL, ONE FILE per manifest entry, never a directory
  URL. Example: `https://github.com/d2l-ai/d2l-en/blob/<sha>/chapter_preliminaries/linear-algebra.md`

A `REVID`/`<PINNED_SHA>` placeholder string fails the gate.

## Adding a source

1. Pick the source. Verify its CC statement at fetch time. If the page has no explicit CC
   statement, treat it as a HALT — do not assume "open".
2. Capture:
   - **license-evidence** — the CC-statement URL + the verbatim license string as it appears
     on the page.
   - **pinned revision** — `?oldid=` for Wikipedia, or a 40-hex commit SHA raw-blob URL for
     GitHub-hosted material.
   - **source sha256** — sha256 of the upstream Markdown at that revision.
3. Extract to `.txt` under `data/oer/`. The transform must preserve verbatim bytes that a
   quote might be checked against: inline and display LaTeX preserved, fenced code blocks
   and tables may be removed, whitespace collapsed outside preserved LaTeX. Record the
   transform description in `modifications`.
4. Append to `data/oer/sources.json`. Compute the extracted `.txt` sha256 and record it as
   `sha256`.
5. Decide if the source belongs in the pinned demo corpus or the separate proof corpus at
   `data/corpora/openstax-physics/` (which proves manifest-relative ingestion against a
   different license family — CC-BY-4.0).
6. Re-emit derived docs: `pnpm reextract:corpus`. This regenerates `ATTRIBUTIONS.md`,
   `DATA-LICENSE`, and `NOTICE` from the manifest.

Do not invent, paraphrase, or "clean up" source prose. The stored text is the ground truth.

## Refuse the traps

- `mml-book` — non-open license.
- "Understanding Deep Learning" — CC-BY-NC-ND (excluded by the allowlist).
- arXiv papers — typically arXiv-only license, not in the allowlist.
- Blog posts — usually no explicit CC statement.
- Wikipedia math articles via `explaintext` — strips formulas unpredictably. Verify each
  stored `.txt` contains a substantial PROSE sentence usable as a quote for its golden
  concept, else swap the source.

## fetch vs reextract vs verify

| Command | Network | Reads | Writes | When |
|---|---|---|---|---|
| `pnpm fetch:corpus` | YES | pinned upstream URLs + the manifest | `data/oer/*.txt`, `data/oer/sources.json`, `LICENSE`, `DATA-LICENSE`, `NOTICE`, `ATTRIBUTIONS.md` | refreshing pinned sources, adding a new source |
| `pnpm reextract:corpus` | NO | already-committed `data/oer/*.md` upstream Markdown and the manifest | `data/oer/*.txt` (re-extracted), `data/oer/sources.json`, `ATTRIBUTIONS.md`, `DATA-LICENSE`, `NOTICE` | you changed `scripts/corpus.ts` or the transform; re-derive everything locally |
| `pnpm verify:corpus` | NO (default) | everything above, plus `LICENSE` | nothing | every gate run; asserts manifest + hashes + transforms + derived notices + LICENSE byte-exact |
| `VERIFY_UPSTREAM=1 pnpm verify:corpus` | YES | everything above, plus pinned upstream URLs | nothing | pre-public milestones; proves the pins still resolve |

## LICENSE is byte-compared

`scripts/verify-corpus-lib.ts` re-fetches the pinned upstream license text and asserts that
`LICENSE` is byte-equal to it (after `normalizeRepoLicense`). NEVER hand-edit `LICENSE`. If
the upstream license text changes, the gate goes red until `pnpm fetch:corpus` re-fetches
both.

## NOTICE / DATA-LICENSE / ATTRIBUTIONS.md are rendered

`scripts/corpus.ts` contains the renderers (`renderNotice`, `renderDataLicense`,
`renderAttributions`). The gate renders all three and asserts byte-equality against the
committed files. To change wording in any of them, edit the renderer in `scripts/corpus.ts`
and re-emit via `pnpm reextract:corpus`. Do not edit the files directly.

## The separate proof corpus

`data/corpora/openstax-physics/` is a one-source CC-BY-4.0 corpus. It exists to prove the
manifest/atomize path is not tied to CC-BY-SA or to machine-learning prose. Its toy run
writes no artifact:

```bash
pnpm atomize:toy -- --manifest data/corpora/openstax-physics/sources.json
```

It has its own README and manifest recording attribution, modifications, license evidence,
revision, and hashes.
