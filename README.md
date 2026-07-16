# Open Atomic Learning Graph

**Turn open educational resources into a navigable graph of one-concept lessons, then follow a
deterministic path from what you know to what you want to learn.**

The demo domain is how LLMs work, with `self-attention` as the goal. GPT-5.6 atomizes a pinned,
open-licensed corpus at build time. Five hard deterministic invariants validate the resulting
graph before it can be committed. The browser then reads only that committed artifact: there is no
chatbot and no request-time model call.

## The loop

1. The build pipeline licence-checks every corpus source before model ingestion.
2. GPT-5.6 extracts grounded concepts and proposes relationships between frozen concept IDs.
3. A bounded validate → repair → re-validate loop checks cycles, orphans, dangling edges, goal
   reachability, and quote-primary provenance.
4. On convergence, `pnpm atomize` writes the sorted graph and run log. It never writes a failing
   graph.
5. The UI loads `data/graph.json` at build time and calls the pure `getPath()` function locally.
   Marking a concept understood recomputes the remaining route from local state.

The shipped artifact contains 10 concepts, 25 relationships (10 prerequisite, 15 related), and the
complete text of four pinned OER sources. Every displayed lesson passage resolves through `sourceId` and uses that concept's
validated `quotedText` plus its embedded source context.

## Run it

Requires Node.js and pnpm.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm verify:corpus
pnpm dev
```

`pnpm dev` starts the local Vite app. A production build is:

```bash
pnpm build
pnpm preview
```

No API key is needed to run, test, or build the committed graph and UI. Regenerating the graph is a
separate build-time operation and requires `OPENAI_API_KEY`:

```bash
pnpm atomize
```

`data/graph.json` is a committed build artifact and is written only by `pnpm atomize`; it must never
be hand-edited. Its checksum is pinned in `data/graph.run.json`, and the test suite recomputes that
checksum to detect post-run changes. See [ADR 001](docs/adr/001-commit-the-generated-graph.md).

## Architecture

- `data/oer/` — pinned upstream Markdown, deterministically extracted source text, and the fail-closed source manifest.
- `src/atomization/manifest.ts` — exact-match SPDX allowlist and manifest validation.
- `src/atomization/atomize.ts` — extractive two-phase atomization and bounded convergence loop.
- `src/graph/invariants.ts` — the five hard deterministic proof invariants.
- `src/graph/atomicity-report.ts` — an advisory-only concept atomicity reporter; never a gate.
- `src/graph/path.ts` — deterministic prerequisite-ancestor walk with a stable tie-break.
- `src/graph/load.ts` — fail-closed loader for the committed graph.
- `src/ui/` — static React interface over the embedded graph, with local-only interactions.

Relations live only in `LearningGraph.edges[]`. Provenance is quote-primary: normalized
`quotedText` must occur in exactly one resolved source, while offsets remain non-load-bearing hints.

## Why a graph, not a chatbot?

Open educational resources are abundant but rarely tell a learner what must be understood first.
The graph is a persistent, inspectable substrate: model output is allowed to propose the map, but it
is not trusted until deterministic checks pass. Once built, path routing is reproducible and
auditable from the graph's content alone.

## Roadmap

The MVP deliberately leaves future capabilities as marked extension points in [ROADMAP.md](ROADMAP.md):
validated multi-format renderings, infinite or on-demand renderings, and a learned atomicity scorer.
They are not represented as working features in the current product.

## Licences

Repository content is licensed under CC-BY-SA-4.0; lessons are modified, AI-translated adaptations
of their cited sources. Redistributed OER text under `data/oer/`, and the same text embedded in
`data/graph.json`, remains under its recorded open licence. See [NOTICE](NOTICE),
[DATA-LICENSE](DATA-LICENSE) and [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for per-source attribution,
revision pins, licence evidence, and modification notices.
