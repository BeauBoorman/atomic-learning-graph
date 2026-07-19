---
name: build-a-course
description: Build a one-file offline Atomic Learning course from the user's open or licensed source text. Use when asked to make a course, atomize their text, or create an offline reader; require the user's own provider key and explicit permission to embed the text.
---

# Build a course from the user's text

Use this skill only from an Atomic Learning repository checkout. Build a new, self-contained course
from text the user owns or is licensed to adapt and embed. Do not use unlicensed, closed, or
permission-unclear text. Ask for a local source-file path, a title, and explicit confirmation that
the user may embed the text in the generated course.

The builder needs at least 12,000 characters (about five pages). Shorter text can fail after the
provider has charged for work. The user must supply their own provider key in their terminal
environment (for example, the provider's documented environment variable). Never ask the user to
paste a key into chat, print an environment variable, hardcode a key, or commit a `.env` file.

## Guided terminal flow

From the repository root, install dependencies once:

```sh
pnpm install
```

Start the verified terminal builder:

```sh
pnpm alg
```

Choose **3. Build a new offline course (paid)**. Give it the source-file path and course title,
choose the provider and model, confirm the text-rights prompt, review the displayed cost estimate,
and obtain the user's confirmation before the final paid-build confirmation. Save the result to the
user's requested `.html` path. The terminal reports `Course ready: <path>` when it succeeds.
Open that saved HTML file in a modern browser to preview and read it; it is the durable offline
course and does not need a local server after the build completes.

## Worked example

For “Build a course called *Intro to Plant Cells* from `/path/to/open-text.txt`,” first confirm that
the file is at least 12,000 characters and carries an open license or the user's permission. Ask the
user to set their own provider key in their terminal, then run `pnpm alg`, choose option 3, provide
that path and title, and stop for approval at the displayed cost and final confirmation. Save the
result as a user-approved name such as `intro-to-plant-cells.html`.

## Boundaries

This is a paid, build-time model operation. The resulting HTML is offline after a successful build,
but the build itself sends the permitted source text only to the provider the user selects. Never
hand-edit `data/graph.json` or `data/renderings.json`; this local-builder flow creates a separate
course file and does not modify the committed demo artifacts.
