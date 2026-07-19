---
name: alg-exports
description: The six learning-content exports (llms.txt, org-roam, Tinderbox OPML, Obsidian vault, Anki TSV, practice exam) plus the course receipt and the optional showcase. Each emitter reads the committed graph and renders in memory; each verify:* stage byte-compares. Load when changing an emitter, regenerating an artifact, or adding a new export. Triggers "pnpm emit", "pnpm verify:orgroam", "pnpm verify:anki", "pnpm verify:tinderbox", "pnpm verify:obsidian", "pnpm verify:exam", "pnpm verify:llms", "pnpm verify:receipt", "pnpm verify:showcase", "atomic-learning-graph.org", "atomic-learning-graph.opml", "atomic-learning-graph.tbx", "atomic-learning-graph-anki.tsv", "atomic-learning-graph-exam.md", "course.receipt.json", "exports/obsidian", "exports/showcase", "ROAM_REFS", "Tinderbox OPML".
---

# alg-exports — six projections of one graph

`data/graph.json` is the only authority for course content and relationships. Each export
is an opinionated projection: navigable entry points, native metadata, useful ordering,
readable labels, attribution where a learner encounters the content, and styling when the
format supports it. `data/graph.json` remains the only authority; no export is a new one.

## The eight artifacts and their gates

| Artifact | Emitter | Regenerate | Verify | Notes |
|---|---|---|---|---|
| `llms.txt`, `llms-full.txt` | `scripts/emit-llms.ts` | `pnpm emit:llms` | `pnpm verify:llms` | Plain-text course index for AI assistants. `llms-full.txt` carries the complete lessons and receipts. |
| `atomic-learning-graph.org` | `scripts/emit-orgroam.ts` | `pnpm emit:orgroam` | `pnpm verify:orgroam` | org-roam file. Each concept node has a unique `:ROAM_REFS:` value built from the source URL plus a `#concept-id` fragment so same-source concepts do not collide under org-roam's unique-ref index. |
| `atomic-learning-graph.opml` | `scripts/emit-tinderbox.ts` | `pnpm emit:tinderbox` | `pnpm verify:tinderbox` | The gated, rebuildable Tinderbox interchange. One import applies hierarchy + prototypes + colors + positions + prerequisite links. |
| `atomic-learning-graph.tbx` | (no emitter) | — | — | Hand-finished convenience for direct open in Tinderbox 9.0+. NOT gated, NOT rebuildable. README presents OPML as the supported artifact and `.tbx` as a presentation convenience. |
| `exports/obsidian/` | `scripts/emit-obsidian.ts` | `pnpm emit:obsidian` | `pnpm verify:obsidian` | Linked vault with **Start Here** note in prerequisite order; full cited lesson in every concept note. |
| `atomic-learning-graph-anki.tsv` | `scripts/emit-anki.ts` | `pnpm emit:anki` | `pnpm verify:anki` | Basic-note TSV. Sets `#deck:Atomic Learning Graph` and `#tags:atomic-learning-graph::d2l`; each first field is prefixed `ALG :: ` so the deck is dupe-safe across courses. |
| `atomic-learning-graph-exam.md` | `scripts/emit-exam.ts` | `pnpm emit:exam` | `pnpm verify:exam` | Grounded practice exam. Every answer in its key carries the verbatim source passage. Uses `invalidRubricCitations` (sibling of `invalidRenderingCitations`). |
| `data/course.receipt.json` | `scripts/emit-receipt.ts` | `pnpm emit:receipt` | `pnpm verify:receipt` | Machine-checkable receipt: model, token usage, cost, source corpus, graph sha256. |
| `exports/showcase/` | `scripts/emit-export-showcase.ts` | `pnpm emit:showcase` | `pnpm verify:showcase` | Optional product tutorial, 17 files across all formats. Deliberately separate from normal course exports so repeat exports stay clean. Has its OWN Anki and org-roam renderers (`renderAnki`, `renderOrgRoam`) that do NOT call the main emitters. |

## Emitter-vs-artifact changes (the only safe workflow)

Every emitter renders the artifact entirely in memory before any write, and refuses to
verify if the committed file is not byte-identical. Therefore:

1. Edit the emitter (a `.ts` file under `scripts/`).
2. Regenerate with the matching concrete command in the table above.

3. Confirm the artifact diff is what you intended.
4. Run the matching concrete verification command in the table (or just `pnpm gate`, which
   runs all of them).

Do NOT edit the committed artifact directly. The matching verification command will fail until
the emitter is changed to match — which is the whole point of the byte-compare.

## Conventions every emitter follows

- Read the committed graph via `loadGraph()` (`src/graph/load.ts`). Never reach the network
  or call a model.
- Run the same structural pre-checks (`duplicateConceptIds`, `duplicateSourceIds`,
  `danglingEdges`, `findOrphans`, `hasCycle`, `invalidProvenance`) and refuse to emit on a
  structurally invalid graph.
- Topological order from `topologicalConceptOrder()` (`src/graph/path.ts`), not graph array
  order. Byte-determinism is a property: a shuffled graph yields the same artifact.
- Attribution per source via `licenseWithDeed(source.license)` from
  `scripts/export-attribution.ts`. Modification notice uses the canonical wording.
- Verbatim concept prose. Summaries, lesson steps, and quotes are emitted byte-for-byte
  from the gated graph. The emitter never authors per-concept prose.

## The showcase is independent

`scripts/emit-export-showcase.ts` is a SEPARATE renderer. It has its own
`renderAnki`/`renderOrgRoam`/`renderTinderbox`/etc. that do not call the main emitters. A
change to `emit-anki.ts` does NOT affect showcase bytes. Showcase bytes are gated separately
by `pnpm verify:showcase`.

This is by design: the showcase is a product tutorial, not a course export. It stays
identical across course regenerations so repeat course exports stay clean.

## Adding a new export

1. Add `emit-<name>.ts` and `emit-<name>.test.ts` under `scripts/`.
2. Add the gate stage to `scripts/gate.sh` between the existing `verify:<x>` stages.
3. Add `emit:<name>` and `verify:<name>` scripts to `package.json`.
4. The new artifact's path must be deterministic (repo root or a fixed subdirectory).
5. Test fixture: assert byte-determinism (same input → same bytes), prerequisite order
   (shuffled input → same bytes), and at least one mutation test that fails on a one-character
   edit of the committed artifact.
6. Document the new export in `README.md` (the "Six learning-content exports" paragraph and
   the open-in-app table).

## When an export verification stage fails

The error names the artifact and the command that resolves it:

```
atomic-learning-graph.org is not the exact graph-derived artifact; run pnpm emit:orgroam
```

Common causes:

- You changed the emitter and did not regenerate. Fix: run its concrete `pnpm emit:*` command
  from the table above.
- You changed `data/graph.json` (you should not have — see `alg-dev`). Fix: revert.
- You changed a renderer helper (`scripts/export-attribution.ts`,
  `scripts/corpus.ts`) that the emitter calls. Fix: run the matching concrete `pnpm emit:*`
  command for each affected emitter.
- You hand-edited the artifact by accident. Do not automatically restore a shared file; inspect
  the diff and obtain the owner's approval before any restoration, then re-verify.
