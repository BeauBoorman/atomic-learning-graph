# Let your AI assistant run Atomic Learning for you

These are portable [Agent Skills](https://agentskills.io) for an assistant working in an Atomic
Learning checkout. They turn three common requests into safe, concrete workflows:

- `build-a-course` — compile a one-file offline course from text the user may legally embed.
- `export-a-course` — emit the committed demo course for a supported learning or PKM tool.
- `read-a-course` — build and open the self-contained offline reader.

The two `*-atomic-learning` skills are for a developer assistant working on this repository. They
preserve the project's provenance and generated-artifact boundaries.

## Install

Copy each whole skill directory (not just its `SKILL.md`) to one of the locations below, then start
a new assistant session if the harness does not discover it immediately.

### Claude Code

Copy a skill directory to `~/.claude/skills/<skill-name>/`. Claude Code reads `SKILL.md` files from
that personal location; inside a checkout, `.claude/skills/<skill-name>/` makes a skill project-local.

### Codex

Copy a skill directory to `~/.agents/skills/<skill-name>/` for personal use, or to
`.agents/skills/<skill-name>/` at a repository root for project-local use. Codex uses `AGENTS.md`
for durable repository guidance and `.agents/skills/` for discoverable skills, so keep these as
separate surfaces.

### OpenCode

Copy a skill directory to `~/.config/opencode/skills/<skill-name>/` for personal use or
`.opencode/skills/<skill-name>/` in a project. OpenCode also recognizes the Claude-compatible
`.claude/skills/` and agent-compatible `.agents/skills/` locations, so either shared layout works.

## Before an assistant runs anything

The assistant needs a local checkout and dependencies installed with `pnpm install`. The build skill
requires the user's own provider key in their terminal environment; the key must never be sent in
chat, printed, committed, or placed in a skill. The committed demo reader and exports need no API
key.
