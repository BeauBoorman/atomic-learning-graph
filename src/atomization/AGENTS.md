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

## `isSingleConcept` is ADVISORY — this WINS over any general statement (SETTLED 2026-07-15)

`isSingleConcept` and `reportAtomicityWarnings` **must never fail the build, never gate a phase,
never gate the repair loop, and never appear in the hard-invariant fail set.** Collect their
warnings, log them for the human ~20-node eyeball pass, write them to `data/atomicity-report.json` —
then continue. Never treat an enumeration warning as a repair trigger. Never present the reporter on
camera as proof of atomicity. Do not promote it to a gate. It is the seed for a future scorer
(`ROADMAP.md`).

## Model contract

- GPT-5.x emits **`AtomizedConcept` objects** (see `../types.ts`), never a complete `LearningGraph`
  and never `edges[]` directly. `AtomizedConcept` IS the prompt contract — changing it changes what
  the atomization run must produce, and the run is what the credits get spent on. `AtomizedConcept`
  carries **no `confidence` and no `difficulty` field**; do not write repair logic that assumes one
  unless you deliberately add it to this contract and document the change.
- The build step converts per-node `prerequisites[]` and `related[]` into canonical `edges[]`.
- **Every concept must carry a direct `quotedText` from its source. If a concept cannot be grounded
  in a verbatim quote, DROP THE NODE.** Twenty grounded nodes beat fifty with broken provenance.
- **`quotedText` is extracted, never re-typed.** Locate the passage in the STORED source text and
  copy the exact substring; do not let the model "render" the quote from memory (that is where
  Unicode drift — curly quotes, `·`/`×`/`→`/`−`, NBSP — is introduced and provenance false-fails).
- **Each `Source` embedded in `data/graph.json` carries the COMPLETE manifest `.txt` as `Source.text`
  — one `Source` per manifest entry, `Source.id` = the manifest `id`.** You MAY chunk a source for
  the LLM call, but reassemble the full text into the shipped `Source`. `invalidProvenance` checks
  every `quotedText` against the resolved full `Source.text`; if you embed only the chunk a node came
  from, a second node quoting a different chunk of the SAME source false-fails.
- Quote matching normalizes whitespace on both sides (collapse runs to one space, trim). A byte-exact
  `includes()` false-fails whenever the source's whitespace differs from the model's rendering — and
  that failure looks exactly like hallucination.
- Use the stable slug IDs the demo path depends on: `vectors`, `dot-product`, `softmax`, `qkv`,
  `self-attention`. **The atomizer prompt must REQUIRE these five chained by `prereq` edges in
  exactly this order** — `vectors → dot-product → softmax → qkv → self-attention`, each consecutive
  pair a grounded prereq edge — so `getPath(graph, "self-attention")` routes through them in order.
  Reachability alone is not enough: `getPath` topo-sorts with a lexicographic tie-break, so the
  ORDER is only pinned when the direct chain edges exist. A reachable-but-misordered graph passes all
  6 hard invariants yet fails `path.test.ts` at Gate 7 with no repair path — so the golden ORDER is
  part of the Gate-6 convergence condition, not a Gate-7 afterthought.

## Output contract

- Write `<explicit --out-dir>/graph.json` **only after** the full Gate-6 convergence check passes.
  Replacing the committed demo requires `--out-dir data --overwrite-existing`. Convergence is
  the **6 hard invariants PLUS the checks the generated-graph test block asserts** — reuse
  `../graph/invariants.ts`; do not reimplement, do not ship a graph that fails them. The convergence
  set is:
  1. `hasCycle === false`, `danglingEdges === []`, `findOrphans === []`, `invalidProvenance === []`,
     `duplicateConceptIds === []`, `duplicateSourceIds === []`,
     `pathExists(g, "self-attention") === true`;
  2. `getPath(g, "self-attention")` yields `vectors, dot-product, softmax, qkv, self-attention` as an
     **ordered subsequence** (the golden ORDER — see the Model contract);
  3. `g.concepts.length >= 6` (strictly more than the 5-node fixture — a maximally-pruned 5-node
     graph FAILS `invariants.test.ts`'s "is not a copy of the fixture" test);
  4. no `Source.title === "How LLMs work (primer)"` (the fixture's source title);
  5. every `Source` carries its allowlisted `license` copied verbatim from its manifest entry, and
     every `Source.text` is the complete manifest `.txt`.
- Sort sources, concepts and edges deterministically before writing, so re-running produces a
  diffable file rather than a reshuffled one.
- **Write a committed run log** (`data/graph.run.json` or similar): model slug, prompt version,
  manifest checksum, and `sha256(data/graph.json)`. This is the anti-forgery trail — a test recomputes
  the graph checksum and asserts it matches the run log, catching post-run hand-edits. (The ultimate
  proof the atomizer — not a human — built the graph is the RECORDED Codex session + the on-camera
  RED→GREEN capture; the tests raise the cost of forgery, they do not by themselves prove authorship.)
- **Do not weaken an invariant to save a bad atomization run.** Fix the prompt, the source set, or
  the post-processing. The invariants are the product.
- **Never write the hand-built fixture (`../graph/fixture-graph.ts`) to `data/graph.json`**, and never
  hand-fix the generated file. If the graph is wrong, the ATOMIZER is wrong (ADR 001).
- **The toy run (one source, ~3 concepts) is DRY-ONLY** — it proves pipeline mechanics and must NEVER
  be written to `data/graph.json` (it fails the ≥6-concept floor and lacks the golden ids). Only the
  full-corpus graph is committed.

## Repair loop — golden-path edges are PROTECTED, no repair may drop them

The bounded validate→repair→re-validate loop (`MAX_ATTEMPTS = 3`) feeds each invariant's typed output
back as the repair instruction. Deterministic-first, LLM-second:

- **Dangling edge →** drop the edge (deterministic) — **unless** it is a protected golden-chain edge.
- **Cycle →** drop the edge in the ring that closes it, preferring a **non-protected** back-edge.
  There is no `confidence`/`difficulty` field to tie-break on (see Model contract), so select by
  structural rule (the edge against learning direction that closes the loop), never an imagined field.
- **Orphan →** one scoped LLM call adding a prereq edge using ONLY the frozen ID set; still orphan
  after → drop the node.
- **Provenance failure →** regenerate that node under the extractive constraint, or drop it.
- **Duplicates →** dedupe on normalized title/ID in a pre-pass before edge building; the runtime
  identifier-uniqueness invariant fails closed if a duplicate survives or appears during a merge.

**PROTECTED set — no repair step (dangling, cycle, or subgraph-drop) may delete these edges:**
`{vectors→dot-product, dot-product→softmax, softmax→qkv, qkv→self-attention}` and the five golden
nodes. If any repair would require dropping a protected edge or node, or a golden node is
unrepairable (ungrounded provenance, unavoidable cycle through it), **HALT** and surface a
build-failure report (which node/edge, which invariant, the offending span) for a human. Do not
autonomously drop a golden node/edge, do not hand-edit `data/graph.json`, do not weaken an invariant.
On non-convergence for a NON-golden subgraph: drop it and re-validate — subject to the ≥6-concept
floor above. `isSingleConcept` warnings NEVER drive or fail this loop.

## Expect the model to produce a broken graph on the first run

This is the predicted failure. The repair loop above IS the repair path — build it in the build step,
not at 02:00 on the 18th:
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
