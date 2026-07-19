---
name: alg-builder
description: The local BYOK teacher-builder at builder/ — a TUI and local server that turns source text you own into a self-contained one-file course using your own OpenAI, Anthropic, or compatible key. The key lives in memory only and never touches disk. Load when working on builder/, the TUI, the server, the course packaging, or verify-course. Triggers "builder/", "BYOK", "alg", "atomic-learning", "pnpm tui", "build a course", "builder server", "verify-course", "builder/tui.mjs", "builder/server.mjs", "builder/package-course.mjs", "in-memory key".
---

# alg-builder — local BYOK course compiler

`builder/` is a separate tool from the repo's prebuilt reader. It takes source text you
own, calls a model provider YOU choose during the build, and produces a self-contained
one-file HTML course you can open locally or share. The reader that ships from that course
runs offline with the same guarantees as the demo reader — no key, no network, no model
call.

## Read first

- `builder/README.md` — installation, use, safety, and test-access instructions.
- `BUILDER.md` (repo root) — short pointer that loads `builder/README.md`.
- `builder/tui.mjs` — keyboard-driven menu (`alg` / `atomic-learning` commands).
- `builder/server.mjs` — local HTTP server. Holds the key in memory only.
- `builder/atomizer.mjs` — the build pipeline (calls the same deterministic gates the
  main atomizer does, adapted for the builder's in-process context).
- `builder/build-course.mjs` — orchestrates a build.
- `builder/package-course.mjs` — packages the result into one HTML file.
- `builder/verify-course.mjs` — `verify-course` post-build check.

## The key lives in memory only

The model key is provided at runtime, lives only in the server process's memory, and is
never written to disk, never logged, never committed. If the server is killed, the key is
gone. The build pipeline calls the provider during compile; the resulting offline reader
makes no further calls.

This is the same model as the main repo's atomizer (build-time call, no request-time call),
applied to a course the user compiles themselves.

## Prerequisites

- Node.js 22.18+ (the server imports TypeScript directly and needs built-in type stripping).
- macOS or Linux. Windows is untested; use WSL.
- An API key for one of the supported providers (OpenAI, Anthropic, OpenAI-compatible).

## Starting the builder

Use the package scripts to start the keyboard-driven TUI from any checkout:

```sh
pnpm alg            # or: pnpm tui
```

Both run `node builder/tui.mjs`. The TUI presents Explore, Export, and Build choices; its
build flow reads a source-file path and prompts for provider settings.

`pnpm install` also attempts to install the optional `alg` and `atomic-learning` aliases in
`~/.local/bin` (or the Windows app-bin directory). Use a bare alias only after confirming it
is on `PATH`; `pnpm alg` remains the portable route.

You can also start the server directly:

```sh
cd builder && node server.mjs
```

The server prints a local URL on startup. Open it in a browser to drive the build.

## What a build does

1. Reads source text from the request body (in memory).
2. Calls the model provider at compile time using the in-memory key.
3. Runs the same deterministic gates as the main atomizer: license allowlist is N/A for
   user-supplied text, but quote-primary provenance, the 6 hard invariants, and the
   readability floor all apply.
4. Packages the resulting graph + lessons + citations + source receipts into one HTML file
   via `vite.course.config.ts` and `inline-course.mjs`.
5. `verify-course` checks the packaged course is one self-contained offline file.

## Repo relationship

The builder reuses the main repo's gate primitives (`src/graph/invariants.ts`,
`src/graph/path.ts`, etc.) so a user-built course carries the same structural guarantees as
the demo. It does NOT write to `data/graph.json` or `data/renderings.json` — its output is
a standalone HTML file the user keeps.

The postinstall hook (`scripts/install-tui-aliases.mjs`) attempts a user-level alias; it does
not add its directory to `PATH`. In CI it prints "Skipped user command installation in CI;
package bin aliases remain available." Use `pnpm alg` when the optional alias is unavailable.

## NEVER

- Log the model key, write it to disk, or send it anywhere except the chosen provider.
- Add a `fetch` to a third-party analytics endpoint from the builder server.
- Skip the deterministic gates in a user build. The same invariants that defend the demo
  defend a user-built course.
- Write to `data/graph.json` or `data/renderings.json` from the builder. Output goes to a
  user-chosen path, not the demo corpus.

## Tests

`builder/tui.test.mjs` is part of root Vitest. `builder/tests.mjs` covers the build pipeline
at the level possible without spending real API calls and runs through
`pnpm --dir builder test`, including as a separate acceptance-gate stage.
