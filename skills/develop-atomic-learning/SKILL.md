---
name: develop-atomic-learning
description: Implement a safe Atomic Learning repository change. Use when Codex is asked to change the compiler, graph, static reader, builder, or deterministic export pipeline while preserving the project's provenance and offline guarantees.
---

# Develop Atomic Learning safely

Read the nearest `AGENTS.md` and the relevant source docstrings before editing. Treat the committed
graph as the product artifact, not a fixture: never hand-edit `data/graph.json` or
`data/renderings.json`. Use `src/graph/fixture-graph.ts` for tests.

Keep `LearningGraph.edges[]` as the only relation authority. Keep provenance quote-primary: validate
`sourceId` plus normalized `quotedText`, not offsets. Preserve the split between six hard
deterministic invariants and advisory-only atomicity reporting. Do not weaken adversarial tests to
make an implementation pass.

The atomizer is a paid, non-deterministic build operation. Do not run it, or any rendering operation,
without explicit user authorization and a deliberate output location. Keep source ingestion
fail-closed on the exact license allowlist. Never place a provider key, token, or user source text in
committed files.

For an implementation change, prefer focused tests while developing, then use the repository
acceptance gate before handoff:

```sh
pnpm gate
```

Do not start persistent development or preview servers in an agent session. A green
gate is bounded evidence about the committed artifact, corpus, exports, build, and shipped bundle—do
not describe it as proof that every model interpretation is correct.
