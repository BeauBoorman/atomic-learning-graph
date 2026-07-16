# Atomic Learning — a plain-English edition of a real textbook

<!-- PUBLISH STEP (owner call — not yet done). Once the repo is pushed to a public host and
     GitHub Pages is enabled, uncomment the two lines below and fill in <user>. `base` is
     already set to "/atomic-learning-graph/" in vite.config.ts for a project page; if you
     publish to a user page or a custom domain instead, set `base` back to "/" or the link
     will serve a blank white screen. The GIF must be cut from the finished app: one 6-second
     loop — pick a goal → lesson page → tap the footnote mark → the source sheet opens → the
     highlight draws under the real sentence.
**[Open the demo →](https://<user>.github.io/atomic-learning-graph/)**

![Pick a goal, read one idea, check the receipt](docs/demo.gif)
-->

We don't ask what kind of learner you are. We give every learner several grounded routes to the
same idea — and show you the receipts.

Pick something you want to understand. We work backwards through a prerequisite graph to the ideas
it rests on, and teach them one page at a time, in order. Every page is a plain-English translation
of a passage from *Dive into Deep Learning* (Zhang, Lipton, Li & Smola), pinned to commit
[`b2e2ae3`](https://github.com/d2l-ai/d2l-en/tree/b2e2ae30898a9d0126a9699ae7e441de3e272715). Every
page shows you the exact sentence it came from, highlighted.

The translation was made once, before publication, and checked against the source. **Nothing is
generated while you read.** No key, no network, no model call — enforced by a test, not a promise.

### The routes

- **Atomic steps** — one idea per page, never two.
- **Prerequisite scaffolding** — a deterministic order, derived from the graph, not guessed.
- **Optional analogies** — the same idea through cooking, sport, music, games, cars, gardening.
- **Optional depth** — every step, or just the spine.

Multiple representations, analogical transfer, cognitive-load management, interest-based motivation.
Not learning styles — that idea has been tested and it does not hold up (Pashler et al. 2008;
Coffield et al. 2004; Kirschner 2017).

## What you can check

Every claim on this page is a property of the committed artifact, not a description of intent.

| Claim | Where it is enforced |
|---|---|
| Nothing is generated at read time | `src/ui/gate9.test.ts` greps the entire browser runtime for network clients and model vendors. No `fetch(`, no socket, no SDK. The app runs offline. |
| Every lesson step is anchored to a real sentence | All **31** steps carry a `quotedText` that must occur **verbatim in exactly one** resolved source. `src/graph/invariants.ts` refuses to write a graph where it doesn't. |
| The path is derived, not guessed | `src/graph/path.ts` is a pure prerequisite-ancestor walk with a stable tie-break, over **9** committed prerequisite edges. Same goal in, same route out, every time. |
| The graph was not hand-tuned | `data/graph.json` is written only by `pnpm atomize`. Its sha256 is pinned in `data/graph.run.json`, and `src/atomization/graph-run.test.ts` recomputes it — a single hand-edited character turns the suite red. |
| The sources are what we say they are | Four pinned CC-BY-SA-4.0 chapters, licence-checked before ingestion, with revision pins and licence evidence recorded in `data/oer/sources.json`. |

The shipped artifact: **10 concepts, 9 prerequisite relationships, 31 cited lesson steps** (17 core,
14 deep) and **186 optional analogies** across 6 interests — plus the complete text of the four
pinned sources, embedded so the receipt can be verified in the browser with no request.

## How it is made

The lessons are a **translation, not a summary**, and translation is the product here.

We render each idea in the plainest English that keeps the meaning whole — *meaning-for-meaning, not
word-for-word* (the principle translators call dynamic equivalence) — and anchor every sentence to
the passage beside it. The highlighted words are the authors' own.

The lineage is visible rather than hidden. The translation was made in a single build-time run by a
language model, bounded at every step by deterministic checks it cannot talk its way past:

1. The pipeline licence-checks every corpus source before ingestion — an exact-match SPDX allowlist,
   fail-closed.
2. The model extracts grounded concepts, proposes relationships between frozen concept IDs,
   translates each converged concept into cited lesson steps, and pre-builds the optional analogies
   as clearly labelled illustrations.
3. Bounded validate → repair → re-validate loops check graph structure, goal reachability,
   quote-primary provenance, lesson citations, and the readability floor.
4. On convergence, `pnpm atomize` writes the sorted graph and a run log recording the response ID of
   every call. **It never writes a failing graph.**
5. The browser receives only that committed artifact and calls the pure `getPath()` function
   locally.

Model output is allowed to *propose* the map. It is not trusted until the deterministic checks pass.

The brief that drove the build is committed verbatim at [`docs/kickoff-prompt.md`](docs/kickoff-prompt.md)
— the phase-gated instructions the model was held to, including the rule it was never permitted to break:
*never fake green*. It is a record of what was **asked for**, not a claim about what happened. The
acceptance gate above is the evidence for that.

## Run it

Requires Node.js and pnpm. No API key is needed to run, test, or build the committed graph and UI.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm verify:corpus
pnpm dev
```

A production build:

```bash
pnpm build
pnpm preview
```

Use `pnpm preview` rather than opening `dist/index.html` directly — a `file://` origin cannot load
the built module.

Regenerating the graph is a separate build-time operation and requires `OPENAI_API_KEY`:

```bash
pnpm atomize
```

`data/graph.json` is a committed build artifact and must never be hand-edited — see
[ADR 001](docs/adr/001-commit-the-generated-graph.md). Display-layer editorial choices (such as
sentence-case lesson titles) live in `src/ui/titles.ts`, deliberately outside the pinned artifact.

## Architecture

- `data/oer/` — pinned upstream Markdown, deterministically extracted source text, and the fail-closed source manifest.
- `src/atomization/manifest.ts` — exact-match SPDX allowlist and manifest validation.
- `src/atomization/atomize.ts` — three-phase inventory, relationship, and cited-translation build.
- `src/atomization/translate.ts` — strict lesson schema, anchored excerpts, quote repair, and floors.
- `src/atomization/analogy.ts` — optional build-time analogies for the fixed interest set.
- `src/graph/invariants.ts` — the five hard deterministic proof invariants.
- `src/graph/atomicity-report.ts` — an advisory-only concept atomicity reporter; never a gate.
- `src/graph/path.ts` — deterministic prerequisite-ancestor walk with a stable tie-break.
- `src/graph/load.ts` — fail-closed loader for the committed graph.
- `src/ui/` — static React interface over the embedded graph, with local-only interactions.

Relations live only in `LearningGraph.edges[]`. Provenance is quote-primary: normalized `quotedText`
must occur in exactly one resolved source, while offsets remain non-load-bearing hints.

## Why a graph, not a chatbot?

Open educational resources are abundant but rarely tell a learner what must be understood first. The
graph is a persistent, inspectable substrate. Once built, path routing is reproducible and auditable
from the graph's content alone — and because the routing is a pure function over committed data, the
same goal always yields the same route, on any machine, with the network unplugged.

## What we are not claiming

Honest limits, stated up front:

- **Readability is advisory, not solved.** `READABILITY_HARD_FLOOR` is US grade **16** and only
  *throws* above that; grade **10** is an advisory that warns without blocking. The committed
  [`data/atomicity-report.json`](data/atomicity-report.json) records the real result: **7 of 10
  concepts carry a low-confidence advisory**, and the default goal (`self-attention`) is estimated at
  grade **13.52**. The floor is a build gate against runaway prose, not a promise of grade-8 English.
  Tightening it is a re-translation, not a config change.
- **The graph is small and the domain is narrow.** 10 concepts across four chapters. The pitch is the
  substrate and the provenance, not coverage.
- **Only prerequisite edges exist today.** All 9 committed edges are `prereq`; there are zero
  `related` edges, so no "related ideas" browsing is offered.
- **Extension points are not features.** Validated multi-format renderings, on-demand renderings, and
  a learned atomicity scorer are marked in [ROADMAP.md](ROADMAP.md) and are not represented as
  working today.

## Licences

**Code: MIT. Content: CC-BY-SA-4.0. Source text: CC-BY-SA-4.0 from [d2l.ai](https://d2l.ai).**

The source code — `src/`, `scripts/` and the build configuration — is licensed
[MIT](LICENSE-CODE). Creative Commons recommends against CC licences for software, and ShareAlike
is viral on adaptations, so the boundary is drawn between the engine and the text it renders.

The lessons are adaptations of CC-BY-SA-4.0 material from *Dive into Deep Learning* by Aston Zhang,
Zachary C. Lipton, Mu Li and Alexander J. Smola, translated into plain English at build time and
modified from the originals. As adaptations of ShareAlike material, **the lessons are themselves
licensed CC-BY-SA-4.0**.

Redistributed OER text under `data/oer/`, and the same text embedded in `data/graph.json`, remains
under its recorded open licence. The content of this repository — the lessons, the corpus and the
prose — is licensed [CC-BY-SA-4.0](LICENSE).

See [NOTICE](NOTICE), [DATA-LICENSE](DATA-LICENSE) and [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for
per-source attribution, revision pins, licence evidence, and modification notices.
