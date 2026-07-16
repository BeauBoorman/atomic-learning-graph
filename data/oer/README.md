# OER corpus — the atomizer's input

Every source the atomizer reads must be listed in **`sources.json`** with an **open licence and
attribution**.
This is a gate, not a convention: `src/atomization/manifest.ts` (`validateManifest`) rejects the
run if any source is missing a licence or carries a non-open one, and `pnpm atomize` reads its
corpus **only** through it.

**Dropping a file in this directory does nothing.** The manifest is an allowlist, not a directory
scan. A `.txt` that is not listed is not a source and will not be atomized — filenames are not
source IDs, and an un-listed file is a file whose licence nobody checked.

## `sources.json`

```json
{
  "sources": [
    {
      "id": "d2l-self-attention",
      "title": "Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding",
      "url": "https://github.com/d2l-ai/d2l-en/blob/b2e2ae30898a9d0126a9699ae7e441de3e272715/chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md",
      "license": "CC-BY-SA-4.0",
      "author": "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola",
      "textPath": "d2l-self-attention.txt",
      "sha256": "<64-hex extracted-text hash>",
      "revision": {
        "repo": "https://github.com/d2l-ai/d2l-en",
        "tag": "v1.0.3",
        "commit": "b2e2ae30898a9d0126a9699ae7e441de3e272715",
        "sourceFile": "chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md"
      }
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable, unique. Provenance cites it. Not derived from the filename. |
| `title` | yes | Human-readable; shown in the UI beside the quoted passage. |
| `url` | no | Where it came from. Optional only because some open corpora ship offline. |
| `license` | **yes** | **Exact SPDX identifier**, from the allowlist below. Fail-closed. |
| `author` | **yes** | Attribution copied into the shipped graph and displayed with the lesson. |
| `textPath` | yes | Plain-text file, relative to `data/oer/`. Must exist, must be non-empty. |
| `sha256` | audited corpus | Hash of the exact extracted text bytes. Verified by `pnpm verify:corpus`. |
| `revision` | audited corpus | Immutable repository, tag, full commit, and upstream source path. |

## Allowed licences (exact match — `ALLOWED_LICENSES` in `src/atomization/manifest.ts`)

`CC0-1.0` · `CC-BY-3.0` · `CC-BY-4.0` · `CC-BY-SA-3.0` · `CC-BY-SA-4.0` · `public-domain`

Anything else is **rejected**, including an unrecognised but plausibly-open string (`"CC-BY, probably"`,
`"free to use"`). A typo must never widen the gate; adding a licence is a deliberate edit to the
allowlist.

- **`-ND` (NoDerivatives) is excluded** — it forbids Revise and Remix, so it fails the 5R definition
  of OER outright. Atomizing a document *is* making a derivative.
- **`-NC` (NonCommercial) is excluded** — the conservative call, not a settled one. Reopen it
  deliberately if a needed source is NC.

## Why the full source text ships in the graph

`data/graph.json` embeds each source's complete text so provenance can be **verified** (does the
quote actually occur here?) and **rendered** (the UI shows the cited passage with no network call).
That means this repo republishes the source text — which is exactly why the licence field is
required and checked. Attribution for `CC-BY*` sources comes from `author` + `title` + `url` +
`license`.
