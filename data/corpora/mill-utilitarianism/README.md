# Mill Utilitarianism humanities proof corpus

This separate one-source corpus proves the atomizer can ingest prerequisite-bearing humanities
prose outside the D2L machine-learning demo and OpenStax physics proof corpora. The source is
Chapter II, “What Utilitarianism Is,” from John Stuart Mill's *Utilitarianism*, pinned to commit
`7417ae902febaa7fb3c1c1c83e5ea0d33bef0529` in the GITenberg Project Gutenberg mirror.

- Author: John Stuart Mill
- Licence: `public-domain`
- Licence evidence: the pinned repository `README.rst` statement recorded verbatim in `sources.json`
- Source bytes and extracted-text bytes: SHA-256 values recorded in `sources.json`
- Modifications: the contiguous Chapter II text was selected from the pinned plain-text edition;
  the Project Gutenberg header, title matter, contents, other chapters, and footer were omitted;
  CRLF line endings were normalized to LF, with no prose changes

Run the unpinned humanities atomization with:

```bash
npx tsx src/atomization/atomize.ts --manifest data/corpora/mill-utilitarianism/sources.json --no-spine --out-dir .artifacts/mill-utilitarianism
```

This command uses the real model API, costs money, and writes only to the explicit artifact directory.
