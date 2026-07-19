---
name: alg-gate
description: The acceptance gate for atomic-learning-graph — what pnpm gate checks, the 6 hard invariants, every verify:* stage, and how to read failures. Load when running the gate, interpreting a red stage, adding a new invariant, or claiming work is complete. Triggers "pnpm gate", "acceptance gate", "gate failure", "verify:corpus", "verify:bundle", "GATE_EXIT", "alg gate", "the gate is red", "alg invariants".
---

# alg-gate — `pnpm gate` is the acceptance bar

`pnpm gate` (`scripts/gate.sh`) runs every stage even if an earlier one fails, then reports
a summary. A green gate is bounded evidence — not a claim that every product quality is
solved. Every stage that produces no exit-0 contributes to the fail set.

## Stage order (every stage runs)

| # | Stage | What it proves |
|---|---|---|
| 1 | `pnpm typecheck` | `tsc --noEmit` exits 0. No type errors anywhere. |
| 2 | `pnpm test` | vitest run, including every adversarial/negative test, against the committed `data/graph.json`. |
| 3 | `pnpm --dir builder test` | Builder key handling, provider seams, and packaging checks in its separate Node harness. |
| 4 | `pnpm verify:corpus` | License + provenance integrity of the committed corpus. Hermetic by default. |
| 5 | `pnpm verify:anchors` | Five named corpus passages remain verbatim in the extracted sources. |
| 6 | `pnpm verify:llms` | `llms.txt` and `llms-full.txt` match graph-derived bytes. |
| 7 | `pnpm verify:orgroam` | `atomic-learning-graph.org` matches graph-derived bytes. |
| 8 | `pnpm verify:tinderbox` | `atomic-learning-graph.opml` matches graph-derived bytes. |
| 9 | `pnpm verify:anki` | `atomic-learning-graph-anki.tsv` matches graph-derived bytes. |
| 10 | `pnpm verify:obsidian` | `exports/obsidian/` matches graph-derived bytes. |
| 11 | `pnpm verify:exam` | `atomic-learning-graph-exam.md` matches graph-derived bytes. |
| 12 | `pnpm verify:receipt` | `data/course.receipt.json` matches committed artifact bytes. |
| 13 | `pnpm verify:showcase` | `exports/showcase/` matches generated presentation bytes. |
| 14 | `pnpm build` | `vite build` succeeds. |
| 15 | `pnpm verify:bundle` | Post-build scan of emitted JS/HTML/CSS for network/model clients and remote assets. |
| 16 | `pnpm verify:single` | The single-file offline reader is one self-contained `dist-single/index.html`. |

Stages 6–13 are byte-compare gates: each emitter renders in memory and refuses to verify if
the committed file is not bit-identical. **If you change an emitter, regenerate the
committed artifact before running the gate.** See `alg-exports`.

## What the gate does NOT prove (be honest about the boundary)

- It does NOT run `pnpm atomize`. Atomization needs a live model key, costs money, and is
  non-deterministic. Its fail-closed behaviour on a missing/non-open license and on invalid
  provenance is pinned by unit tests instead.
- It does NOT prove the graph was regenerated today. The committed `data/graph.json` could
  be stale relative to `data/oer/`. That's why the source manifest pins revision IDs.
- It does NOT prove the model's interpretation is correct, only that the deterministic
  checks pass.

## The 6 hard invariants (run by `pnpm test`, but conceptually separate)

| Invariant | Function | What it kills |
|---|---|---|
| No cycles | `hasCycle(graph)` | a prereq ring that breaks topo-sort |
| No orphans | `findOrphans(graph)` | a concept with no path to the goal |
| No dangling edges | `danglingEdges(graph)` | an edge pointing at a non-existent concept |
| Goal reachable | `pathExists(graph, goalId)` | the goal is unreachable from any root |
| Valid provenance | `invalidProvenance(graph)` | missing/ambiguous/empty quote, unresolved `sourceId` |
| Unique IDs | `duplicateConceptIds` / `duplicateSourceIds` | identifier collisions |

`isSingleConcept` is ADVISORY only. Never a gate, never a phase condition, never in the
hard-invariant fail set. See `ROADMAP.md` §3.

## Reading a red gate

The gate prints a summary like:

```
ACCEPTANCE GATE FAILED (N stage(s)):
  - stage-name-1
  - stage-name-2
```

Common patterns:

| Red stage | Likely cause | Fix path |
|---|---|---|
| `typecheck` | a real TS error in your change | fix the types; never `as any` / `@ts-ignore` |
| `tests` | an invariant now fails, or a negative test catches a cheat | the implementation is wrong; do not weaken the test |
| `builder tests` | builder key handling, provider seam, or package behavior regressed | run `pnpm --dir builder test` directly and fix the builder; root Vitest is not a substitute |
| `verify:corpus` | a file under `data/oer/` changed without updating `sources.json`, OR `LICENSE`/`NOTICE`/`DATA-LICENSE`/`ATTRIBUTIONS.md` no longer match what `scripts/corpus.ts` renders | re-emit via `pnpm reextract:corpus`; never hand-edit those four files |
| `verify:anchors` | a stored `.txt` no longer contains an expected passage | re-extract; if still failing, the extraction transform regressed |
| export verification | you changed the emitter but did not regenerate the committed artifact | run the matching concrete emit command in `alg-exports` |
| `verify:bundle` | the shipped bytes contain a fetch/XHR/WebSocket/EventSource/sendBeacon client, an `openai`-shaped token, or a remote asset reference | see `alg-ui`; the bytes are the boundary |
| `verify:single` | `dist-single/index.html` is not the one expected file with everything inlined | re-run `pnpm build:single`; check that no new runtime asset was introduced |

## VERIFY_UPSTREAM=1

`pnpm verify:corpus` is hermetic by default — it validates the committed manifest, source
hashes, extraction transform, and derived notices without a network request. To additionally
prove the pins still match the real upstream source and license bytes:

```bash
VERIFY_UPSTREAM=1 pnpm verify:corpus
```

This requires network and pins to resolve. Use it before public milestones; do not require
it day-to-day.

## When the gate goes red and you do not know why

1. `git status` — confirm you did not accidentally touch `data/graph.json`,
   `data/renderings.json`, `LICENSE`, `NOTICE`, `DATA-LICENSE`, or `ATTRIBUTIONS.md`.
2. `git diff` — confirm the change is what you think it is.
3. If you need a clean-baseline comparison, ask the owner or use a separate clean worktree;
   do not stash or restore shared work automatically.
4. Read the failing stage's verbose output, not just the summary line.

Do not "proceed and hope." An empty graph is a false green; a stage that pretends to pass
while skipping its check is the exact failure mode the gate exists to prevent.

## Claiming work complete

A task is complete when:

- `pnpm gate` exits 0,
- `git diff` shows only the files you intended to change,
- `data/graph.json` and `data/renderings.json` are unchanged unless the task was explicitly
  "regenerate the graph" (in which case `alg-atomize` governs),
- every emitter you touched has its committed artifact regenerated, and
- you have stated the boundary of what the green gate does NOT prove.

"Green" is bounded evidence, not a blanket claim.
