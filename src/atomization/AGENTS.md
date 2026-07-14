# AGENTS.md — Atomization

Inherits the root `AGENTS.md`. Nothing here relaxes it.

## Purpose

This directory owns the OER→graph build step. **It is the core Build Week claim.** Treat it as
production code, not a demo helper. Everything else in the repo — types, invariants, pathfinder, UI —
is a multiplier on whatever this produces.

## Input contract (the licence gate)

- Read the corpus **only** through `validateManifest(loadManifest())` in `./manifest.ts`. Never
  `readdir("data/oer")` and ingest what you find. **Filenames are not source IDs.**
- Every source must be listed in `data/oer/sources.json` with `id`, `title`, `license`, `textPath`
  (and `url` where it exists). `license` must be an exact member of `ALLOWED_LICENSES`.
- **Fail closed.** A source with a missing, empty, non-open, or unrecognised licence must NOT reach
  GPT-5.6 and must NOT appear in `data/graph.json`. Abort the run; do not skip the source silently.
  "The model already read it" is not a licence.
- `Source.text` embedded in the graph is the ground truth every quote is checked against. It ships in
  a public repo — that is exactly why the licence is enforced here rather than assumed.

## Model contract

- GPT-5.6 emits **`AtomizedConcept` objects** (see `../types.ts`), never a complete `LearningGraph`
  and never `edges[]` directly. `AtomizedConcept` IS the prompt contract — changing it changes what
  the atomization run must produce, and the run is what the credits get spent on.
- The build step converts per-node `prerequisites[]` and `related[]` into canonical `edges[]`.
- **Every concept must carry a direct `quotedText` from its source. If a concept cannot be grounded
  in a verbatim quote, DROP THE NODE.** Twenty grounded nodes beat fifty with broken provenance.
- Quote matching normalizes whitespace on both sides (collapse runs to one space, trim). A byte-exact
  `includes()` false-fails whenever the source's whitespace differs from the model's rendering — and
  that failure looks exactly like hallucination.
- Use the stable slug IDs the demo path depends on: `vectors`, `dot-product`, `softmax`, `qkv`,
  `self-attention`. `getPath(graph, "self-attention")` must route through them, in that order.

## Output contract

- Write `data/graph.json` **only after** validating: shape, no dangling edges, no cycles, no orphans,
  goal reachable, and valid normalized-quote provenance on every node. Reuse the functions in
  `../graph/invariants.ts` — do not reimplement them here, and do not ship a graph that fails them.
- Sort sources, concepts and edges deterministically before writing, so re-running produces a
  diffable file rather than a reshuffled one.
- **Do not weaken an invariant to save a bad atomization run.** Fix the prompt, the source set, or
  the post-processing. The invariants are the product.
- **Never write the hand-built fixture (`../graph/fixture-graph.ts`) to `data/graph.json`**, and never
  hand-fix the generated file. If the graph is wrong, the ATOMIZER is wrong (ADR 001).

## Expect the model to produce a broken graph on the first run

This is the predicted failure and it has no repair path yet. Plan for it in the build step, not at
02:00 on the 18th:
- **Dangling edges** — the model names a prerequisite it never emitted a node for (a concept from
  another chunk, or an invented one). Drop the edge, or drop the node; decide deliberately.
- **Duplicates** — two chunks emit "dot product" and "the dot product" as separate nodes. Dedupe on
  a normalized title/ID before building edges.
- **Cycles** — a prereq chain loops. Detect at build time and fail loudly with the offending cycle
  printed; re-prompting beats silently deleting an edge.

## Cost control

- Run on the smallest real corpus that demonstrates the golden path. Get the pipeline green at toy
  scale (one source, ~3 concepts) BEFORE scaling the corpus.
- Test prompt changes against one source before any bulk run.
- Keep a run log: model slug, prompt version, source-manifest checksum, output graph checksum.
