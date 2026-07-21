# Hackathon Improvement Plan — Atomic Learning Graph

**Written:** 2026-07-21. **Status:** plan only, nothing implemented.
**Ground rules honored:** don't touch the gating design; don't hand-edit `data/graph.json`;
don't weaken tests; don't ship anything that breaks `pnpm gate`; no fake presentation — this
project wins on integrity, so every claim below is checkable against the repo.

**Budget reality:** ~5% Claude, 5 Grok credits, 0 DeepSeek. The atomizer/renderer run on
**GPT-5.6 (OpenAI)** — a provider **not in the stated budget**. That single fact reshapes the
whole plan: **Focus Area 2 (exports/builder) is zero-model-cost and where the safe, judge-visible
wins are. Focus Area 1 (prose) cannot be done cheaply or without integrity risk** and is treated
below as an explicit cost/risk decision, not a freebie.

---

## Focus Area 1 — Lesson prose quality

### The advisory mechanism (so we're honest about what "5 of 10" means)

- Metric: **Flesch-Kincaid grade** over the whole lesson (all `steps[].text` joined),
  `src/graph/readability.ts:40,51`.
- Thresholds (`readability.ts:3-4`): grade **≥10** → `confidence:"low"` advisory; grade **>16**
  → hard-floor build error. **No concept is near the hard floor.**
- Output: `data/atomicity-report.json` (misnamed for byte-pinning history; it holds readability
  advisories). **Advisory-only, never gates** — consistent with the AGENTS.md rule that advisory
  reporters must never be inflated to make a demo look stronger.

### The 5 flagged concepts (of 10)

| concept | FK grade | worst driver |
|---|---|---|
| `softmax-ordering` | 11.91 | `argmax` + subscript notation; **also carries a stray U+0003 control byte** in step 4 `text` |
| `positional-encoding` | 11.34 | grid/matrix jargon, stacked clauses |
| `vectors` | 11.11 | long clause-stacked example sentences |
| `self-attention` | 10.96 | subscript `xᵢ…`, rule `f`; **step 2 is the disclosed hand-patch `f65a0fb`** |
| `softmax` | 10.52 | `Σⱼ`, unexplained `exp`/`2.718` |

Grade ~10–12 is upper-high-school, not egregious. These are *advisories by design*, not defects.

### The hard constraint that governs this whole section

"Re-translate or polish the prose" **without hand-editing `graph.json`** means going through
`pnpm atomize`. But atomize is **whole-graph** (inventory→relationship→translation, frozen IDs;
`atomize.ts:1122,1384`); there is **no confirmed cheap per-concept re-translate path.** A re-run
therefore:
1. **Costs a full GPT-5.6 pass** (no OpenAI budget stated).
2. **Risks reintroducing the self-attention averaging bug** — the documented failure this repo
   already caught once (`PROVENANCE-PATCHES.md`, `f65a0fb`). Re-generating self-attention prose is
   exactly the step that produced the wrong worked example before.
3. **Re-stamps `graphSha256`** in `data/graph.run.json` + `data/course.receipt.json`, and could
   **regress the 5 currently-clean concepts.**

### Recommendation: **do NOT full-re-atomize for a 1–2 grade-level cosmetic gain.**

That is the integrity-first call. Instead, in priority order:

**Option A (recommended, $0, ship-safe): leave the prose, own the advisory on camera.**
The honest demo line is: *"5 of 10 lessons read at ~grade 11; the build flags that itself, as an
advisory, and refuses nothing — because inflating an advisory into a gate is the exact dishonesty
this project refuses."* That is a stronger integrity story than quietly polishing numbers.

**Option B (only if a translate-only re-run is confirmed + OpenAI budget exists): scoped
re-translation with a readability-tuned prompt, verified against the frozen inventory.**
Precondition to check first (no spend): does `atomize` support re-running the translation phase
against the committed inventory+edges so IDs/relationships/citations can't move? If **not**, Option
B is a full re-atomize and is **rejected** on risk #2 above. If yes, cost ≈ 1 translate call ×
10 concepts (see cost table). **Must** re-run `pnpm gate` and diff `graphSha256` provenance, and
**must not** touch self-attention step 2 (double-patch) or invent a license.

**Option C (rejected): hand-edit prose + re-stamp hashes** (the `f65a0fb` protocol). The task
forbids hand-editing `graph.json`, so this is off the table even though the protocol exists.

### Before → after targets (illustrative — what Option B's prompt should aim for, NOT text to paste)

