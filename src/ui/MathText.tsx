import type { ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Deterministic client-side math rendering. KaTeX runs synchronously over committed text with no
// network and no model call, so the core read-time invariant is untouched. The committed corpus
// preserves source TeX, and this is the display-only surface that typesets those exact bytes.

const MATH_PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/gu;

// A single-dollar span renders when it is either a short math token (`x`, `d`, `\alpha`, optionally
// sub/superscripted) or contains an unambiguous TeX/operator signal. Reject digit-leading spans
// first: prose prices can pair across separate dollar signs ("$0.43 (~$0.043 per concept" or
// "$5 and $10"), and typesetting that accidental candidate would corrupt the displayed receipt.
const INLINE_TEX_SIGNAL = /[\\^_{}=+*/<>-]/u;
const SHORT_INLINE_MATH = /^(?:[A-Za-z]{1,3}|\\[A-Za-z]+)(?:[_^](?:[A-Za-z0-9]|\\[A-Za-z]+|\{[^{}\s]+\}))*$/u;

function shouldRenderInlineTex(tex: string): boolean {
  const trimmed = tex.trim();
  if (/^\d/u.test(trimmed)) return false;
  return SHORT_INLINE_MATH.test(trimmed) || INLINE_TEX_SIGNAL.test(trimmed);
}

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
    if (!displayMode && !shouldRenderInlineTex(tex)) continue;
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
