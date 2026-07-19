---
name: alg-atomize
description: The atomization pipeline for atomic-learning-graph — inventory, relationship, translate, repair, and render phases that turn open text into the committed graph and renderings. Load when regenerating data/graph.json, debugging a convergence failure, adding a concept, changing the prompt contract, or running pnpm render. Triggers "pnpm atomize", "regenerate the graph", "atomize", "convergence failure", "repair loop", "golden edges", "pnpm render", "renderings", "RenderingFormat", "manifest allowlist", "validateManifest".
---

# alg-atomize — turn open text into the committed graph

`pnpm atomize` is a non-deterministic, paid, build-time operation. It writes `data/graph.json`
and `data/graph.run.json`. It is the ONLY writer of those files. See `alg-dev` for the
NEVER-touch rule.

## Read first

- `src/atomization/AGENTS.md` — atomizer-local law. WINS over anything general.
- `src/atomization/manifest.ts` docstring — `ALLOWED_LICENSES`, the exact-match SPDX allowlist.
- `src/atomization/atomize.ts` — three-phase structure.
- `docs/adr/001-commit-the-generated-graph.md` — why the graph is committed, not regenerated
  in CI or on the request path.

## The three phases

1. **Inventory.** Extract + dedupe the concept inventory from the corpus. Each concept must
   resolve to a `sourceId` listed in `data/oer/sources.json`. `isSingleConcept` warnings are
   collected here as advisory evidence — they NEVER gate the loop.
2. **Relationship.** Generate `prerequisites[]` / `related[]` between already-minted IDs
   only. For the pinned product run, code projects the model's response onto the fixed
   nine-edge spine; the model's proposed relations are discarded.
3. **Translation.** Each converged concept is translated into cited lesson steps under a
   strict lesson schema. Anchored excerpts, quote repair, readability floors.

Plus a separate **render** step (`src/atomization/render.ts`) that produces alternate
renderings (`why-it-exists`, `how-it-works`) per concept, gated by
`invalidRenderingCitations` — a sibling of `invalidProvenance` typed for per-rendering
issues (`quote-not-found`, `quote-too-weak`, `ambiguous-source`, ...).

## The two artifacts an atomize run writes

- `data/graph.json` — the sorted, validated graph.
- `data/graph.run.json` — the run receipt (model, token usage, cost, source corpus, sha256
  of the graph). `src/atomization/graph-run.test.ts` recomputes the hash.

`pnpm render` separately writes `data/renderings.json` and `data/renderings.run.json`.

## Running a real atomize (paid, non-deterministic)

```bash
# toy run — does not write data/, proves pipeline mechanics only
pnpm atomize:toy -- --manifest data/corpora/openstax-physics/sources.json

# real run — requires OPENAI_API_KEY, costs real money, writes only when --out-dir is explicit
pnpm atomize -- --out-dir .artifacts/d2l

# replacing the committed demo graph is unmistakable and deliberate
pnpm atomize -- --out-dir data --overwrite-existing
pnpm test
```

An existing `graph.json`, `graph.run.json`, or `atomicity-report.json` in the target
directory makes the run fail closed. The committed demo artifacts at `data/graph.json` and
`data/renderings.json` cannot be silently replaced.

## Opt-in atomicity judge

The syntactic atomicity advisory is the default. An explicit opt-in adds a build-time
GPT-5.6 semantic judge to `atomicity-report.json`. It costs one additional model call per
concept and CANNOT change convergence or the command's exit code.

```bash
pnpm atomize -- --out-dir .artifacts/d2l-judged --atomicity-judge
```

## The protected golden set

The repair loop is bounded (`MAX_ATTEMPTS = 3`). It MUST NOT drop:

- the five golden nodes: `vectors`, `dot-product`, `softmax`, `qkv`, `self-attention`
- the four golden edges: `vectors→dot-product`, `dot-product→softmax`, `softmax→qkv`,
  `qkv→self-attention`

If a golden node/edge is unrepairable, the run HALTs and surfaces a build-failure report
naming the offending element, invariant, and span. Do not autonomously drop a golden element,
hand-edit the graph, or weaken an invariant.

## Convergence contract

A run converges when ALL of these pass:

1. The 6 hard invariants (`hasCycle`, `findOrphans`, `danglingEdges`, `pathExists`,
   `invalidProvenance`, identifier uniqueness).
2. `getPath(graph, "self-attention")` yields `vectors → dot-product → softmax → qkv →
   self-attention` as an ordered subsequence.
3. `g.concepts.length >= 6`.
4. No `Source.title === "How LLMs work (primer)"` (a guard against a stale fixture leaking
   in).
5. Every `Source` carries its allowlisted license + full text.

`isSingleConcept` warnings NEVER drive the loop, NEVER fail it, and NEVER appear on camera
as proof of atomicity.

## Repair heuristic

Deterministic-first, LLM-second:

- dangling edge → drop it
- cycle → drop the non-protected back-edge that closes the ring
- orphan → one scoped LLM call adding a prereq edge from the frozen ID set, else drop the node
- provenance failure → regenerate under the extractive constraint, or drop
- duplicates → dedupe pre-pass

There is NO `confidence`/`difficulty` field. Selection is structural.

## The extractive-quote rule (load-bearing)

The model does NOT re-type quotes. The atomizer slices `quotedText` out of the STORED source
bytes. A quote is a substring of the very text it is checked against, which structurally
removes a class of false-fails WITHOUT loosening the invariant.

If a required quote fails grounding, a concept-specific regex narrows the stored-source
excerpt for a separate model repair. The repair never weakens the byte-exact match.

## When convergence fails

1. Read `graph-run.json` — which invariant, which concept, which span.
2. Confirm the corpus matches what you think (see `alg-corpus`).
3. Confirm the manifest license is allowlisted.
4. If a golden element is the blocker → HALT and report. Do not drop or hand-edit.

Do NOT:
- weaken an invariant
- delete an adversarial test
- hand-edit `data/graph.json`
- write source prose yourself and quote it back

## Render (alternate renderings)

```bash
pnpm render
```

Costs 2 API calls per concept. Generates once, validates, writes
`data/renderings.json`, then prints the verdict for those exact landed bytes. There is no
dry run. Ungrounded steps are dropped; renderings with <2 grounded steps are dropped whole.

`invalidRenderingCitations` (`src/graph/invariants.ts`) is the per-rendering citation gate.
It returns typed `RenderingCitationIssue[]` — "rendering of concept C, format F, step N is
ungrounded" — using the same `quoteGrounded` predicate the concept gate trusts.

## Adding a new RenderingFormat

The graph type supports multiple formats. To add one:

1. Extend the `RenderingFormat` union in `src/types.ts`.
2. Add the format to the render pipeline in `src/atomization/render.ts`.
3. The gate `invalidRenderingCitations` already validates any format; do not add a special
   case.
4. Surface it in the reader behind "Try another way in" (see `alg-ui`).
5. Re-run `pnpm render` and commit the new `data/renderings.json`.