These show the *readability target* (shorter sentences, notation named in words first). The actual
bytes must come from the atomizer, preserving each step's `quotedText`/`sourceId` unchanged.

**`softmax` — step 4** (`sourceId: d2l-softmax-regression`)
- before: *"Precisely, if o_i means score i, then its softmax result is ŷ_i = exp(o_i) ÷ Σ_j exp(o_j), where Σ_j means "add the transformed results for every score.""*
- after (target): *"Take each score and raise 2.718 to it — that's `exp`. Do this for every score. Each score's softmax value is its own `exp` divided by the sum of all of them, so the values add up to 1."*
- preserve: `quotedText = "$$\hat{\mathbf{y}} = \mathrm{softmax}(\mathbf{o}) \quad \textrm{where}\quad \hat{y}_i = \frac{\exp(o_i)}{\sum_j \exp(o_j)}.$$"`

**`vectors` — step 3** (`sourceId: d2l-linear-algebra`)
- before: *"Picture a vector as a card with labeled boxes: one box might hold income, another employment length, and another the number of earlier loan defaults."*
- after (target): *"Picture a vector as a labeled card. One box holds income. Another holds how long someone has worked. Another counts past missed loans. The card is the vector; each box is one number in it."*
- preserve: the loan-default `quotedText` span verbatim.

**`positional-encoding` — step 4** (`sourceId: d2l-self-attention`)
- before: *"Precisely, let X be the grid of token numbers and P be an equally shaped grid of position numbers. The model receives X + P, found by adding numbers in matching places."*
- after (target): *"Call the token numbers a grid, X. Build a second grid, P, the same size, with one number per position. The model reads the two grids added cell by cell: X + P."*
- preserve: the `\mathbf{X}+\mathbf{P}` matrix `quotedText`.

**`softmax-ordering` — step 4** carries a literal **U+0003** control byte before `ŷⱼ`. Whether to
strip it is a *separate deliberate decision* — it is a real byte in the shipped graph, so removing
it also re-stamps hashes and must be disclosed. Flag it; don't silently "clean" it.

### Verify after any prose change
`pnpm gate` (typecheck + 438 tests + verify:corpus + verify:anchors + build + verify:bundle) must
stay green; `git diff data/graph.run.json` should show only an intended, disclosed `graphSha256`
re-stamp; `verify:anchors` proves every `quotedText` still resolves verbatim.

---

## Focus Area 2 — Import / Export pipeline  *(the cheap, safe, high-ROI work)*

### Builder import flow (BYOK) — what it actually does and where it breaks

Flow (`builder/build-course.mjs`, `server.mjs`, `provider-fetch.mjs`, `public/index.html`):
user pastes source text (**min 12,000 chars**, `MINIMUM_TEXT_LENGTH`) + API key + provider
(`openai` / `anthropic` / `openai-compatible` w/ baseUrl) + model → builder writes the text + a
manifest → runs its own atomizer → packages an offline course.

**Real gaps, most important first:**
1. **License is hardcoded `CC0-1.0` on ANY pasted text** (`build-course.mjs:108`). The main
   atomizer fails closed via the `sources.json` allowlist; the builder does **not** — it stamps
   CC0 on whatever the user pastes. On an integrity project this is the sharpest edge. **Fix
   (cheap, no model calls):** require the user to *declare* a license in the builder UI and either
   (a) validate it against the same SPDX allowlist and refuse non-open input, or (b) if keeping
   "you attest you have the rights," label the output **"user-attested rights, not license-verified"**
   everywhere it appears — never silent CC0. Recommend (a) to keep one honest license story.
2. **The builder does NOT wire to the 6 exports** (grep confirms: no `emit-*` reference under
   `builder/`). The 6 exports run only off the committed repo `data/graph.json`. So "import a new
   source, then export to each format" is **not a connected path today.** **Fix:** after a builder
   course builds, run the 6 emitters against the *builder's* `graph.json` (they already take a graph
   + topo order; they are not hardcoded to concept IDs). This is the single change that makes the
   import→export story real. Zero model cost.
3. `emit-llms` reads **this repo's README** for its header (`emit-llms.ts:32,53`). A builder course
   has no such README, so llms export is repo-coupled. Minor; note it if demoing llms off a fresh
   import.

### Per-export demo checklist (all 6 read the graph + topo order; all fail closed on dup IDs / dangling edges / orphans)

