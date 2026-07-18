import type { ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Deterministic client-side math rendering. KaTeX runs synchronously over committed text with no
// network and no model call, so the core read-time invariant is untouched. The corpus currently
// strips math at extraction; this renderer exists so re-pinned sources with real TeX arrive on a
// surface that already displays them.

const MATH_PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/gu;

// A single-dollar span renders ONLY when it carries a TeX-ish signal character. Prose with two
// prices ("$0.43 (~$0.043 per concept") pairs into a candidate span, and rendering it would
// mangle committed text — the exact thing this product must never do. Bare one-letter math like
// $x$ stays literal under this guard; revisit at re-pin if the corpus uses it.
const INLINE_TEX_SIGNAL = /[\\^_{}=]/u;

function renderTex(tex: string, displayMode: boolean): string | undefined {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: true });
  } catch {
    // Malformed TeX falls back to the literal committed text, never to broken markup.
    return undefined;
  }
}

/** Renders `text` with $inline$ and $$display$$ TeX spans typeset by KaTeX; plain text otherwise. */
export function MathText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MATH_PATTERN)) {
    const [raw, display, inline] = match;
    const index = match.index ?? 0;
    const displayMode = display !== undefined;
    const tex = displayMode ? display : inline;
    if (!displayMode && !INLINE_TEX_SIGNAL.test(tex)) continue;
    const rendered = renderTex(tex, displayMode);
    if (rendered === undefined) continue;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    nodes.push(
      // SAFE: the HTML is produced by katex.renderToString from committed text at render time;
      // no user-controlled markup passes through unescaped.
      <span
        key={`${index}:${raw.length}`}
        className={displayMode ? "math-display" : "math-inline"}
        dangerouslySetInnerHTML={{ __html: rendered }}
      />,
    );
    cursor = index + raw.length;
  }
  if (nodes.length === 0) return <>{text}</>;
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
