---
name: alg-ui
description: The reader UI for atomic-learning-graph — Vite + React + Cytoscape static app over the embedded graph, the no-request-time-LLM thesis, the two-layer defense (src/ui/gate9.test.ts source tripwire + scripts/verify-bundle.ts shipped-bytes scan), and the single-file offline build. Load when working on src/ui, adding a reader feature, debugging a verify:bundle failure, or changing the build config. Triggers "src/ui", "reader UI", "Vite", "Cytoscape", "gate9", "verify:bundle", "verify:single", "pnpm build", "shipped bytes", "no network at read time", "React reader".
---

# alg-ui — the offline reader

The reader is a static React app over the embedded `data/graph.json`. The thesis
(`alg-dev`) forbids any model call on the request path, and the enforcement boundary for
that claim is the BYTES SHIPPED TO THE BROWSER, not the source code. Two layers defend it.

## Read first

- `src/ui/gate9.test.ts` — the source-level tripwire (fast).
- `scripts/verify-bundle.ts` — the post-build shipped-bytes scan (slow, hard).
- `scripts/verify-single.ts` — asserts `dist-single/index.html` is one self-contained file.
- `src/graph/load.ts` — fail-closed loader. The reader reads the graph through this only.
- `src/graph/path.ts` — pure `getPath`. The reader calls this, never a model.

## Stack

- **Vite** — dev server (`pnpm dev`, but NEVER run in an agent — see `alg-dev`) and
  production build (`pnpm build`).
- **React 19** + **react-dom**.
- **Cytoscape** + **cytoscape-dagre** — the evidence map visualization.
- **KaTeX** — math rendering.
- **TypeScript** strict mode.

No backend. No service worker. No analytics. No remote assets. No fetch/XHR/WebSocket/
EventSource/sendBeacon. No `openai`-shaped token in the shipped bundle.

## Two-layer defense of the no-network claim

| Layer | Where | Speed | Boundary |
|---|---|---|---|
| **Source tripwire** | `src/ui/gate9.test.ts` | fast (part of `pnpm test`) | source files under `src/ui/` |
| **Shipped-bytes scan** | `scripts/verify-bundle.ts` | slow (post-`pnpm build`) | the emitted `dist/**/*.{js,mjs,cjs,html,css}` that a learner actually downloads |

The source tripwire gives a precise file-level failure during development. The shipped-bytes
scan is the actual claim — a `src/` boundary is not a browser boundary (Vite splits and
transforms code; runtime modules live outside `src/ui/`). The hard claim rests on the bytes
shipped, not the source.

## What verify-bundle.ts actually scans

After `pnpm build`, the scanner reads every `dist/**/*.{js,mjs,cjs,html,css}` file and
refuses to pass if it finds:

- a request client (`fetch(`)
- an XHR client (`XMLHttpRequest`)
- a socket client (`WebSocket`)
- an event-stream client (`EventSource`)
- a beacon client (`sendBeacon`)
- the model vendor (`openai`)
- a remote asset reference in HTML (`<link>`, `<script>`, `<img>`, `<iframe>`, `<audio>`,
  `<video>`, `<source>`, `<track>`, `<embed>`, `<input>` with `href`/`src`/`srcset`/`poster`
  pointing at `https?://` or protocol-relative `//`)

Forbidden signatures and the remote prefix are assembled from fragments so the scanner
itself does not contain the literal strings it looks for. This is deliberate: if `scripts/`
were accidentally added to the browser entry graph later, the scanner would not trip on its
own poison string.

The scanner also confirms that `llms.txt` and `llms-full.txt` are deployed into `dist/`
byte-equal to their repo-root sources, because the README links them at the GitHub Pages
root.

## When verify:bundle fails

Read the printed signature. Common causes:

- A new dependency that smuggles in a fetch client. Check `package.json` and what you
  imported.
- A remote asset reference in `index.html` or a component — an `<img src="https://…">`, a
  CSS `url(https://…)`, a font from a CDN. Inline the asset or remove it.
- A `fetch(` call you added for "just one quick thing." The thesis forbids it. Do not add
  it.
- A literal `openai` substring in a string somewhere. The scanner matches tokens; rename
  your variable.

The fix is NEVER to weaken the scanner. The scanner IS the claim. If you have a legitimate
false positive, add a `gitleaks:allow`-style reviewable exception — never silence by
removing the signature.

## Reader code structure

| File | Role |
|---|---|
| `src/ui/main.tsx` | React entry. Vite resolves this to `dist/index.html`. |
| `src/ui/App.tsx` | Top-level routing between Entry, LessonPage, CompletionPage. |
| `src/ui/Entry.tsx` | Goal selection; routes through `getPath`. |
| `src/ui/LessonPage.tsx` | One concept per page; analogies and "Try another way in" renderings. |
| `src/ui/Citation.tsx` | The highlighted source passage beside each lesson step. |
| `src/ui/GraphMap.tsx` | Cytoscape evidence-map view. |
| `src/ui/RenderingRoute.tsx` | Alternate renderings (`why-it-exists`, `how-it-works`) behind "Try another way in". |
| `src/ui/CostEstimatorCard.tsx` | Pure no-network estimator surfaced from `src/cost/estimator.ts`. |
| `src/ui/MathText.tsx` | KaTeX rendering. |
| `src/ui/model.ts` | The model the UI renders — derived from the loaded graph. |
| `src/ui/sourceProse.ts` | Resolves the source receipt for display. |
| `src/ui/titles.ts` | Display-layer editorial choices (e.g. sentence-case lesson titles). DELIBERATELY outside `data/graph.json` so editing display does not require re-atomizing. |
| `src/ui/styles.css` | All CSS. Theme tokens at `:root` and `:root[data-theme="…"]`. |

## "Mark understood → path advances" is a recompute, not an animation

The reader tracks which concepts the learner has marked understood. Path advancement is a
deterministic recompute of `getPath(graph, goalId, understood)` — never a hand-rolled state
machine. If you change this, the property to preserve is: same `goalId` + same
`understood` set yields the same route, on any machine, with the network unplugged.

## Local storage

The reader may use `localStorage` for the understood-set and theme. That is a client-side
UI preference; it is not a network call. The bundle scan does not flag `localStorage`.

## Single-file offline build

```bash
pnpm build:single    # vite build with vite.single.config.ts, then inline-single.ts
pnpm verify:single
```

Produces `dist-single/index.html` — one self-contained file with CSS and JavaScript
inlined. `verify:single` asserts exactly one HTML file with no resource references, no
network clients, and no model vendor. This is the artifact you can hand to someone on a
USB stick.

## When the build fails

Common causes:

- A new import that Vite cannot tree-shake and that pulls in a runtime fetch client. Check
  the dependency's source.
- A TypeScript error — `pnpm typecheck` (which the gate runs first) will catch this earlier.
- A path alias or asset import Vite does not understand. Use the existing patterns in
  `src/ui/`; do not invent a new resolution scheme.

## NEVER

- Add `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon` to a reader
  file. The thesis forbids it; the bundle scan will catch it; the claim on the README
  becomes false.
- Import the OpenAI SDK (or any model SDK) from a `src/ui/` file. Same reason.
- Add a remote asset reference to `index.html`. Inline instead.
- Run `pnpm dev` or `pnpm preview` in an agent. They never exit; they hang the session.
- Edit `data/graph.json` from the UI layer. The UI reads; it does not write.
