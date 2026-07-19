# Atomic Learning — a compiler for inspectable curricula

*Every lesson step has a receipt. Every claim has a gate.*
**Give it an open textbook chapter. It produces an offline learning path where every lesson step
can be challenged against the exact source passage it cites.**

Humans specify the educational intent; a model does the expensive translation work; deterministic
evidence makes every boundary visible. We don't ask what kind of learner you are — we give every
learner several grounded routes to the same idea, and we show you the receipts.

**[Open the live demo →](https://beauboorman.github.io/atomic-learning-graph/)** — runs entirely in your browser; nothing is generated while you read.

The whole project, in five steps:

1. **Pick something to learn.** Choose a goal concept.
2. **Follow the prerequisite path.** A deterministic order, derived from the graph, teaches one idea per page.
3. **Challenge any sentence against its source.** Every lesson step is anchored to a real, highlighted passage.
4. **Inspect how the course was generated and verified.** Human-specified structure, model-generated
   prose, deterministically-verified grounding, advisory-reviewed quality, and the limits we do not
   prove — each boundary is labelled, not hidden.
5. **Build your own.** Paste your own open text and key into the builder; it compiles a course with the same guarantees, offline.

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
| The sources are what we say they are | Four pinned CC-BY-SA-4.0 source sections (spanning three chapters), license-checked before ingestion, with revision pins and license evidence recorded in `data/oer/sources.json`. |

The product graph structure is deliberately specified, not independently discovered. A full-graph
spine fixes all ten stable concept IDs, their source assignments, all nine prerequisite edges, and
`self-attention` as the goal. The inventory prompt requests exactly that set, then code projects the
grounded response onto it; the relationship prompt receives the exact edge set, then code replaces
all returned relations with those nine edges. `pnpm verify:anchors` separately checks that five named
corpus passages remain verbatim in the extracted sources. Those passages are not inserted into the
graph as constants: the model proposes each concept quote, and code only snaps a
whitespace-equivalent proposal to the stored source bytes. If a required quote fails grounding, a
concept-specific regex narrows the stored-source excerpt for a separate model repair. The build
refuses to write an artifact whose IDs, source assignments, edges, route, or goal differ from the
full spine.

The model still proposes the grounded content inside those ten slots: titles, summaries, tags, all
ten concept-level quote selections, all lesson steps, and all analogies. The graph and citations then
face deterministic gates; analogies remain optional illustrations.

The shipped artifact: **10 concepts, 9 prerequisite relationships, 31 cited lesson steps** (21 core,
10 deep) and **186 optional analogies** across 6 interests, plus the complete text of the four
pinned sources, embedded so the receipt can be verified in the browser with no request.

## How it is made

The lessons are a **translation, not a summary**, and translation is the product here.

We render each idea in the plainest English that keeps the meaning whole, following the principle
translators call dynamic equivalence: *meaning-for-meaning, not word-for-word*. We anchor every
sentence to the passage beside it. The highlighted words are the authors' own.

The lineage is visible rather than hidden. The translation was made in a single build-time run by a
language model, bounded at every step by deterministic checks it cannot talk its way past:

1. The pipeline license-checks every corpus source before ingestion. It uses an exact-match SPDX
   allowlist and fails closed.
2. The model fills the pinned concepts with grounded content, returns relations that code projects
   onto the pinned edge set, translates each converged concept into cited lesson steps, and
   pre-builds the optional analogies as clearly labelled illustrations.
3. Bounded validate → repair → re-validate loops check graph structure, goal reachability,
   quote-primary provenance, lesson citations, and the readability floor.
4. On convergence, `pnpm atomize` writes the sorted graph and a run log recording each call's token
   usage and cost. **It never writes a failing graph.**
5. The browser receives only that committed artifact and calls the pure `getPath()` function
   locally.

The map is human-specified; model output *fills* it with grounded lessons and citations, and is not
trusted until the deterministic checks pass.

## How this was built with Codex

Each negative test names the cheating implementation it kills. A `() => []` stub, a hard-coded
golden path, a substring shortcut, and a first-match source lookup each have a test built to catch
them. That adversarial suite fenced Codex with executable constraints it could not talk past.

**A safety property, and it is not circular.** No fabricated citation passes the gates: five tamper
scenarios — empty-graph stub, hard-coded golden path, substring-faked citation, first-match source
lookup, hand-edited graph.json — are all rejected (5 / 5), and every lesson step's cited source excerpt is checked
byte-for-byte against the real source — the plain-English lesson is a faithful translation of that
excerpt, shown beside it so you can judge the translation; analogies are illustrative, not sourced. Unlike a live-AI tutor whose grader is validated on a gold
set its own model family authored, this proof rests on deterministic checks against a real CC-BY-SA
source — there is no model judging itself at read time.

One model, `gpt-5.6-sol`, did two jobs here.

As Codex, the coding agent, it wrote this repository in a phase-gated RED→GREEN run. The committed
[`docs/kickoff-prompt.md`](docs/kickoff-prompt.md) is the collaboration record: it fixed the
acceptance gates, resumed Codex phase by phase, and forbade weakening tests or hand-writing the
graph.

The same model is the build-time atomizer inside the product. Working inside the pinned ten-concept
structure, it produces candidate lessons, citations, and analogies for deterministic validation. That role never runs when a
learner reads; the browser receives only committed artifacts.

So `gpt-5.6-sol` both built the machine and is the intelligence the machine calls at build time, and
in both roles the same discipline holds: it proposes, and gates that it cannot talk past decide what
ships.

## What ships beyond the reader

The thesis is the compiler and its receipts. Everything below is supporting evidence that the
guarantees travel — not the headline.

- **A build receipt.** The compile records a machine-checkable receipt in
  [`data/graph.run.json`](data/graph.run.json): the source corpus and pin, the model, token usage,
  cost, and the graph's sha256 (`1672b7d6…`) that `src/atomization/graph-run.test.ts` recomputes. It
  distinguishes the human-specified structure from the model-generated prose, and records that the
  browser makes zero model calls.
- **Seven exports, attribution-clean.** The one graph emits an `llms.txt` manifest, an
  [org-roam graph](atomic-learning-graph.org), a
  [native Tinderbox document](atomic-learning-graph.tbx) with a
  [portable OPML outline](atomic-learning-graph.opml), an [Obsidian vault](exports/obsidian/), an
  [Anki deck](atomic-learning-graph-anki.tsv), and a
  [grounded practice exam](atomic-learning-graph-exam.md) — the most education-shaped artifact:
  every answer in its key carries the verbatim source passage that grounds it — plus a
  machine-checkable [course receipt](data/course.receipt.json). The six learning-content exports
  carry CC-BY-SA attribution, a deed link, and a modification notice; the receipt records the work,
  authors, license, revision, and graph hash.
  `pnpm verify:llms|orgroam|tinderbox|obsidian|anki|exam|receipt` gates them against the committed
  graph. The Obsidian vault opens with a prerequisite-ordered **Start Here** note and carries the
  full cited lesson in every concept note; org-roam leads with the same learning path. The native
  Tinderbox document opens directly with styled concept/source/edge prototypes, a mapped learning
  path, and native prerequisite links. The deterministic OPML remains the gated, rebuildable
  interchange artifact: Tinderbox imports it in one shot, promotes graph metadata to inspectable
  user attributes, applies the presentation, and materializes prerequisite links while preserving
  every canonical relation as a typed edge record.

  These are deliberately **opinionated, presentation-ready projections**, not neutral dumps or
  new authorities. Each emitter applies the best practices we could verify in that format's
  documentation and community conventions: navigable entry points, native metadata, useful
  ordering, readable labels, attribution where a learner encounters the content, and styling when
  the format supports it. Those choices can be changed in the emitter; `data/graph.json` remains
  the only authority for course content and relationships. The implementation follows the native
  guidance for [Anki text imports](https://docs.ankiweb.net/importing/text-files.html),
  [Obsidian links](https://help.obsidian.md/links),
  [org-roam](https://www.orgroam.com/manual.html),
  [Tinderbox OPML attribute mapping](https://atbref.com/atbref10/index/Formatting/Support_for_other_app-specific_formats/OmniOutliner.html),
  and the [llms.txt proposal](https://llmstxt.org/), rather than forcing every platform into one
  lowest-common-denominator shape.

  A separate, optional export showcase presents a plain-language mini-course about the product in
  each supported application. It doubles as human onboarding and a presentation fixture: people
  can learn how Atomic Learning works in their preferred tool, while maintainers can inspect that
  tool's links, hierarchy, metadata, and styling. Normal course exports do not include this product
  tutorial, so repeat exports stay clean.

### Open the course in the app you already use

No coding is required. Download the file or folder for your app, then follow the matching row:

| Format | What it is | How to open and use it |
|---|---|---|
| [Obsidian vault](exports/obsidian/) | A linked set of course notes with lessons and source receipts. | Download the whole `exports/obsidian` folder. In Obsidian, choose **Open folder as vault**, select that folder, then open **Start Here** and follow the learning path. |
| [org-roam](atomic-learning-graph.org) | The same linked course as one Emacs Org file. | Put the `.org` file in your org-roam folder, open it in Emacs, run `M-x org-roam-db-sync` once, then begin at **Learning Path**. |
| [Tinderbox](atomic-learning-graph.tbx) | A visual course map with styled concept cards, sources, and prerequisite links. | Double-click the `.tbx` file in Tinderbox, open **Concepts** in Map view, and follow the connected notes. The [OPML file](atomic-learning-graph.opml) is the portable one-import version. |
| [Anki deck](atomic-learning-graph-anki.tsv) | Ready-to-study question-and-answer cards with a source receipt on every answer. | In Anki, choose **File → Import**, select the `.tsv` file, keep the **Basic** note type, import it, then choose **Study Now**. |
| [Practice exam](atomic-learning-graph-exam.md) | A printable self-check with questions, passage matching, answer keys, and grounded recall checks. | Open the Markdown file in any Markdown reader or on GitHub. Answer Parts A and B before scrolling to the answer key; print it if you prefer paper. |
| [`llms.txt`](llms.txt) | A plain-text course index made for AI assistants; [`llms-full.txt`](llms-full.txt) contains the complete lessons and receipts. | Attach or paste `llms.txt` into an assistant for the overview. Add `llms-full.txt` when you want it to use the full course, and ask it to follow prerequisite order and show the source receipts. |

**Retention is a handoff, not a rebuild.** This project compiles the inspectable artifact; long-term
spaced review rides on Anki’s proven scheduler via the gated Anki export. We do not reimplement a
forgetting-curve engine — we hand clean, cited cards to one that is already trusted.

- **A single-file offline reader.** `pnpm build:single` emits one `dist-single/index.html` you can
  double-click: no server, no network. `pnpm verify:single` gates it.
- **Bring your own text and key.** `builder/` compiles a course from any pasted open text with your
  own OpenAI, Anthropic, or compatible key. The key lives in memory only, never written to disk. Same
  offline guarantees, your corpus.
- **Cost is stated, not hidden.** The demo graph cost **$0.44** to compile (~**$0.044** per concept,
  36,871 tokens). `src/cost/estimator.ts` is a pure, no-network estimator surfaced in both the reader
  and the builder.

## Run it

Requires Node.js and pnpm. No API key is needed to run, test, or build the committed graph and UI.

`pnpm gate` is the acceptance bar. A passing `pnpm test` is not: it skips corpus verification, the
gap through which a false license notice nearly shipped. The gate brings the repository's checks
together and states what it **does not** prove on every run. Green is bounded evidence, not a claim
that the model's interpretation is correct or that every product quality is solved.

```bash
pnpm install
alg                    # installed automatically; atomic-learning is the long form
pnpm gate
pnpm typecheck
pnpm test
pnpm verify:corpus
pnpm dev
```

`pnpm verify:corpus` is hermetic by default: it validates the committed manifest, source hashes,
extraction transform, and derived notices without a network request. To additionally prove the pins
still match the real upstream source and license bytes, run `VERIFY_UPSTREAM=1 pnpm verify:corpus`.

A production build:

```bash
pnpm build
pnpm preview
```

Use `pnpm preview` rather than opening `dist/index.html` directly because a `file://` origin cannot
load the built module.

### Rebuild the artifacts

- `pnpm estimate:cost -- path/to/source.txt` estimates atomization cost locally without a model call.
- `pnpm render` regenerates paid alternate renderings; it requires an API key and makes two model calls per concept.
- `pnpm demo:tamper` runs the five in-memory tamper scenarios against the production gates.
- `pnpm emit:llms` rebuilds `llms.txt` and `llms-full.txt` from the committed graph and renderings.
- `pnpm emit:orgroam` rebuilds the org-roam graph from the committed graph.
- `pnpm emit:tinderbox` rebuilds the presentation-ready Tinderbox OPML from the committed graph.
  One import applies the hierarchy, inspectable metadata, prototypes, colors, badges, dimensions,
  and prerequisite-layer map positions; no separate styling pass is required. The native `.tbx`
  counterpart opens directly in Tinderbox 11.
- `pnpm emit:obsidian` rebuilds the Obsidian vault from the committed graph.
- `pnpm emit:anki` rebuilds the Anki TSV deck from the committed graph.
- `pnpm emit:exam` rebuilds the grounded practice exam from the committed graph.
- `pnpm emit:receipt` rebuilds the machine-checkable course receipt from committed build facts.
- `pnpm emit:showcase` rebuilds the separate, optional product tutorial in Markdown, Obsidian,
  org-roam, Tinderbox, Anki, and llms.txt formats under `exports/showcase/`. It is for GitHub
  visitors and presentation QA; normal course exports never include it. `pnpm verify:showcase`
  gates the exact showcase bytes.

Atomization is a separate build-time operation and requires `OPENAI_API_KEY`. Output is always
explicit; a run cannot silently replace the committed demo graph:

```bash
pnpm atomize -- --out-dir .artifacts/d2l
```

The syntactic atomicity advisory remains the default. An explicit opt-in adds the build-time GPT-5.6
semantic judge to `atomicity-report.json`; it costs one additional model call per concept and cannot
change convergence or the command's exit code:

```bash
pnpm atomize -- --out-dir .artifacts/d2l-judged --atomicity-judge
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

## Is it maintained?

The honest answer is machine-checkable rather than promised. `pnpm gate` is the maintenance
status: it re-verifies every claim in this README against the committed bytes — grounding,
licenses, pinned hashes, the shipped-bundle network scan — on any machine, with no API key. A
checkout that has rotted goes red; a green gate means the guarantees hold *today*, not that they
held when this paragraph was written. The build receipt in
[`data/graph.run.json`](data/graph.run.json) records what was last compiled, by which model, at
what cost.

## Architecture

- `data/oer/`: pinned upstream Markdown, deterministically extracted source text, and the fail-closed source manifest.
- `data/corpora/openstax-physics/`: a separate one-source CC-BY-4.0 corpus proving manifest-relative ingestion.
- `src/atomization/manifest.ts`: exact-match SPDX allowlist and manifest validation.
- `src/atomization/atomize.ts`: three-phase inventory, relationship, and cited-translation build.
- `src/atomization/translate.ts`: strict lesson schema, anchored excerpts, quote repair, and floors.
- `src/atomization/analogy.ts`: optional build-time analogies for the fixed interest set.
- `src/graph/invariants.ts`: the six hard deterministic proof invariants.
- `src/graph/atomicity-report.ts`: an advisory-only concept atomicity reporter; never a gate.
- `src/graph/atomicity-scorer-llm.ts`: opt-in build-time GPT-5.6 semantic atomicity judge; fail-open
  and injected with the existing Responses client.
- `src/graph/path.ts`: deterministic prerequisite-ancestor walk with a stable tie-break.
- `src/graph/load.ts`: fail-closed loader for the committed graph.
- `scripts/emit-tinderbox.ts`: deterministic, one-shot styled Tinderbox OPML with concepts,
  sources, typed edge records, prototypes, and graph-derived map positions;
  `atomic-learning-graph.tbx` is the styled native document for direct use in Tinderbox 11.
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

In the reader, the graph surfaces as the **evidence map** — an optional view in which every
concept ties back to a cited source passage. The lesson is the message; the map is the
validation layer you summon when you want to check one. Opening it never changes your course.

## What we are not claiming

Honest limits, stated up front:

- **Readability is advisory, not solved.** `READABILITY_HARD_FLOOR` is US grade **16** and only
  *throws* above that; grade **10** is an advisory that warns without blocking. The committed
  [`data/atomicity-report.json`](data/atomicity-report.json) records the real result: **3 of 10
  concepts carry a low-confidence advisory**, and the default goal (`self-attention`) is estimated at
  grade **10.38** (the worst is `positional-encoding` at 11.08). The floor is a build gate against runaway prose, not a promise of grade-8 English.
  Tightening it is a re-translation, not a config change.
- **The graph is small and the domain is narrow.** 10 concepts across four source sections (three chapters). The pitch is the
  substrate and the provenance, not coverage.
- **This artifact is a prerequisite tree, not evidence of a relationship mesh.** The graph type
  supports `prereq`, `method`, and `related`, but the pinned product run deliberately projects onto
  9 `prereq` edges and zero other links. No concept has more than one incoming prerequisite. A
  broader corpus and an explicit `--no-spine` run are the next relationship-mesh experiment, not a
  promised outcome or new graph architecture.
- **Two alternate formats ship; infinite generation does not.** The bundle embeds 20 validated
  alternate renderings (`why-it-exists` and `how-it-works` for each of 10 concepts) with 63 cited
  steps. Their citations and run-log hash are gated. On-demand renderings remain in
  [ROADMAP.md](ROADMAP.md); the learned atomicity judge is opt-in advisory evidence, not a gate.

## Licenses

**Code: MIT. Demo content and D2L source text: CC-BY-SA-4.0. OpenStax proof corpus:
CC-BY-4.0.**

The source code (`src/`, `scripts/` and the build configuration) is licensed
[MIT](LICENSE-CODE). Creative Commons recommends against CC licenses for software, and ShareAlike
is viral on adaptations, so the boundary is drawn between the engine and the text it renders.

The lessons are adaptations of CC-BY-SA-4.0 material from *Dive into Deep Learning* by Aston Zhang,
Zachary C. Lipton, Mu Li and Alexander J. Smola, translated into plain English at build time and
modified from the originals. As adaptations of ShareAlike material, **the lessons are themselves
licensed CC-BY-SA-4.0**.

Redistributed D2L text under `data/oer/`, and the same text embedded in `data/graph.json`, remains
under CC-BY-SA-4.0. The separate OpenStax source under `data/corpora/openstax-physics/` remains
CC-BY-4.0; its adjacent README and manifest record attribution, modifications, license evidence,
revision, and hashes. The original project lessons and prose are licensed
[CC-BY-SA-4.0](LICENSE).

For the D2L demo corpus, see [NOTICE](NOTICE), [DATA-LICENSE](DATA-LICENSE) and
[ATTRIBUTIONS.md](ATTRIBUTIONS.md) for per-source attribution, revision pins, license evidence, and
modification notices.
