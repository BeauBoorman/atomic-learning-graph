# Local course builder

This is a loopback-only GUI around the repository's existing atomizer. It is deliberately outside
the main reader build and outside the shipped-bundle scan boundary.

## Start it

From the repository root:

```sh
pnpm --dir builder start
```

The default browser opens `http://127.0.0.1:4179`. Paste plain text you own, add a title and author,
choose OpenAI, Anthropic, or an OpenAI-compatible endpoint, enter that provider's model and API key,
affirm the CC0 owned-content statement, and choose **BUILD MY OFFLINE COURSE**. Keep the terminal
window open while it builds. The finished course opens in a new browser tab; **SAVE THE ONE FILE**
downloads the same self-contained HTML. Use a high-quality model: the material is educational and a
one-time build costs only cents.

The API key is passed to the existing `src/atomization/atomize.ts` process only through its
environment. It is never placed on a command line, logged, or written to disk. All provider calls
remain server-side. OpenAI uses the existing Responses path; Anthropic requests are adapted to the
Messages API with plain Node `fetch`; compatible endpoints use their `/chat/completions` route at
the selected base URL. Source, manifest, generated graph, and course output live in a system
temporary directory and are removed when the builder server stops. The one-file course contains the
pasted source by design.

## Offline test

```sh
pnpm --dir builder test
```

This uses `src/graph/fixture-graph.ts` through a mocked atomizer seam. It makes no model or network
call, builds the real reader against that fixture in a temporary output directory, verifies the
single-file artifact, and asserts provider-specific sentinel API keys appear in neither captured
output nor any temporary file.
