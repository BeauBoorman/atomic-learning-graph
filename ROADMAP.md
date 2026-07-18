# ROADMAP: Atomic Learning Graph

This project ships a deliberately small, fully-honest MVP for OpenAI Build Week. It is built to be
**expanded** afterward. The guiding rule (Beau): **preserve every capability as a clearly-marked
slot; delete nothing to simplify.** Each item below was cut from the MVP *on purpose* for a
structural reason. Nothing was forgotten or stubbed to look done. The seams are real; the features
are future work.

Nothing here is a request-time LLM feature. The core invariant is permanent: **the AI builds the map
at build time; the map is not allowed to trust the AI at request time.** Every roadmap item must keep
that property.

---

## 1. `Rendering` / `RenderingFormat`: multi-format lesson bodies

**What:** per-concept lesson bodies in several formats ("90-second", "deep", "ELI5") instead of
rendering the lesson from the concept's own validated provenance.

**Why cut (structural, not scope):** `invalidProvenance` returns `ConceptId[]`. It **structurally
cannot** express "*this rendering's* quote is ungrounded." A generated lesson body could be shown in
the UI, unsupported by any source, while every provenance test stayed green. That would leave a hole
in the exact claim the project rests on. See the CUT block in `src/types.ts` (2026-07-13).

**What it needs before it can return:** provenance validation that covers renderings with **typed
issue IDs**. For example, `invalidProvenance` (or a sibling) must be able to return "rendering R of
concept C is ungrounded," not just "concept C is ungrounded." Until that per-rendering provenance gate
exists, renderings stay out. The UI marks the slot where a `Rendering[]` would attach.

## 2. Infinite / on-demand renderings

**What:** generate a lesson body on demand for a concept/format that has none yet.

**Why cut:** depends on (1), and on-demand generation is a request-time LLM call, which the core
thesis forbids on the request path. A future version would generate at build time and cache, or
generate into a re-validated provenance gate. Left as a marked extension point, never a stub that
pretends to work.

## 3. Atomicity scorer: seeded by `isSingleConcept`

**Status (2026-07-17): implemented as an opt-in build-time advisory.**

**What:** a real atomicity judge that catches multi-concept nodes a syntactic rule cannot. For
example, `"Scaled dot-product attention computes a weighted average."` bundles scaling, dot product,
softmax, and weighted average in one un-coordinated noun phrase. This is the `it.skip` KNOWN-LIMIT case
in `invariants.test.ts`.

**Why it is a seed, not a leaf:** `isSingleConcept` was **kept but demoted** (2026-07-15) from a hard
proof-invariant to a build-time advisory enumeration reporter precisely so this capability has a home.
It never fails the build, never gates a phase, and is never presented as proof of atomicity because
no offline syntactic rule can *prove* atomicity. The reporter (`src/graph/atomicity-report.ts`) is
built against an `AtomicityScorer` interface so richer scorers drop in behind the same contract:

- `embeddingAtomicityScorer`: cosine-distance clustering of the summary's noun phrases; a node whose
  phrases split into >1 cluster is likely non-atomic.
- `llmJudgeAtomicityScorer`: a **build-time** (never request-time) LLM judge scoring atomicity,
  used to catch the known-limit case above.

The default remains `syntacticAtomicityScorer`. `--atomicity-judge` adds the injected
`llmJudgeAtomicityScorer` pass and writes its findings to the same advisory report. Its strict
Responses API calls fail open on request, timeout, or parse errors, and the pass runs only after hard
graph and lesson convergence; it has no path into a build decision or exit code. The embedding scorer
remains future work.

## 4. Relationship topology: present in the contract, narrow in the demo

**What:** `LearningGraph.edges[]` carries three edge kinds: `prereq`, `method`, and `related`.
The raw `AtomizedConcept` contract requires a `related` array on every model-returned concept, and
the unpinned build path can convert those IDs into canonical `related` edges. The pinned product
artifact is narrower by specification: its full ten-concept spine contains nine `prereq` edges,
zero other links, and no concept has more than one incoming prerequisite.

