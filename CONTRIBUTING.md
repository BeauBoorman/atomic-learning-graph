# Contributing

Thank you for improving Atomic Learning. The product claim is about an inspectable, generated
course, so preserve the boundaries that make it inspectable.

1. Read [AGENTS.md](AGENTS.md), the relevant source docstrings, and the existing tests before
   changing behavior.
2. Never hand-edit `data/graph.json` or `data/renderings.json`; use the documented generation
   commands only when a task explicitly calls for them. Use `src/graph/fixture-graph.ts` for tests.
3. Keep relations in `LearningGraph.edges[]`, keep provenance quote-primary, and do not turn
   advisory atomicity reporting into a build gate.
4. Do not commit credentials, provider keys, or unlicensed source text.
5. Run `pnpm gate` before proposing a change. A green gate is bounded evidence about the committed
   artifact, corpus, build, exports, and bundle—not a blanket quality claim.

Documentation changes should keep the limits and attribution visible, and should check every changed
link. For a course or export change, treat the committed graph as the authority and update its
deterministic emitter rather than editing a derived export by hand.
