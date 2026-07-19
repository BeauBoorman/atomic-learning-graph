---
name: alg-dev
description: Bootstrap and orientation for working on the atomic-learning-graph repo. Load first when new to the repo or when a task spans multiple subsystems. Covers the load-bearing thesis, the non-negotiables, what you must never touch, and the precedence order of the project's law documents. Triggers "work on atomic-learning", "alg-dev", "what is this repo", "atomic learning graph", "how does this project work", "where do I start on alg".
---

# alg-dev — orientation

Read this first when you touch the repo. Other skills (`alg-gate`, `alg-atomize`, etc.) cover
specific workflows; this one is the law and the map.

## Read before acting

In this precedence (deeper wins):

1. `AGENTS.md` (root) — durable law: the 6 hard invariants, license gate, quote-primary
   provenance, `LearningGraph.edges[]` as the single source of truth, the acceptance bar,
   the scope fences. **Read every line.**
2. `src/atomization/AGENTS.md` — atomizer-local rules that WIN over anything general: the
   extractive-quote rule, each `Source` embeds the COMPLETE manifest `.txt`, the
   golden-chain-order requirement, the protected golden edges the repair loop may never drop,
   the validate→repair→re-validate contract, corpus reads ONLY through the manifest allowlist.
3. The docstrings in `src/graph/invariants.ts`, `src/graph/path.ts`,
   `src/atomization/manifest.ts`. Where a skill and a docstring disagree, **the docstring
   wins and you STOP and flag it.**
4. `docs/adr/001-commit-the-generated-graph.md` — why `data/graph.json` is committed, not
   gitignored, and the rules that keep that honest.
5. The other skills in `.agents/skills/` — workflow recipes that POINT at the above, never
   duplicate it.

## The thesis (load-bearing)

**The AI is allowed to BUILD the map; the map is not allowed to TRUST the AI.**

A GPT-5.x call atomizes OER into the graph at BUILD time. A deterministic walk reasons over
the committed graph at REQUEST time with NO LLM on the request path, ever. Every gate in
this repo exists to stop a non-deterministic build step from producing a graph the
deterministic core silently trusts.

If your change would put a model call on the request path, you are breaking the thesis. Stop.

## The 6 hard invariants (`src/graph/invariants.ts`)

| Invariant | What it catches |
|---|---|
| `hasCycle(graph)` | a prerequisite cycle that breaks topo-sort |
| `findOrphans(graph)` | a concept with no path to the goal |
| `danglingEdges(graph)` | an edge pointing at a non-existent concept |
| `pathExists(graph, goalId)` | the goal is unreachable from any root |
| `invalidProvenance(graph)` | a concept's quote is missing/ambiguous/empty, or its `sourceId` does not resolve |
| `duplicateConceptIds` / `duplicateSourceIds` | identifier collisions |

`isSingleConcept` is ADVISORY, not a gate. It must NEVER fail the build, NEVER gate a phase,
NEVER gate the repair loop, and NEVER appear in the hard-invariant fail set. It is the seed
for a future scorer, not a proof. See `ROADMAP.md` §3.

## NEVER touch

- **`data/graph.json`** — written ONLY by `pnpm atomize -- --out-dir data
  --overwrite-existing`. A single hand-edited character makes the project's headline claim
  false. If you need a graph to develop against, use `src/graph/fixture-graph.ts` (clearly
  labelled as a FIXTURE). The test suite asserts the committed graph is not a copy of the
  fixture.
- **`data/renderings.json`** — written ONLY by `pnpm render`. Same rule, same reason.
- **`LICENSE`** — byte-compared against the pinned upstream CC-BY-SA text by `verify:corpus`.
  Any edit fails the gate.
- **`NOTICE` / `DATA-LICENSE` / `ATTRIBUTIONS.md`** — regenerated from `scripts/corpus.ts`
  by `pnpm reextract:corpus`. Edit the renderer, not the file.
- The **6 hard invariants** and the **adversarial test suite**. Roughly half the suite is
  adversarial; each negative test names the cheating implementation it exists to kill
  (`() => []`, `() => true`, a `" and "` substring ban, `sources.find()`). Do not weaken a
  test to make an implementation pass.
- The **protected golden edges**: `{vectors→dot-product, dot-product→softmax,
  softmax→qkv, qkv→self-attention}` and the five golden nodes (`vectors`, `dot-product`,
  `softmax`, `qkv`, `self-attention`). The repair loop may never drop them.

## NEVER do

- Run `pnpm dev` or `pnpm preview` inside an agent. They never exit and will hang the
  session. Read the code or run `pnpm build` instead. (Codex has already lost a run to this.)
- Re-add a relations field to `Concept`. `LearningGraph.edges[]` is the ONLY source of truth
  for relations. Two encodings WILL diverge on a generated graph.
- Reintroduce an offset check into provenance validation. Offsets are HINTS and are NEVER
  validated; a test pins this.
- Commit `.env`, an API key, or any credential. The repo is about to be public; anything
  you commit now is something a stranger reads.
- Force-push. The repo's history rewrite (for AI trailers) is a separate, deliberate
  operation gated on Beau's call.

## The acceptance bar

`pnpm gate` is THE bar. A passing `pnpm test` is NOT — it skips `verify:corpus`, and that
gap is how a false license notice nearly shipped. The gate runs every stage even if an
earlier one fails, then reports a summary. See `alg-gate` for the stage list and how to
read failures.

## The shipped artifact (current)

10 concepts, 9 prerequisite relationships, 31 cited lesson steps (21 core, 10 deep), 186
optional analogies across 6 interests, 20 alternate renderings (`why-it-exists` +
`how-it-works` per concept). Plus the complete text of the four pinned sources, embedded so
the receipt can be verified in the browser with no request. The default goal is
`self-attention`; `getPath(graph, "self-attention")` routes `vectors → dot-product →
softmax → qkv → self-attention`, in that order.

## Where to look next

- Adding or regenerating the graph → `alg-atomize`
- Adding a source or changing license handling → `alg-corpus`
- Changing an export → `alg-exports`
- Reader UI work → `alg-ui`
- Builder/BYOK → `alg-builder`
- Security audit, tamper demo, history rewrite → `alg-audit`
- Reading a gate failure → `alg-gate`