**Why cut from the MVP:** reproducible demo structure won over relationship discovery. The product
relationship phase now receives and is projected onto the complete nine-edge spine, so the committed
artifact demonstrates a prerequisite tree, not a relationship mesh. The other edge kinds remain in
the graph contract for explicit unpinned experiments.

**What it needs before it can return:** a broader corpus and an unpinned build-time relationship run,
using the existing graph type and conversion step. That is an experiment, not a prediction: a later
run may still return no mesh, and only its committed, validated output can establish otherwise.

## 5. Corpus manifest extension slots

Additive, non-breaking (`validateManifest` only *requires* `id`/`title`/`license`/`textPath`, so an
extra optional field never fails the gate). Do not build now; keep the seams:

- **Dedicated `revision` / `checksum` field** on `SourceManifestEntry`. For the MVP the pinned
  revision rides inside `url` (`?oldid=` / raw-SHA) and a `sha256` of the committed `.txt` is checked
  by `pnpm verify:corpus`. A future explicit field makes it first-class.
- **Explicit `author` / `attribution` field.** Currently derived from `title` + `url` + `license`.
- **Broader corpus.** The manifest is the single ingestion surface: adding sources post-hackathon is
  "append to `sources.json` + drop the `.txt`," no code change. Keep it that way.
- **`-NC` / other licences.** Excluded by decision. Revisiting that decision takes one line in
  `ALLOWED_LICENSES`, but it remains a deliberate future call, never a default. Widening the
  allowlist is a human act, never an autonomous workaround.

## 6. Deployment

A live URL (e.g. Vercel) is a backlog nice-to-have, **not** a submission gate. `done_means` requires a
public repo + README + demo video + Codex Session ID, not a deploy. Ship the deploy after submission if
time allows.

## 7. Provenance Unicode-hardening (NFKC + punctuation fold): deferred, not dismissed

**What:** broaden `invalidProvenance`'s normalization beyond whitespace to also NFKC-normalize and fold
presentational punctuation (curly ↔ straight quotes, dash variants `‑`/`–`/`—`/`−`, NBSP, `·`/`×`/`→`
in symbol-dense math) before matching `quotedText` against `Source.text`.

**Why deferred (decision, 2026-07-15):** the MVP relies on the **extractive-copy rule**. The atomizer
slices `quotedText` out of the *stored* source bytes, so a quote is a substring of the very text it is
checked against and matches regardless of Unicode form. That structurally removes the false-fail
*without touching the invariant*. Broadening a pinned provenance invariant **loosens the exact claim
the project rests on**, so it must be a deliberate, adversarially-tested change, never a deadline patch.
Note NFKC alone does **not** convert curly→straight quotes (not a compatibility mapping); the quote/dash
fold is a separate, more aggressive custom normalization and needs its own justification.

**What it needs before it returns:** a dedicated adversarial test (curly-quote / dash / NBSP source vs
quote), an explicit decision on fold aggressiveness, and proof it never lets a genuinely-wrong quote
pass. Until then the standing defenses hold: **whitespace-only normalization + extractive copy +
prefer-prose-over-symbol-dense sources.**

---

# Expansion directions (net-new, invariant-preserving)

Sections 1–7 are capabilities **cut from the MVP on purpose**. The items below are the opposite:
net-new directions surfaced during delivery review. They are listed only because each can be built
**without ever trusting the model at request time** — the permanent invariant. None is claimed as
started; none is a stub.

## 8. Recall rubrics: a receipt for the *learner's* answer

**What:** a per-concept, build-time checklist ("a correct recall states X, Y, and Z"), every rubric
item byte-anchored to a specific source span and shipped inside the practice-exam artifact, so a
learner's free-recall answer becomes self-checkable deterministically — the answer earns a receipt the
same way every lesson sentence does.

**Why not now:** it needs the same per-item provenance gate as (1) — `invalidProvenance` must be able
to say "rubric item R of concept C is ungrounded," not just "concept C is ungrounded." Shipping a
rubric before that gate could let an ungrounded checklist item through. Depends on the typed-issue-ID
work in (1). Self-checking stays deterministic (string inclusion); no request-time model.

