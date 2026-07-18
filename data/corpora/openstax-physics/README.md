# OpenStax Physics proof corpus

This separate one-source corpus proves the atomizer's toy path can ingest licensed prose outside
the pinned D2L demo corpus. The source is the OpenStax *Physics* section “Newton's First Law of
Motion: Inertia,” pinned to commit `8044b7aa50bddadf631dee0a9c62e54ca238a8c8`.

- Author/publisher: OpenStax, Rice University
- License: `CC-BY-4.0`
- License evidence: the pinned upstream `LICENSE` statement recorded verbatim in `sources.json`
- Source bytes and extracted-text bytes: SHA-256 values recorded in `sources.json`
- Modifications: comments, MathML, media payloads, and XML markup removed; captions and prose
  retained; XML entities decoded; whitespace collapsed

Run the dry-only proof with:

```bash
pnpm atomize:toy -- --manifest data/corpora/openstax-physics/sources.json
```

This command uses the real model API and costs money. It writes no graph artifact.
