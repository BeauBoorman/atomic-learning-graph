# Atomic Learning Graph — developer skill pack

Eight in-repo skills that encode how to work on THIS project with an agent. Each skill
points at the durable law (`AGENTS.md`, `src/atomization/AGENTS.md`, the in-source
docstrings) rather than duplicating it. Load the skill that matches the task; do not load
all eight.

This shared `.agents/skills/` location is the single canonical copy. Do not mirror these
names into tool-specific skill directories: compatible harnesses discover this directory,
and duplicate names make skill selection ambiguous.

| Skill | Load when |
|---|---|
| [`alg-dev`](alg-dev/SKILL.md) | First time on the repo, or any task that touches multiple subsystems. Orient yourself here. |
| [`alg-gate`](alg-gate/SKILL.md) | Running or interpreting `pnpm gate`, reading a red stage, adding an invariant. |
| [`alg-atomize`](alg-atomize/SKILL.md) | Regenerating `data/graph.json`, repairing convergence failures, rendering alternates. |
| [`alg-corpus`](alg-corpus/SKILL.md) | Adding or replacing a source, license questions, `verify:corpus` hermetic vs upstream. |
| [`alg-exports`](alg-exports/SKILL.md) | Changing an emitter (org-roam, Anki, Tinderbox OPML, Obsidian, exam, llms) or the receipt/showcase. |
| [`alg-ui`](alg-ui/SKILL.md) | Reader UI work (Vite + React + Cytoscape), gate9 tripwire, `verify:bundle` shipped-bytes gate. |
| [`alg-builder`](alg-builder/SKILL.md) | The BYOK TUI + local server, in-memory key handling, `verify-course` packaging. |
| [`alg-audit`](alg-audit/SKILL.md) | Tamper demos, gitleaks, the AI-trailer history rewrite for public publishing. |

## Precedence (deeper wins)

`AGENTS.md` (root) → `src/atomization/AGENTS.md` → in-source docstrings (`src/graph/invariants.ts`,
`src/graph/path.ts`, `src/atomization/manifest.ts`) → these skills. Where a skill and a docstring
disagree, the docstring wins and the skill is stale. Say so.

## What these skills do NOT replace

- The non-negotiables in `AGENTS.md`. They are the law; the skills are workflow recipes.
- The docstrings. The docstrings say why; the skills say how.
- The test suite. Roughly half the suite is adversarial; each negative test pins an invariant
  that no skill is allowed to weaken.

## Public

These skills ship with the repo. Anything you add here is something a judge, a contributor,
or a stranger on r/pkms will read. No internal codenames, no deadline stress, no Beau-only
context.
