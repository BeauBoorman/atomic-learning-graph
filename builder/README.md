# Local BYOK teacher-builder

The teacher-builder turns source text you own into a self-contained, one-file course. It runs on
your computer, sends the text only to the model provider you choose during the build, and produces
an HTML file that can be opened locally or shared with learners. The builder is separate from the
repository's prebuilt reader.

## Prerequisites and installation

- Node.js 22.18 or newer (the server imports TypeScript directly and needs built-in type stripping)
- macOS or Linux (Windows is untested; use WSL)
- An API key for one of the supported model providers

After cloning or downloading this repository, install its dependencies once from the repository
root. Node.js 22 includes Corepack; if `pnpm` is not already available, enable it first.

```sh
corepack enable
pnpm install
```

## Start the builder

Installing the repository automatically adds two terminal commands for the keyboard-driven menu:

```sh
alg
# or: atomic-learning
```

The installer never replaces an unrelated command with either name. From inside the repository,
`pnpm alg` and `pnpm tui` are always available as fallbacks.

> **Postinstall side effect, in case you audit installs:** `pnpm install` runs
> `scripts/install-tui-aliases.mjs`, which creates the `alg` and `atomic-learning` symlinks in
> `~/.local/bin` (or `%LOCALAPPDATA%\Microsoft\WindowsApps` on Windows). It is idempotent,
> refuses to clobber an unrelated command at either path, and self-skips in CI unless
> `ALG_INSTALL_TUI_ALIASES=1` is set. Set `ALG_BIN_DIR=<dir>` to choose a different target
> directory. Uninstall is `rm ~/.local/bin/{alg,atomic-learning}`. If a `postinstall` that
> writes to your PATH is not acceptable in your environment, run
> `pnpm install --ignore-scripts` and use `pnpm tui` from inside the repo instead.

The terminal UI can explore the committed course, rebuild any supported export, or guide a new
paid course build. It shows the deterministic cost estimate and requires you to type `BUILD`
before any model call. API keys are read from the provider's environment variable, a local `.env`,
or a masked session-only prompt; the key is never displayed, logged, saved, or placed on the
command line.

The browser builder remains available:

From the repository root:

```sh
cd builder && node server.mjs
```

The terminal prints a local URL, normally `http://127.0.0.1:4179`, and usually opens it in your
default browser. Keep the terminal running while you build and view the course. Stop the builder
with **Control-C**.

## Build a course

No command-line knowledge is needed after the builder starts:

1. Open the localhost URL printed in the terminal.
2. Paste text that you own and are allowed to embed in the generated course.
3. Choose a provider and model, then paste your own provider API key.
4. Complete the title, author, and owned-content confirmation.
5. Click **BUILD MY OFFLINE COURSE**.
6. When the build finishes, click **OPEN COURSE** or **SAVE THE ONE FILE** to download the
   self-contained HTML course.

A build makes model API calls billed by your chosen provider.

## Supported providers

- OpenAI
- Anthropic
- Any OpenAI-compatible endpoint: enter its base URL, model ID, and API key. The endpoint must
  provide an OpenAI-compatible `/chat/completions` route.

Provider requests are made by the local Node server, never by browser code. Your API key is held
server-side in memory only for the current build, then discarded. It is never logged, written to
disk, placed on a command line, or embedded in the generated course.

## Supported platforms

The local builder is developed and tested on macOS and is expected to work on Linux, with
Node.js 22.18 or newer. Native Windows is untested — the build step shells out to `pnpm`, which
Windows resolves differently — so on Windows use WSL. The localhost interface and run command are
the same wherever it runs.

## Test access

There is no hosted instance or shared test account to request. Reviewers run the builder locally
and bring their own provider API key (BYOK); no project-owned key is required.

To exercise the builder without a provider key or network call, run its offline test from the
repository root:

```sh
pnpm --dir builder test
```

The test uses the repository's labelled fixture graph through a mocked atomizer seam. It builds the
real one-file reader in a temporary directory and verifies that provider-specific sentinel keys are
not exposed in output or temporary files.

### Two test runners, by design

The builder is exercised by **two** test runners. Both run as part of the root acceptance gate
(`scripts/gate.sh`):

| Runner | Discovers | Run as | What it covers |
|---|---|---|---|
| **vitest** (root) | `builder/tui.test.mjs` and every `*.test.ts` / `*.test.tsx` under `src/` and `scripts/` | `pnpm test` | The TUI flow against the React/UI harness; the full deterministic invariant suite, including the adversarial/negative tests against the committed `data/graph.json`. |
| **node:test** (builder-local) | `builder/tests.mjs` | `pnpm --dir builder test` | The offline BYOK packaging path — fixture graph in, one-file reader out, sentinel-key leakage check. |

vitest is the default `pnpm test` runner at the repo root and discovers `builder/tui.test.mjs`
through its default globs (there is no `vitest.config.ts` scoping `include` to `src/`); a future
config change that added such a scope would silently drop the TUI tests from `pnpm test`. The
gate runs both, so coverage does not depend on vitest's discovery alone. If you consolidate onto
a single runner, update `scripts/gate.sh:54,58` first.
