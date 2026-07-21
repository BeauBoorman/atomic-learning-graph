# FIX-PLAN-v2 — executable runbook (never edits data/graph.json)

**2026-07-21.** Locked decision: **`data/graph.json` is never hand-edited.** The U+0003 byte in
`softmax-ordering` step 4 stays in the machine-generated graph (the honest record). It is normalized
out **only in derived exports**, because OPML/XML/Anki cannot legally carry a raw control char — that
is format normalization in export *code*, not editing the concept.

Remaining work = **3 edits + gate**. No model inference needed; `pnpm gate` exiting 0 is the proof.
Runnable by a DeepSeek/Grok fleet worker or via `!`.

## PRECONDITION (mandatory): stop every other agent/linter touching `scripts/emit-*.ts`
The tree is broken by a concurrent malformed edit; nothing converges while multiple writers race.
Stop the other editors, then run the steps below once, in order.

---

### Step 1 — repair the concurrent-writer breakage in `scripts/emit-orgroam.ts`
Another process added `stripControlChars(` in `renderSourceAttribution` without closing it.

- **Old:**
```
    `Modification notice: ${modificationNotice(source)}`,
  ].join("\n");
}
```
- **New:**
```
    `Modification notice: ${modificationNotice(source)}`,
  ].join("\n"));
}
```

### Step 2 — make the tinderbox test's escaper mirror the emitter (`scripts/emit-tinderbox.test.ts`)
The emitter strips C0 control chars from its output; the test-local `xmlEscaped` must too, so the
fidelity check compares against what a *valid* export actually contains. Use the shared helper.

**2a.** Add this import beside the other imports at the top of the file:
```
import { stripControlChars } from "./emit-utils";
```
**2b.** Replace the whole `xmlEscaped` function:
- **Old:**
```
function xmlEscaped(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r\n", "&#10;")
    .replaceAll("\r", "&#10;")
    .replaceAll("\n", "&#10;");
}
```
- **New:**
```
function xmlEscaped(value: string): string {
  return stripControlChars(
    value
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\r\n", "&#10;")
      .replaceAll("\r", "&#10;")
      .replaceAll("\n", "&#10;"),
  );
}
```

### Step 3 — builder run count (`builder/tests.mjs:443`) — ALREADY APPLIED
`assert.equal(environments.length, 3)` → `4` (packager gained the `emit-builder.mjs` step; all four
runs strip the key, so the security assertion is intact). Verify it still reads `4`.

### Already applied (keep): strip at the exported emit functions
`emitOrgRoamArtifact` and `emitTinderboxArtifact` returns are wrapped in `stripControlChars(...)`.

---

## Verify (the judge)
```
pnpm gate
```
Must exit 0. If green, commit. Do **not** regenerate exports or touch `data/graph.json`.
