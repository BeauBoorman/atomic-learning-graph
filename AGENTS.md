# AGENTS.md: Atomic Learning Graph

## Mission

Build the OpenAI Build Week Education MVP: OER source text → GPT-5.6 atomization → committed
validated `data/graph.json` → deterministic graph/path UI. **The product is the graph, not a
chatbot.** The AI is allowed to BUILD the map; the map is not allowed to TRUST the AI.

## Non-negotiables

- **Read first, then change:** `README.md`, `docs/adr/001-commit-the-generated-graph.md`,
  `src/types.ts`, `src/graph/invariants.ts`, `src/graph/path.ts`, `src/atomization/manifest.ts`.
  The docstrings in those files are the SPEC. The tests pin behaviour; the docstrings say why.
- **Never hand-edit, hand-forge, or copy a fixture into `data/graph.json`.** It is written ONLY by
  `pnpm atomize`. A hand-authored graph makes the project's headline claim false. If you need a
  graph to develop against, use `src/graph/fixture-graph.ts`. It is labelled a FIXTURE and must
  never be presented as generated output (ADR 001, rule 3).
- **Do not re-add relation fields to `Concept`.** `LearningGraph.edges[]` is the ONLY source of
  truth for relations (prereq / method / related). Derive a concept's prerequisites from edges.
  Two encodings of the same relation WILL diverge on a generated graph, and a green invariant suite
  would then prove nothing.
- **Provenance is quote-primary.** Validate `sourceId` + normalized `quotedText`. Offsets are HINTS
  and are NEVER validated. Do not reintroduce an offset check; a test pins this.
- **`isSingleConcept` is ADVISORY, not a gate (SETTLED 2026-07-15).** There are **6 hard
  deterministic proof-invariants** (`hasCycle`, `findOrphans`, `danglingEdges`, `pathExists`,
  `invalidProvenance`, identifier uniqueness via `duplicateConceptIds` / `duplicateSourceIds`)
  **plus `isSingleConcept` as a build-time advisory enumeration reporter.**
  `isSingleConcept` and `reportAtomicityWarnings` must **never fail the build, never gate a phase,
  never gate the repair loop, and never appear in the hard-invariant fail set.** Never present the
  atomicity reporter on camera as proof of atomicity, and never promote it to a gate to make a demo
  look stronger. It is the seed for a future scorer. See `ROADMAP.md`.
- **Do not weaken a test to make an implementation pass.** Roughly half the suite is adversarial and
  each negative test names the cheating implementation it exists to kill (`() => []`, `() => true`,
  a `" and "` substring ban, `sources.find()`, "does this concept id exist"). If a negative test
  fails, the implementation is wrong. Deleting the test deletes the invariant.
- **The atomizer fails closed on license.** No source reaches GPT-5.6 unless it is listed in
  `data/oer/sources.json` with an allowlisted open license. See `src/atomization/AGENTS.md`.
- **Public README claims must match working commands.** Do not leave future-tense placeholders or
  commands that do not exist in a shipping README.
- **Keep the demo scoped:** one subject (the linear-algebra and softmax substrate beneath
  self-attention — the math under one LLM mechanism, not an LLM survey), one goal
  (`self-attention`), one loop.
- **Treat this repo as PUBLIC.** It is published (public GitHub + live GitHub Pages at
  https://beauboorman.github.io/atomic-learning-graph/), and a stranger — including a hackathon
  judge — can read every commit from 2026-07-21 onward. Never commit `.env`, an API key, or any
  credential. Anything you add now is something a stranger reads.

## Commands

**Do not narrate command state here.** `package.json` is the source of truth for what exists and
`pnpm gate` is the source of truth for what passes. List commands, never their status: a status
table drifts from reality and misleads every agent that trusts it.

| Command | Notes |
|---|---|
| `pnpm gate` | **THE acceptance bar.** typecheck + test + verify:corpus + verify:anchors + build + verify:bundle. Every stage runs even if an earlier one fails. |
| `pnpm typecheck` | `tsc --noEmit`, must exit 0 |
| `pnpm test` | vitest. **Passing is NOT the bar:** it does not run `verify:corpus`, and that gap is how a false license notice nearly shipped. Use `pnpm gate`. |
| `pnpm atomize` / `atomize:toy` | Atomizes licensed sources; full runs require explicit `--out-dir`. Costs real API calls. |
| `pnpm render` | **Costs 2 API calls per concept.** Generates once, validates and writes `data/renderings.json`, then prints the verdict for those exact landed bytes; there is no dry run. |
| `pnpm verify:corpus` / `verify:anchors` | license + provenance gates. Corpus verification is local by default; `VERIFY_UPSTREAM=1 pnpm verify:corpus` also checks pinned upstream bytes. |
| `pnpm verify:bundle` | post-build scan of shipped JavaScript, HTML and CSS for network/model clients and remote assets |
| `pnpm build` / `preview` | vite |
| `pnpm dev` | ⛔ **NEVER run `dev` or `preview` in an agent.** They never exit and will hang the session until it is killed. Read the code or run `pnpm build`. |

## Core status

The core is built and green: invariants, the license gate, the atomizer, `getPath`, the UI, and the
renderings pipeline all exist and pass. Do not re-implement them. `git log` and `pnpm gate` are the
truth; if any prose disagrees with them, they win.

## Acceptance bar

- `pnpm typecheck` exits 0.
- `pnpm test` passes, including every adversarial/negative test, against the committed
  `data/graph.json`.
- `pnpm atomize` fails closed on a source with a missing/non-open license, and on invalid provenance.
- `getPath(graph, "self-attention")` routes through `vectors → dot-product → softmax → qkv →
  self-attention`, in that order.
- The UI shows the source quote for the selected node with **no request-time LLM call**.
