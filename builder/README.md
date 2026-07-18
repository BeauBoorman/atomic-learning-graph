# Local BYOK teacher-builder

The teacher-builder turns source text you own into a self-contained, one-file course. It runs on
your computer, sends the text only to the model provider you choose during the build, and produces
an HTML file that can be opened locally or shared with learners. The builder is separate from the
repository's prebuilt reader.

## Prerequisites and installation

- Node.js 22 or newer
- macOS, Linux, or Windows
- An API key for one of the supported model providers

After cloning or downloading this repository, install its dependencies once from the repository
root. Node.js 22 includes Corepack; if `pnpm` is not already available, enable it first.

```sh
corepack enable
pnpm install
```

## Start the builder

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

The local builder supports macOS, Linux, and Windows with Node.js 22 or newer. It uses the same
localhost interface and run command on each platform.

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