## 9. Deterministic review schedule + spaced-repetition handoff

**What:** compute an initial spaced-repetition schedule at build time (the FSRS/SM-2 update is pure
arithmetic, no model call) and ship it with the artifact; make "export to a spaced-repetition tool" a
first-class retention story. The Anki export already carries cited cards — retention is a **handoff**
to a proven external scheduler, not a forgetting-curve engine reimplemented in the reader.

**Why not now:** additive to the existing Anki export; a longitudinal "review over time" surface is out
of scope for a static, shareable artifact. Invariant holds trivially — scheduling is arithmetic and
review runs in the external tool, never in our reader.

## 10. Threshold-concept flags + warranted explorables

**What:** a build-time advisory (same family as the atomicity reporter, section 3) that marks the
pivotal, hard-to-cross "threshold" concepts, so the map can surface them and attach an interactive
explorable **only where content warrants** a manipulable widget — gated behind the reader's existing
predict-before-reveal step, never decorative.

**Why not now:** the flag is a fail-open advisory like (3) — no offline rule can *prove* which concept
is a threshold, so it never gates a build; and an interactive explorable still must not assert an
ungrounded claim, so it needs the per-rendering provenance gate from (1).

## 11. First-principles prerequisite-edge audit

**What:** a build-time advisory that asks whether each `prereq` edge is a true conceptual dependency
(what the idea logically requires) or merely source order, surfacing missing or spurious edges for
human review.

**Why not now:** it is an advisory judgment (fail-open, never a gate, like section 3), and the pinned
product is deliberately a narrow prereq tree (section 4); a richer dependency audit belongs with the
broader-corpus relationship experiment, not the MVP.

## 12. A named, non-circular safety property + versioned gold set

**What:** publish the project's safety property in one line — *no fabricated citation passes the
gates* — backed by a versioned adversarial gold set for each build-time judge (atomicity, dedup) and a
reported safety metric (tamper rejections, mutation-kill rate). The point of difference is stated
plainly: the checks are deterministic against a real CC-BY-SA source, so the validation is **not
circular** — no model grades its own output.

**Why not now (partly shipped):** the tamper gates and dedup mutation tests already exist; formalizing
a versioned gold set and a published safety report is additive hardening — and the dedup guard's
same-source case is still being closed before any "withstands N attacks" claim is made.

## 13. Focus mode (an honest accessibility profile)

**What:** an opt-in reader profile — one concept at a time, honest progress with no gamified streaks,
a gentle return after a break — surfacing the existing single-concept lesson flow as a deliberate
low-pressure mode.

**Why not now:** a client-side UI layer over the static artifact; additive, and the MVP ships the
default flow first. No request-time AI is involved.

## 14. Arbitrary user knowledge as input (vaults, LLM reports, research workflows)

**What:** accept a user's own corpus — a shared Obsidian-style vault, an LLM-generated report, a
researcher's working notes — and compile *their* library into one inspectable curriculum. This is the
multi-source direction the dedup engine already anticipates ("your library → one curriculum").

**Why not now:** two structural dependencies. (a) **Input parsing** — messy user markdown (math,
tables, wikilinks, frontmatter) must be parsed **in-process** (e.g. `remark`/`markdown-it`, no external
binary) to identify structure while preserving verbatim bytes for the receipt; a heavy external
converter (Pandoc, Apex) would fight reproducibility and muddy byte-exact provenance, so the transform
stays out of the trust path. (b) **Provenance semantics shift** — for a user's own text the receipt
anchors to *their* source, not an external authority: the byte-exact invariant still holds, but
"cited" now means "cited to your input," which must be stated plainly, never blurred into "cited to a
trusted source." This is also the input class that makes the same-source doctrine guard and the
math-mask chunker handling matter in practice, not just in theory.

---

**Load-bearing guarantees that survive every roadmap item:** manifest-only corpus reading;
fail-closed licence gate; quote-primary provenance with no request-time LLM; `LearningGraph.edges[]`
as the single source of truth. These are not conveniences to trade away for a feature.