| export | file / verify | 60-sec demo beat | edge cases to check |
|---|---|---|---|
| **Obsidian** | `exports/obsidian/`, `verify:obsidian` | **Highest visual ROI** — open the vault, show the graph view + "Start Here" prereq path + a concept note with its cited receipt | wikilink escaping on ids; `$…$` math renders in Obsidian natively (OK) |
| **Anki** | `…-anki.tsv`, `verify:anki` | **Highest tangible ROI** — File→Import the .tsv, show a card with **rendered MathJax** | `escapeAnkiField` handles `$$→\[\]`, `$→\(\)`, `&<>`, tab→`&#9;`, nl→`<br>` (robust). **U+0003 byte in softmax-ordering is NOT escaped** → could render as garbage on that card |
| **exam** | `…-exam.md`, `verify:exam` | printable grounded practice exam w/ recall rubric | same U+0003 byte passes through; markdown math renders in most viewers |
| **Tinderbox** | `…-.opml`, `verify:tinderbox` | one-shot OPML import → styled concept/source/edge map | **XML entity escaping IS correct** (`emit-tinderbox.ts:68-71`, incl. control-char → numeric entity). Note: the committed `.tbx` is a **convenience file not regenerated by the gate** (README:240) — demo the gate-verified `.opml`, call the `.tbx` what it is |
| **org-roam** | `…-.org`, `verify:orgroam` | niche; leads with same learning path | quote wrapping via `#+begin_quote`; `$…$` is native org LaTeX (OK) |
| **llms.txt** | `llms.txt`/`llms-full.txt`, `verify:llms` | conceptually strong ("paste the whole course into any AI"), not visual | header derived from repo README (see gap #3) |

**Demo ranking (60 s):** 1) Obsidian (visual graph), 2) Anki (tangible + live math), 3) exam.
Least: org-roam / llms.txt (not visual). **Riskiest on a fresh import:** the disconnect (gap #2) —
today a fresh import produces *no* exports at all; that's the thing to fix before demoing "import →
export."

### Recommended Focus-2 changes (all $0 model cost)
- **F2-a:** Wire the 6 emitters to run against a builder course's `graph.json` (makes import→export real).
- **F2-b:** Fix the builder license story (declare + validate, or relabel — no silent CC0).
- **F2-c:** Escape/strip the U+0003 control byte at emit time so Anki/exam render cleanly (emit-side
  only; **do not** hand-edit `graph.json`). Add a test asserting no C0 control chars in emitted fields.

### Verify after each Focus-2 change
Run the specific `verify:<format>` for the touched emitter, then full `pnpm gate`. For F2-a, build
one throwaway course and confirm all 6 `verify:*` pass against it. For F2-c, add the control-char
test to the existing emit tests so it can't regress.

---

## Estimated API cost

| Action | Provider | Est. cost | Notes |
|---|---|---|---|
| Focus 2 (a/b/c) — exports + builder | none | **$0** | pure code + tests; recommended first |
| Focus 1 Option A — own the advisory | none | **$0** | recommended |
| Focus 1 Option B — scoped re-translate (IF translate-only confirmed) | GPT-5.6 | ~1 translate call × 10 concepts ≈ the same order as one `pnpm render`/atomize translate pass — **billed to OpenAI, not in the stated budget** | gated on confirming a frozen-inventory re-run exists |
| Focus 1 full re-atomize | GPT-5.6 | full multi-phase run | **rejected** — averaging-bug + hash-churn risk |
| Grok / DeepSeek | — | unused | not on the atomizer's critical path; Grok only viable as an `openai-compatible` substitute, which would **change provenance** and must be disclosed — not recommended for the shipped graph |

---

## Order of operations

1. **F2-a** wire builder→6 exports (makes the import→export demo real). Verify each `verify:*` + gate.
2. **F2-b** builder license: declare+validate or relabel (kills the silent-CC0 integrity hole). Verify gate.
3. **F2-c** strip/escape U+0003 at emit + regression test. Verify `verify:anki`/`verify:exam` + gate.
4. **F1 decision:** default to **Option A** (own the advisory). Only pursue **Option B** if (a) a
   translate-only-against-frozen-inventory run is confirmed to exist **and** (b) OpenAI budget is
   available **and** (c) self-attention step 2 is left untouched. Verify gate + provenance diff.
5. Final full `pnpm gate` before any commit; nothing ships that turns it red.

**Bottom line:** the biggest honest wins are in Focus 2 and cost nothing — a real import→export
path and a closed license hole. The prose advisories are best *owned*, not quietly polished, unless
a genuinely cheap and risk-free re-translation path is confirmed first.
