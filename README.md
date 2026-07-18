# Atomic Learning: a plain-English edition of a real textbook

<!-- PUBLISH STEP (owner call). The repository is public. Once GitHub Pages is enabled,
     uncomment the two lines below and fill in <user>. `base` is
     already set to "/atomic-learning-graph/" in vite.config.ts for a project page; if you
     publish to a user page or a custom domain instead, set `base` back to "/" or the link
     will serve a blank white screen. The GIF must be cut from the finished app: one 6-second
     loop: pick a goal → lesson page → tap the footnote mark → the source sheet opens → the
     highlight draws under the real sentence.
**[Open the demo →](https://<user>.github.io/atomic-learning-graph/)**

![Pick a goal, read one idea, check the receipt](docs/demo.gif)
-->

We don't ask what kind of learner you are. We give every learner several grounded routes to the
same idea. We also show you the receipts.

Pick something you want to understand. We work backwards through a prerequisite graph to the ideas
it rests on, and teach them one page at a time, in order. Every page is a plain-English translation
of a passage from *Dive into Deep Learning* (Zhang, Lipton, Li & Smola), pinned to commit
[`b2e2ae3`](https://github.com/d2l-ai/d2l-en/tree/b2e2ae30898a9d0126a9699ae7e441de3e272715). Every
page shows you the exact sentence it came from, highlighted.

The translation was made once, before publication, and checked against the source. **Nothing is
generated while you read.** No key, no network, no model call. That is enforced against the shipped
browser bytes, not left as a promise.

### The routes

- **Atomic steps:** one idea per page, never two.
- **Prerequisite scaffolding:** a deterministic order, derived from the graph, not guessed.
- **Optional analogies:** the same idea through cooking, sport, music, games, cars, gardening.
- **Optional depth:** every step, or just the spine.

Multiple representations, analogical transfer, cognitive-load management, interest-based motivation.
These are not learning styles. That idea has been tested and it does not hold up (Pashler et al. 2008;
Coffield et al. 2004; Kirschner 2017).

## What you can check

Every claim on this page is a property of the committed artifact, not a description of intent.

| Claim | Where it is enforced |
|---|---|
| Nothing is generated at read time | After `pnpm build`, `pnpm verify:bundle` scans emitted JavaScript, HTML and CSS for network clients, the model vendor and remote assets. `src/ui/gate9.test.ts` keeps a faster source-level tripwire, but the hard claim rests on the bytes shipped to the learner. The app runs offline. |
| Every lesson step is anchored to a real sentence | All **31** steps carry a `quotedText` that must be a substantial content-bearing span (at least 8 lexical words, including 4 non-stopwords) and occur **verbatim in exactly one** resolved source. `src/graph/invariants.ts` refuses to write a graph where it doesn't. |
| The path is derived, not guessed | `src/graph/path.ts` is a pure prerequisite-ancestor walk with a stable tie-break, over **9** committed prerequisite edges. Same goal in, same route out, every time. |
| The graph was not hand-EDITED | `data/graph.json` is written only by `pnpm atomize`. Its sha256 is pinned in `data/graph.run.json`, and `src/atomization/graph-run.test.ts` recomputes it. A single hand-edited character turns the suite red. |
| The sources are what we say they are | Four pinned CC-BY-SA-4.0 chapters, licence-checked before ingestion, with revision pins and licence evidence recorded in `data/oer/sources.json`. |

The demo spine is deliberately specified, not independently discovered. The atomizer prompt gives the
model five stable concept IDs, five source assignments across four chapters, and four direct
prerequisite edges in order; code fixes `self-attention` as the goal. `pnpm verify:anchors` separately
checks that five named corpus passages remain verbatim in the extracted sources. Those passages are
not inserted into the graph as constants: the model proposes each concept quote, and code only snaps
a whitespace-equivalent proposal to the stored source bytes. If a required quote fails grounding, a
concept-specific regex narrows the stored-source excerpt for a separate model repair. The build
refuses to write an artifact missing a pinned node, direct edge, ordered route, or goal path.

In the committed graph, those pins account for 5 of 10 concepts and 4 of 9 prerequisite edges. The
model proposed the other 5 concepts, the other 5 edges, all 10 concept-level quote selections, all
31 lesson steps, and all 186 analogies. The graph and citations then face deterministic gates;
analogies remain optional illustrations.

The shipped artifact: **10 concepts, 9 prerequisite relationships, 31 cited lesson steps** (17 core,
14 deep) and **186 optional analogies** across 6 interests, plus the complete text of the four
pinned sources, embedded so the receipt can be verified in the browser with no request.

## How it is made

The lessons are a **translation, not a summary**, and translation is the product here.

We render each idea in the plainest English that keeps the meaning whole, following the principle
translators call dynamic equivalence: *meaning-for-meaning, not word-for-word*. We anchor every
sentence to the passage beside it. The highlighted words are the authors' own.

The lineage is visible rather than hidden. The translation was made in a single build-time run by a
language model, bounded at every step by deterministic checks it cannot talk its way past:

1. The pipeline licence-checks every corpus source before ingestion. It uses an exact-match SPDX
   allowlist and fails closed.
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

## How this was built with Codex

Each negative test names the cheating implementation it kills. A `() => []` stub, a hard-coded
golden path, a substring shortcut, and a first-match source lookup each have a test built to catch
them. That adversarial suite fenced Codex with executable constraints it could not talk past.

One model, `gpt-5.6-sol`, did two jobs here.

As Codex, the coding agent, it wrote this repository in a phase-gated RED→GREEN run. The committed
[`docs/kickoff-prompt.md`](docs/kickoff-prompt.md) is the collaboration record: it fixed the
acceptance gates, resumed Codex phase by phase, and forbade weakening tests or hand-writing the
graph.

The same model is the build-time atomizer inside the product. It produces candidate concepts,
relationships, lessons, and analogies for deterministic validation. That role never runs when a
learner reads; the browser receives only committed artifacts.

So `gpt-5.6-sol` both built the machine and is the intelligence the machine calls at build time, and
in both roles the same discipline holds: it proposes, and gates that it cannot talk past decide what
ships.

## Run it

Requires Node.js and pnpm. No API key is needed to run, test, or build the committed graph and UI.

`pnpm gate` is the acceptance bar. A passing `pnpm test` is not: it skips corpus verification, the
gap through which a false licence notice nearly shipped. The gate brings the repository's checks
together and states what it **does not** prove on every run. Green is bounded evidence, not a claim
that the model's interpretation is correct or that every product quality is solved.

```bash
pnpm install
pnpm gate
pnpm typecheck
pnpm test
pnpm verify:corpus
pnpm dev
```

`pnpm verify:corpus` is hermetic by default: it validates the committed manifest, source hashes,
extraction transform, and derived notices without a network request. To additionally prove the pins
still match the real upstream source and licence bytes, run `VERIFY_UPSTREAM=1 pnpm verify:corpus`.

A production build:

```bash
pnpm build
pnpm preview
```

Use `pnpm preview` rather than opening `dist/index.html` directly because a `file://` origin cannot
load the built module.

Atomization is a separate build-time operation and requires `OPENAI_API_KEY`. Output is always
explicit; a run cannot silently replace the committed demo graph:

```bash
pnpm atomize -- --out-dir .artifacts/d2l
```

An existing `graph.json`, `graph.run.json`, or `atomicity-report.json` makes the run fail closed.
Replacing the committed demo artifacts therefore requires an unmistakable, deliberate command:

```bash
pnpm atomize -- --out-dir data --overwrite-existing
pnpm test
```

The second checked corpus proves that the pipeline is not tied to machine-learning prose. Its toy
run uses one pinned CC-BY-4.0 OpenStax Physics section and writes no artifact:

```bash
pnpm atomize:toy -- --manifest data/corpora/openstax-physics/sources.json
```

`data/graph.json` remains a committed build artifact and must never be hand-edited. See [ADR
001](docs/adr/001-commit-the-generated-graph.md). Display-layer editorial choices (such as
sentence-case lesson titles) live in `src/ui/titles.ts`, deliberately outside the pinned artifact.

## Architecture

- `data/oer/`: pinned upstream Markdown, deterministically extracted source text, and the fail-closed source manifest.
- `data/corpora/openstax-physics/`: a separate one-source CC-BY-4.0 corpus proving manifest-relative ingestion.
- `src/atomization/manifest.ts`: exact-match SPDX allowlist and manifest validation.
- `src/atomization/atomize.ts`: three-phase inventory, relationship, and cited-translation build.
- `src/atomization/translate.ts`: strict lesson schema, anchored excerpts, quote repair, and floors.
- `src/atomization/analogy.ts`: optional build-time analogies for the fixed interest set.
- `src/graph/invariants.ts`: the six hard deterministic proof invariants.
- `src/graph/atomicity-report.ts`: an advisory-only concept atomicity reporter; never a gate.
- `src/graph/path.ts`: deterministic prerequisite-ancestor walk with a stable tie-break.
- `src/graph/load.ts`: fail-closed loader for the committed graph.
- `src/ui/`: static React interface over the embedded graph, with local-only interactions.
- `scripts/verify-bundle.ts`: post-build scan of emitted JavaScript, HTML and CSS; the
  shipped-bytes enforcement boundary for the no-network browser claim.

Relations live only in `LearningGraph.edges[]`. Provenance is quote-primary: normalized `quotedText`
must clear the shared strength floor and occur in exactly one resolved source, while offsets remain
non-load-bearing hints.

## Why a graph, not a chatbot?

Open educational resources are abundant but rarely tell a learner what must be understood first. The
graph is a persistent, inspectable substrate. Once built, path routing is reproducible and auditable
from the graph's content alone. Because the routing is a pure function over committed data, the same
goal always yields the same route, on any machine, with the network unplugged.

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
- **This artifact is a prerequisite tree, not evidence of a relationship mesh.** The graph type
  supports `prereq`, `method`, and `related`, and the relationship phase requires `related` on every
  model-returned concept; this one-book, ten-concept run nevertheless landed 9 `prereq` edges, zero
  `related` edges, and no concept with more than one incoming prerequisite. Its five-node demo spine
  is explicitly pinned as a direct chain, but the prompt does not forbid other links. A broader
  corpus and an unpinned run are the next experiment, not a promised outcome or new graph
  architecture.
- **Two alternate formats ship; infinite generation does not.** The bundle embeds 20 validated
  alternate renderings (`why-it-exists` and `how-it-works` for each of 10 concepts) with 68 cited
  steps. Their citations and run-log hash are gated. On-demand renderings and a learned atomicity
  scorer remain in [ROADMAP.md](ROADMAP.md).

## Licences

**Code: MIT. Demo content and D2L source text: CC-BY-SA-4.0. OpenStax proof corpus:
CC-BY-4.0.**

The source code (`src/`, `scripts/` and the build configuration) is licensed
[MIT](LICENSE-CODE). Creative Commons recommends against CC licences for software, and ShareAlike
is viral on adaptations, so the boundary is drawn between the engine and the text it renders.

The lessons are adaptations of CC-BY-SA-4.0 material from *Dive into Deep Learning* by Aston Zhang,
Zachary C. Lipton, Mu Li and Alexander J. Smola, translated into plain English at build time and
modified from the originals. As adaptations of ShareAlike material, **the lessons are themselves
licensed CC-BY-SA-4.0**.

Redistributed D2L text under `data/oer/`, and the same text embedded in `data/graph.json`, remains
under CC-BY-SA-4.0. The separate OpenStax source under `data/corpora/openstax-physics/` remains
CC-BY-4.0; its adjacent README and manifest record attribution, modifications, licence evidence,
revision, and hashes. The original project lessons and prose are licensed
[CC-BY-SA-4.0](LICENSE).

For the D2L demo corpus, see [NOTICE](NOTICE), [DATA-LICENSE](DATA-LICENSE) and
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) for per-source attribution, revision pins, licence evidence, and
modification notices.
