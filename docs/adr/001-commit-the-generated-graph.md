# ADR 001: Commit the generated `data/graph.json`

**Status:** Accepted · **Date:** 2026-07-13 · **Context:** Build Week, submission 2026-07-21

## Decision

`data/graph.json` is produced by the explicit command `pnpm atomize --out-dir data
--overwrite-existing` and **committed to the repo**, not gitignored. The deployed app reads the
committed graph. `atomize` is **never** run in CI or on the request path.

## Why

The graph is a *generated* artifact, and the reflex is to gitignore generated artifacts. That reflex
is wrong here, for four reasons in descending order of importance:

1. **Atomization is non-deterministic; the demo depends on specific node IDs.** The golden path
   (`vectors → dot-product → softmax → qkv → self-attention`) is the demo. If CI re-ran `atomize` on
   each build, the LLM could emit different concept IDs, a different decomposition, or different
   edges. The graph the judges load would not be the graph we tested the invariants and the
   golden path against. A re-atomized graph can silently break the demo path while every test that
   ran *before* the deploy was green. Committing the graph makes the artifact under test and the
   artifact in production **the same bytes**.
2. **No live-LLM dependency in the demo path.** Running `atomize` at build time puts an OpenAI API
   call between us and a working deployment. An outage, a rate-limit, or a schema wobble at 16:55 on
   the 21st would take the demo down at exactly the moment it cannot be down. A committed JSON file
   cannot fail to respond.
3. **Cost and speed.** `atomize` calls GPT-5.6 across the whole OER corpus. CI runs on every
   push; paying for a full re-atomization per push is pure waste on an 8-day budget, and it makes
   every deploy slow.
4. **It is the artifact, not a byproduct.** The pitch is "an AI *built* this graph and it passes the
   invariants." The graph is the deliverable: reviewable in a diff, inspectable by a judge, and
   diffable when we re-atomize. That is an asset, not clutter.

## What we rejected

- **Run `atomize` in CI with `OPENAI_API_KEY` in env.** Rejected: introduces (1), (2) and (3)
   above. This is the option the default `.gitignore` was quietly forcing us into.
- **Atomize at runtime / on request.** Rejected outright because the README promises the deployed
  app makes no LLM call on the request path, and a per-request LLM call would be slow, costly, and
  non-deterministic.

## Costs we are accepting (this is not free)

- **The committed graph can go stale** relative to `data/oer/`. Accepted: the corpus is frozen for
  the demo, and regeneration is a deliberate act.
- **"The generated graph passes the invariants" is now only as true as our commit discipline.**
  This is the real risk, and it has teeth: the claim is the entire pitch.

## Rules that keep the above honest

1. **`data/graph.json` is written ONLY by `pnpm atomize --out-dir data --overwrite-existing`.
   Never hand-edit it. Never hand-forge it.** A hand-authored graph would make the headline claim
   false. If you need a graph to develop against, use a *fixture* that is clearly named as such (see
   below). Never use a fake `data/graph.json`.
2. **Regenerate deliberately, then commit the regenerated file:** `pnpm atomize --out-dir data
   --overwrite-existing && pnpm test`. Bare `pnpm atomize` is rejected because output selection is
   mandatory, and an existing artifact is rejected unless `--overwrite-existing` is present. The
   test suite (`generated data/graph.json` describe-block) runs the invariants against the committed
   file, so a bad or stale-and-invalid graph fails the suite rather than shipping.
3. **Fixtures are never presented as generated output.** The hand-built 5-node graph in
   `src/graph/fixture-graph.ts` is a *fixture*: it exists to test the invariant functions and the
   pathfinder without an LLM, and it is labelled as such in its own header. It is not, and must not
   be copied to, `data/graph.json`. The test suite now enforces this from the other side too. The
   `generated data/graph.json` block asserts the committed graph is **not** a copy of the fixture.
