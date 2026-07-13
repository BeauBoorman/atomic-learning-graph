# Open Atomic Learning Graph

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

The reflex fix is an AI tutor chatbot. The evidence says that's the weaker bet: Khan Academy's own
Khanmigo reportedly saw only ~15% engagement, while their *structured, prerequisite-graph*
intervention moved the needle on actual learning. `[VERIFY these figures before publishing.]`

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
- **Next.js (App Router) + React Flow + dagre**, deployed on Vercel.
- **Static (SSG). Atomization is build-time** — `pnpm atomize` calls GPT-5.6 offline to produce
  `graph.json`; the deployed app makes **no LLM call on the request path**.
- Path routing is a deterministic walk over the prebuilt prerequisite DAG (auditable, not a model call).
- Provenance (`sourceId` + char offsets) is captured deterministically at atomization time.

## Built with Codex + GPT-5.6
*(This is the graded section. Two claims, both true and shown, not asserted.)*

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
```bash
pnpm install
pnpm atomize   # build the graph from data/oer/ (needs OPENAI_API_KEY)
pnpm test      # graph invariants must pass
pnpm dev
```
