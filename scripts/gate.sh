#!/usr/bin/env bash
#
# Acceptance gate — the AGENTS.md "Acceptance bar" as ONE command.
#
#   exit 0 = shippable.  exit 1 = not.  No judgement calls, no reading five bullets.
#
# Design notes:
#
#   * Every stage runs even if an earlier one fails, then we report a summary.
#     A gate that bails on the first failure hides the other evidence and turns
#     debugging into whack-a-mole.
#   * Hermetic by default: every stage runs offline from a clean clone. Corpus
#     hashes and data/graph.json are committed. Set VERIFY_UPSTREAM=1 to make
#     the corpus stage additionally re-fetch and compare the pinned sources.
#
# What this gate does NOT prove (be honest about the boundary):
#
#   * `pnpm atomize` is deliberately NOT run here — it needs a live model key,
#     costs money, and is non-deterministic. Its fail-closed behaviour on a
#     missing/non-open license and on invalid provenance is pinned by unit tests
#     instead (src/atomization/*.test.ts).
#   * A green gate means the committed graph, corpus, and UI hold their
#     invariants. It does not mean the graph was regenerated today.
#
set -uo pipefail
cd "$(dirname "$0")/.."

failed=""
fail_count=0

run() {
  name="$1"
  shift
  printf '\n==> %s\n' "$name"
  if "$@"; then
    printf '    OK    %s\n' "$name"
  else
    printf '    FAIL  %s\n' "$name"
    failed="${failed}  - ${name}"$'\n'
    fail_count=$((fail_count + 1))
  fi
}

printf 'Acceptance gate — atomic-learning-graph\n'

# Bar: `pnpm typecheck` exits 0.
run "typecheck" pnpm typecheck

# Bar: `pnpm test` passes — including every adversarial/negative test —
# against the committed data/graph.json. This also covers:
#   - getPath golden path on the generated graph (src/graph/path.test.ts)
#   - fast source-level rejection of request-time network/model clients (src/ui/gate9.test.ts)
#   - atomizer fail-closed on license/provenance (src/atomization/*.test.ts)
run "tests (incl. adversarial, vs committed data/graph.json)" pnpm test

# The optional local builder has its own Node test harness and package boundary. It handles keys
# and invokes the atomizer, so a root-only Vitest pass cannot stand in for it.
run "builder tests (key handling, provider seams, packaging)" pnpm --dir builder test

# Provenance + license integrity of the committed corpus.
run "corpus integrity (license allowlist + stored text)" pnpm verify:corpus
run "golden anchors (quoted text still resolves)" pnpm verify:anchors
run "llms artifacts match committed graph-derived bytes" pnpm verify:llms
run "org-roam artifact matches committed graph-derived bytes" pnpm verify:orgroam
run "Tinderbox artifact matches committed graph-derived bytes" pnpm verify:tinderbox
run "Anki deck matches committed graph-derived bytes" pnpm verify:anki
run "Obsidian vault matches committed graph-derived bytes" pnpm verify:obsidian
run "practice exam matches committed graph-derived bytes" pnpm verify:exam
run "course receipt matches committed artifacts" pnpm verify:receipt
run "optional export showcase matches generated presentation bytes" pnpm verify:showcase

# It has to actually build.
run "build" pnpm build

# The browser claim rests on the emitted bytes, including runtime modules outside src/ui and any
# chunks Vite creates. This is deliberately a hard, post-build stage; gate9 remains the fast twin.
run "shipped bundle has no network/model client or remote asset" pnpm verify:bundle

# Additive hand-a-human packaging target. This rebuilds into dist-single/ with a relative base,
# inlines the emitted CSS and JavaScript, then proves index.html is the only remaining artifact.
run "standalone HTML is one self-contained offline file" pnpm verify:single

printf '\n'
if [ "$fail_count" -eq 0 ]; then
  printf 'ACCEPTANCE GATE PASSED\n'
  exit 0
fi

printf 'ACCEPTANCE GATE FAILED (%s stage(s)):\n%s' "$fail_count" "$failed"
exit 1
