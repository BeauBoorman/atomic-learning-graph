# AGENTS.md — Atomic Learning Graph

## Mission

Build the OpenAI Build Week Education MVP: OER source text → GPT-5.6 atomization → committed
validated `data/graph.json` → deterministic graph/path UI. **The product is the graph, not a
chatbot.** The AI is allowed to BUILD the map; the map is not allowed to TRUST the AI.

## Non-negotiables

- **Read first, then change:** `README.md`, `docs/adr/001-commit-the-generated-graph.md`,
  `src/types.ts`, `src/graph/invariants.ts`, `src/graph/path.ts`, `src/atomization/manifest.ts`.
  The docstrings in those files are the SPEC — the tests pin behaviour, the docstrings say why.
- **Never hand-edit, hand-forge, or copy a fixture into `data/graph.json`.** It is written ONLY by
  `pnpm atomize`. A hand-authored graph makes the project's headline claim false. If you need a
  graph to develop against, use `src/graph/fixture-graph.ts` — it is labelled a FIXTURE and must
  never be presented as generated output (ADR 001, rule 3).
- **Do not re-add relation fields to `Concept`.** `LearningGraph.edges[]` is the ONLY source of
  truth for relations (prereq / method / related). Derive a concept's prerequisites from edges.
  Two encodings of the same relation WILL diverge on a generated graph, and a green invariant suite
  would then prove nothing.
- **Provenance is quote-primary.** Validate `sourceId` + normalized `quotedText`. Offsets are HINTS
  and are NEVER validated — do not reintroduce an offset check; a test pins this.
- **Do not weaken a test to make an implementation pass.** Roughly half the suite is adversarial and
  each negative test names the cheating implementation it exists to kill (`() => []`, `() => true`,
  a `" and "` substring ban, `sources.find()`, "does this concept id exist"). If a negative test
  fails, the implementation is wrong. Deleting the test deletes the invariant.
- **The atomizer fails closed on licence.** No source reaches GPT-5.6 unless it is listed in
  `data/oer/sources.json` with an allowlisted open licence. See `src/atomization/AGENTS.md`.
- **Public README claims must match working commands.** Do not leave future-tense placeholders or
  commands that do not exist in a shipping README.
- **Keep the demo scoped:** one subject (how LLMs work), one goal (`self-attention`), one loop.
- **`plans/` is internal and gitignored.** Never move internal review material into public files,
  never `git add plans/`. Never commit `.env` or an API key.

## Commands

| Command | State |
|---|---|
| `pnpm install` | works |
| `pnpm typecheck` | works — `tsc --noEmit`, must exit 0 |
| `pnpm test` | works — vitest. **Currently RED on purpose** (stubs throw `not implemented`; no graph yet) |
| `pnpm atomize` | **declared but NOT BUILT** — `src/atomization/atomize.ts` does not exist yet |
| `pnpm dev` | **does not exist.** No `dev` script, no app, no Next.js/React in `package.json` |

Dependencies today are **only** `typescript`, `tsx`, `vitest`, `@types/node`. Anything that claims
otherwise (an older README paragraph, a plan doc) is wrong about the repo as it stands.

## Current critical path

1. **Implement the six invariant bodies** in `src/graph/invariants.ts` against the adversarial tests.
2. **Write `data/oer/sources.json`** + the source text, then implement `validateManifest` in
   `src/atomization/manifest.ts` (the licence gate).
3. **Build `src/atomization/atomize.ts`** so it writes `data/graph.json` from real licensed sources.
4. **Implement `getPath`** in `src/graph/path.ts` — the ordered deterministic walk. `pathExists` is
   a boolean; the DEMO is the ordered sequence, and a graph can pass every invariant and still route
   the learner wrongly.
5. **Build the smallest UI** that shows the graph, the highlighted path, the source quote for the
   selected node, and a mark-understood advance.

## Acceptance bar

- `pnpm typecheck` exits 0.
- `pnpm test` passes — including every adversarial/negative test — against the committed
  `data/graph.json`.
- `pnpm atomize` fails closed on a source with a missing/non-open licence, and on invalid provenance.
- `getPath(graph, "self-attention")` routes through `vectors → dot-product → softmax → qkv →
  self-attention`, in that order.
- The UI shows the source quote for the selected node with **no request-time LLM call**.
