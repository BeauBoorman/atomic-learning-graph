# ROADMAP — Atomic Learning Graph

This project ships a deliberately small, fully-honest MVP for OpenAI Build Week. It is built to be
**expanded** afterward. The guiding rule (Beau): **preserve every capability as a clearly-marked
slot; delete nothing to simplify.** Everything below was cut from the MVP *on purpose*, each for a
structural reason — not forgotten, not stubbed to look done. The seams are real; the features are
future work.

Nothing here is a request-time LLM feature. The core invariant is permanent: **the AI builds the map
at build time; the map is not allowed to trust the AI at request time.** Every roadmap item must keep
that property.

---

## 1. `Rendering` / `RenderingFormat` — multi-format lesson bodies

**What:** per-concept lesson bodies in several formats ("90-second", "deep", "ELI5") instead of
rendering the lesson from the concept's own validated provenance.

**Why cut (structural, not scope):** `invalidProvenance` returns `ConceptId[]`. It **structurally
cannot** express "*this rendering's* quote is ungrounded." A generated lesson body could be shown in
the UI, unsupported by any source, while every provenance test stayed green — a hole in the exact
claim the project rests on. See the CUT block in `src/types.ts` (2026-07-13).

**What it needs before it can return:** provenance validation that covers renderings with **typed
issue IDs** — i.e. `invalidProvenance` (or a sibling) must be able to return "rendering R of concept
C is ungrounded," not just "concept C is ungrounded." Until that per-rendering provenance gate
exists, renderings stay out. The UI marks the slot where a `Rendering[]` would attach.

## 2. Infinite / on-demand renderings

**What:** generate a lesson body on demand for a concept/format that has none yet.

**Why cut:** depends on (1), and on-demand generation is a request-time LLM call — which the core
thesis forbids on the request path. A future version would generate at build time and cache, or
generate into a re-validated provenance gate. Left as a marked extension point, never a stub that
pretends to work.

## 3. Atomicity scorer — seeded by `isSingleConcept`

**What:** a real atomicity judge that catches multi-concept nodes a syntactic rule cannot — e.g.
`"Scaled dot-product attention computes a weighted average."` (bundles scaling + dot product + softmax
+ weighted average in one un-coordinated noun phrase; the `it.skip` KNOWN-LIMIT case in
`invariants.test.ts`).

**Why it is a seed, not a leaf:** `isSingleConcept` was **kept but demoted** (2026-07-15) from a hard
proof-invariant to a build-time advisory enumeration reporter precisely so this capability has a home.
It never fails the build, never gates a phase, and is never presented as proof of atomicity — because
no offline syntactic rule can *prove* atomicity. The reporter (`src/graph/atomicity-report.ts`) is
built against an `AtomicityScorer` interface so richer scorers drop in behind the same contract:

- `embeddingAtomicityScorer` — cosine-distance clustering of the summary's noun phrases; a node whose
  phrases split into >1 cluster is likely non-atomic.
- `llmJudgeAtomicityScorer` — a **build-time** (never request-time) LLM judge scoring atomicity,
  used to catch the known-limit case above.

The MVP ships `syntacticAtomicityScorer`. The interface is the promise that the richer scorers slot in
with zero change to callers. This slot is the reason the invariant was demoted instead of cut.

## 4. Corpus manifest extension slots

Additive, non-breaking (`validateManifest` only *requires* `id`/`title`/`license`/`textPath`, so an
extra optional field never fails the gate). Do not build now; keep the seams:

- **Dedicated `revision` / `checksum` field** on `SourceManifestEntry`. For the MVP the pinned
  revision rides inside `url` (`?oldid=` / raw-SHA) and a `sha256` of the committed `.txt` is checked
  by `pnpm verify:corpus`. A future explicit field makes it first-class.
- **Explicit `author` / `attribution` field.** Currently derived from `title` + `url` + `license`.
- **Broader corpus.** The manifest is the single ingestion surface: adding sources post-hackathon is
  "append to `sources.json` + drop the `.txt`," no code change. Keep it that way.
- **`-NC` / other licences.** Excluded by decision, one line in `ALLOWED_LICENSES` to revisit — a
  deliberate future call, never a default. Widening the allowlist is a human act, never an autonomous
  workaround.

## 5. Deployment

A live URL (e.g. Vercel) is a backlog nice-to-have, **not** a submission gate. `done_means` requires a
public repo + README + demo video + Codex Session ID, not a deploy. Ship the deploy after submission if
time allows.

## 6. Provenance Unicode-hardening (NFKC + punctuation fold) — deferred, not dismissed

**What:** broaden `invalidProvenance`'s normalization beyond whitespace to also NFKC-normalize and fold
presentational punctuation (curly ↔ straight quotes, dash variants `‑`/`–`/`—`/`−`, NBSP, `·`/`×`/`→`
in symbol-dense math) before matching `quotedText` against `Source.text`.

**Why deferred (decision, 2026-07-15):** the MVP relies on the **extractive-copy rule** — the atomizer
slices `quotedText` out of the *stored* source bytes, so a quote is a substring of the very text it is
checked against and matches regardless of Unicode form. That structurally removes the false-fail
*without touching the invariant*. Broadening a pinned provenance invariant **loosens the exact claim the
project rests on**, so it must be a deliberate, adversarially-tested change — never a deadline patch.
Note NFKC alone does **not** convert curly→straight quotes (not a compatibility mapping); the quote/dash
fold is a separate, more aggressive custom normalization and needs its own justification.

**What it needs before it returns:** a dedicated adversarial test (curly-quote / dash / NBSP source vs
quote), an explicit decision on fold aggressiveness, and proof it never lets a genuinely-wrong quote
pass. Until then the standing defenses hold: **whitespace-only normalization + extractive copy +
prefer-prose-over-symbol-dense sources.**

---

**Load-bearing guarantees that survive every roadmap item:** manifest-only corpus reading;
fail-closed licence gate; quote-primary provenance with no request-time LLM; `LearningGraph.edges[]`
as the single source of truth. These are not conveniences to trade away for a feature.
