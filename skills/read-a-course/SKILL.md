---
name: read-a-course
description: Build and open Atomic Learning's one-file offline reader. Use when a user asks to read the shipped course offline, save it for travel, or open a self-contained local learning path.
---

# Read the course offline

Use this skill to package the committed demo reader as one HTML file. It does not call a model and
does not require an API key.

From the repository root, install dependencies once:

```sh
pnpm install
```

Build the standalone reader:

```sh
pnpm build:single
```

The result is `dist-single/index.html`. Open that file in a modern browser from the local filesystem;
it is self-contained and does not need a development server or network connection.

On the opening screen, choose a learning goal, optionally mark prerequisites already known, choose
Quick or Thorough depth, and optionally select familiar-example analogies. Select **Start learning**,
use **Next idea** to follow the deterministic prerequisite route, and open the evidence map or source
receipt when the learner wants to inspect a claim. Progress is stored locally by goal and route.

Do not start a persistent development or preview server for this offline workflow: it is unnecessary
when the one-file reader is the requested outcome. Never hand-edit
`data/graph.json` or `data/renderings.json`.
