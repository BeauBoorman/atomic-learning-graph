---
name: review-atomic-learning
description: Review an Atomic Learning change for provenance, graph-authority, offline-reader, and deterministic-gate regressions. Use when Codex is asked to review a PR, audit a change, or assess whether the project remains honest about what it proves.
---

# Review Atomic Learning changes

Review findings first. Read the repository guidance, the affected source docstrings, tests, and
actual scripts; do not accept a README claim without checking its implementation and verification
surface.

Flag any hand edit or fixture substitution involving `data/graph.json` or `data/renderings.json`.
Flag relation fields added to `Concept`, offset-primary provenance checks, a weak or bypassable quote
check, source ingestion that is not exact-license allowlisted, and advisory atomicity reporting used
as a hard gate. Treat removed or weakened adversarial tests as defects, not cleanup.

For the offline claim, distinguish source-level intent from the shipped bundle scan. For exports,
distinguish a graph-derived byte check from a claim that a third-party application import was
visually tested. For builder changes, verify keys are never logged, persisted, passed on a command
line, or embedded in output.

When the review is expected to leave the repository ready to ship, run the acceptance gate and report
its result exactly:

```sh
pnpm gate
```

Do not start persistent development or preview servers in an agent session. Do not change the protected generated
artifacts merely to make a check pass.
