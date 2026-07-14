# Open Atomic Learning Graph

> ### ⚠ BUILD STATUS — 2026-07-13
> **This repo is mid-build for OpenAI Build Week (submission Jul 21).**
> **Landed:** the data model, the graph invariants + pathfinder + licence gate as a *deliberately
> failing* (and deliberately adversarial) test suite, and the architecture decisions.
> **Not built yet:** the atomizer (`pnpm atomize`), the generated graph (`data/graph.json`), the
> pathfinder body, and the web UI — there is **no `pnpm dev` script and no app**. See
> [Run it](#run-it): every command there is marked ✅ works or ❌ not built. Nothing in this README
> claims more than the repo can do.

**Turn any open educational resource into a navigable graph of one-concept-at-a-time lessons, and
get a personalized path from where you are to what you want to learn — no grades, no paywall.**

Demo domain: **how LLMs work** · Golden path: **"understand how self-attention works"**
(vectors → dot product → softmax → query/key/value → self-attention)

- 🎥 Demo video: `[CONFIRM — YouTube <3:00, public]`
- 🌐 Live app: `[CONFIRM — Vercel URL]`
- 💻 Repo: `[CONFIRM — public]`

## The problem
Open educational resources are free and abundant but **unstructured** — for "how LLMs work" the
internet is a pile of disconnected explainers, blog posts, and papers with no map of what you need to
understand *first*. Established subjects like algebra got hand-built prerequisite maps (Khan Academy)
over years; fast-moving and long-tail subjects never will. So a self-directed learner who wants to
understand transformers has no path — just a wall of material at the wrong level.

The reflex fix is an AI tutor chatbot. Khan Academy's own published numbers suggest the chat window
is not where the leverage is:

- **A chatbot alone doesn't get used.** Khan reports that "only around 15% of students who have
  access to Khanmigo engage with it" — [*Learning in the Open: What AI Is (and Isn't) Changing*](https://blog.khanacademy.org/learning-in-the-open-what-ai-is-and-isnt-changing/),
  Khan Academy, 28 Apr 2026. (That is the share of students *with access* who engage — an adoption
  rate, not a measure of whether it teaches.)
- **Structure is what improved it.** When Khan set out to make the tutor measurably better, the
  gains came from feeding it *prerequisite structure*: "surfacing prerequisite skills the student
  hasn't yet mastered and offering a brief review before the harder problem improved next-item
  correctness by 2.7%" — one of two structured-context changes that together produced a 6.1% gain.
  [*How Khan Academy Is Building a Better AI Tutor*](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/),
  Khan Academy, May 2026. ("Next-item correctness" = whether the student then solves the next
  problem *unassisted* — a transfer measure, not engagement.)

Read together: the tutor got better when it was given a prerequisite graph to stand on. The graph is
the substrate; chat is just one surface over it. So we build the substrate — for a subject that
doesn't have one.

**Why this isn't just "Khan for AI".** Khan hand-built its graphs. We show an AI *building* the
prerequisite graph from open resources for a subject **no one has mapped** — the same pipeline works
on any domain. As a correctness check, we run it on algebra and it reconstructs the established
prerequisite ordering, so we know the structure it builds is sound.

## What it is (and what it is not)
Not a chatbot. A **persistent, inspectable learning graph**: GPT-5.6 *builds* it from OER (one
concept per node, prerequisite edges), and a **deterministic** pathfinder reasons over it. You state
a goal → the graph highlights the exact concepts between you and it → you work one atomic lesson at a
time → each node you master unlocks the next. Every node carries **provenance** back to the exact
source passage it was atomized from.

**The loop:** goal → graph renders → personalized path highlights → open one atomic lesson → mark
understood → the path advances and prerequisites unlock.

## Architecture

**Built and in the repo today:**
- **The data model** (`src/types.ts`) — concepts, edges, provenance, sources.
  `LearningGraph.edges[]` is the single source of truth for relations.
- **The graph invariants** (`src/graph/invariants.ts`) — one concept per node, acyclic prerequisite
  DAG, no orphans, goal reachable, no dangling edges, **and every node's quote verified against its
  source**. Currently *deliberately failing stubs*: the tests were written first, and GPT-5.6/Codex
  implements them (see below).
- **The licence gate** (`src/atomization/manifest.ts`) — the atomizer refuses any source that is not
  listed in `data/oer/sources.json` with an allowlisted open licence.

**Decided, not yet built** (dependencies today are only `typescript`, `tsx`, `vitest`):
- **Atomization is build-time, never request-time** — `pnpm atomize` will call GPT-5.6 offline to
  produce `data/graph.json`; the deployed app makes **no LLM call on the request path**.
- **Path routing is a deterministic walk** over the prebuilt prerequisite DAG (`src/graph/path.ts`) —
  auditable, reproducible, not a model call.
- **The UI**: a static graph view (Next.js / React Flow / dagre is the intended stack; none of it is
  installed yet).

**Provenance is quote-primary.** Each node carries the **verbatim quote** it was atomized from
(`sourceId` + `quotedText`), and the full source text ships inside the graph — so "did the model
hallucinate this node?" is a *computed boolean* (does the quote actually occur in the source?),
verifiable offline and on camera. Character offsets are kept as optional *hints* and are never
trusted or validated against: an LLM's character arithmetic is an unverifiable assertion, a quote is
a checkable fact.

## Built with Codex + GPT-5.6
*(This is the graded section. Two claims, both true and shown, not asserted.)*

> ⚠ **IN PROGRESS — this section is written but not yet EARNED.** The core Codex session has not run
> yet, so the claims below are the plan, not the record. Nothing here goes in the final README until
> the invariant bodies, the atomizer, and the pathfinder exist and the tests are green. The
> placeholders below are the evidence slots they will be filled from.

**1. GPT-5.6 (via Codex) built the hard parts.** Not glue — the structural core: the OER→graph
atomization pipeline, prerequisite-edge inference, and the pathfinding walk were authored in Codex
sessions. We drove it test-first: we wrote failing **graph-invariant tests** (one-concept-per-node,
acyclic prerequisite DAG, goal-reachability, provenance completeness) and had Codex implement to
green.

- We structured prompts as **Goal / Context / Constraints / Done-when**. Example:
  > `[PASTE a real prompt — e.g. the one that built the prerequisite-edge inference — plus a
  > sentence on the output and the one correction we made.]`
- We led with **oversight, not speed**: `[describe how you reviewed diffs / worktree, what guardrails
  (the invariant tests) constrained the agent, and where you overrode it].`
- `/feedback` Codex Session ID (core-functionality thread): `[CONFIRM — paste unchanged]`

**2. GPT-5.6 is the runtime engine.** It's what *atomizes* OER into the validated concept graph the
whole product is built on. The graph, with visible provenance and passing invariants, is the hero.

## Roadmap (the bigger idea)
"How LLMs work" is one domain of an **open, universal atomic learning graph** — one canonical node
per concept, infinite AI-generated renderings (translations, difficulty levels) hanging off each,
community-improvable. Point the pipeline at any OER corpus and it maps a new subject. Wikipedia-scale
ambition; this MVP is the working kernel of the engine.

## Run it

**Works today** (no API key needed):
```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # the graph invariants
```
⚠️ `pnpm test` is **RED right now, on purpose.** The invariant tests were written *first* (TDD): the
functions in `src/graph/invariants.ts` are stubs that throw `not implemented`, and the tests against
`data/graph.json` fail because no graph has been generated yet. Roughly half the suite is
*adversarial* — negative tests that a lazy implementation (`findOrphans = () => []`) must fail. The
RED→GREEN transition is the on-camera proof that GPT-5.6/Codex did the structural work.

**Not built yet** — these commands do not work, and this section says so rather than pretending:
```bash
pnpm atomize   # ❌ src/atomization/atomize.ts does not exist yet.
               #    Will read data/oer/ (licence-gated) -> write data/graph.json.
               #    Needs an OpenAI key: cp .env.example .env, set OPENAI_API_KEY.
pnpm dev       # ❌ no `dev` script and no app yet. Nothing to serve.
```

`data/graph.json` is a **committed build artifact**, deliberately not gitignored: the deployed app
must ship with a graph, and re-running a non-deterministic LLM atomization in CI could hand the
judges a different graph than the one whose invariants we verified. It is written **only** by
`pnpm atomize` — never hand-edited. See [ADR 001](docs/adr/001-commit-the-generated-graph.md).
