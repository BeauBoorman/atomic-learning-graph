---
name: alg-audit
description: Security and history audit for atomic-learning-graph — the five-scenario tamper demo (pnpm demo:tamper), the gitleaks routine over working tree and full history, and the git-filter-repo recipe for stripping Claude-Session / Co-Authored-By trailers before public publishing. Load before a public milestone, when investigating a suspected secret, before history rewriting, or when claiming "no fabricated citation passes the gates." Triggers "pnpm demo:tamper", "tamper demo", "gitleaks", "history rewrite", "git-filter-repo", "Claude-Session", "Co-Authored-By", "AI trailers", "publish public", "pre-public audit", "secret in history", "rotate credential".
---

# alg-audit — security and history cleanliness

The repo's headline safety property is **no fabricated citation passes the gates**. This
skill covers the three audit surfaces that keep that claim honest: the deterministic tamper
demo, the gitleaks routine, and the pre-publish history rewrite.

## Read first

- `src/graph/invariants.ts` docstrings — the 6 hard invariants.
- `scripts/demo-tamper.ts` — the five-scenario demo harness.
- The gitleaks routine below — run it from this repository, not from a harness-specific home.
- The "How this was built with Codex" section of `README.md` — names the five tamper
  scenarios on camera.

## The five-scenario tamper demo

```bash
pnpm demo:tamper
```

`scripts/demo-tamper.ts` runs five in-memory tamper attacks against the production gates.
Each one names the cheating implementation it exists to kill. All five MUST be rejected
(5 / 5).

| # | Scenario | What it simulates | The gate that catches it |
|---|---|---|---|
| 1 | EMPTY-GRAPH STUB | a `() => []` atomizer that writes nothing | structural invariants refuse an empty graph |
| 2 | HARD-CODED GOLDEN PATH | a hand-coded route that bypasses `getPath` | `pathExists` is a reachability check, not a string match |
| 3 | SUBSTRING-FAKED CITATION | a `" and "` substring shortcut pretending to be a quote | `invalidProvenance` requires a substantial content-bearing span, not a conjunction |
| 4 | FIRST-MATCH SOURCE LOOKUP | a `sources.find()` that returns the first plausible source | `invalidProvenance` requires resolution to EXACTLY ONE source, not "at least one" |
| 5 | HAND-EDITED GRAPH.JSON | a hand-patched `data/graph.json` that pretends to be generated | `data/graph.run.json`'s sha256 is recomputed by `src/atomization/graph-run.test.ts` |

The harness inspects only in-memory clones. The production gates inspect only in-memory
clones. A tamper scenario that mutates the committed `data/graph.json` would still fail
the suite on the next `pnpm test` because the sha256 would not match the run log.

## Claiming the safety property on camera

The README states the property as: **no fabricated citation passes the gates — five tamper
scenarios are all rejected (5 / 5), and every lesson step's cited source excerpt is checked
byte-for-byte against the real source.** Then it states the distinction from a live-AI
tutor: the proof rests on deterministic checks against a real CC-BY-SA source, not on a
model grading its own output.

When you demonstrate this on camera:

1. Run `pnpm demo:tamper`. Show 5 / 5 defended.
2. Run `pnpm gate`. Show all stages green.
3. Open the reader. Click a lesson step. Show the highlighted source passage beside it.
4. State plainly: this is deterministic, against a real source, at read time, with no
   model judging itself.

Do NOT present `isSingleConcept` as proof of atomicity. It is advisory only.

## gitleaks routine

Use gitleaks v8 or later. The v8 API note: `gitleaks protect` is GONE; the invocation is now
`gitleaks git --staged` for the pre-commit hook.

### Scanning this repo

```bash
# working tree (ignores git)
gitleaks dir . --redact --no-banner --verbose

# full history (all branches, all commits)
gitleaks git . --redact --no-banner

# what the pre-commit hook runs
gitleaks git --staged --redact --no-banner --verbose
```

Always `--redact`. Without it, gitleaks prints any secret it finds into the terminal and
session log — which is itself a leak.

### Recording a verified state

Do not preserve a static clean-scan count in this skill: history changes. For a publish
decision, run the commands above on the branch and commit range to be published, then record
the date, commit SHA, command, and redacted output in the release evidence.

If a scan returns a finding:

1. **Do NOT auto-commit a fix.** Flag to Beau.
2. If the secret is real and pushed → ROTATE the credential. Scrubbing history is not
   enough; assume it is burned the moment it hit a remote.
3. If the secret is in the working tree, untracked or tracked-but-not-pushed → remove it,
   then audit whether it ever entered history.
4. Beau decides whether the history rewrite is worth the disruption.

### False positives are real

gitleaks allowlists well-known documentation example keys. `AKIAIOSFODNN7EXAMPLE` (AWS's
own docs key) will NOT be flagged. Never validate the hook with a documentation canary —
you will get a false "the hook is broken" result. Use a realistic high-entropy fake.

### Reviewable exceptions

If a finding is a verified false positive, prefer a `.gitleaks.toml` allowlist rule or a
`gitleaks:allow` line comment. `--no-verify` exists but leaves no trace; do not use it
casually.

## Pre-publish history rewrite (AI trailers)

Before considering a rewrite, count the matching `Claude-Session:` and AI
`Co-Authored-By:` trailers on the exact branch history to be published. They are accurate
history but may not be suitable to publish. The rewrite is a separate, deliberate,
force-push operation gated on Beau's explicit call.

### Tool

`git-filter-repo`. Install via `pipx install git-filter-repo` or `brew install git-filter-repo`.

### Recipe (do not run autonomously)

```bash
# 1. Confirm Beau has explicitly approved the rewrite.
# 2. Make a backup: git clone --mirror <repo> alg-backup.git
# 3. Write the trailer patterns to strip to /tmp/ai-trailers.txt:
#    ^Claude-Session:.*
#    ^Co-Authored-By:.*Claude.*
#    ^Co-Authored-By:.*OpenAI.*
#    (be specific; do not strip human Co-Authored-By lines)
# 4. Run:
git filter-repo --message-callback '
import re
with open("/tmp/ai-trailers.txt") as f:
    patterns = [re.compile(line.strip()) for line in f if line.strip()]
return b"\n".join(
    line for line in message.split(b"\n")
    if not any(p.search(line.decode("utf-8", "replace")) for p in patterns)
)
'
# 5. Re-audit with gitleaks (above) and pnpm gate.
# 6. Force-push ONLY with explicit confirmation:
#    git push --force-with-lease origin <branch>
```

### What this does NOT fix

- API response IDs in `data/graph.run.json`. Those are not credentials; whether they
  should ship is Beau's call (the AGENTS.md "secret + history audit" item).
- The `todo.taskpaper` candid internal notes. Those ride in the working tree, not in
  history.
- Anything else the public-readiness sweep flagged.

### After the rewrite

1. Re-run gitleaks over the new history.
2. Re-run `pnpm gate`.
3. Confirm the README and AGENTS.md still describe the build process accurately.
4. Tell everyone with a local clone to re-clone or `git pull --rebase` — the rewrite
   changes every commit SHA.

## NEVER

- Auto-commit a secret fix. Flag to Beau.
- Force-push without Beau's explicit confirmation.
- Run a history rewrite on the main branch from an agent session. It is a one-shot,
  human-gated operation.
- Skip the gitleaks scan before claiming the repo is publishable.
- Present `isSingleConcept` as proof of atomicity on camera. It is advisory.
