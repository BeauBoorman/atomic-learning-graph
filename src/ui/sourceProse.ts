/** DISPLAY LAYER. Nothing here touches `data/graph.json`, which is byte-pinned to the
 *  atomizer run (graph.run.json / graph-run.test.ts) and is forbidden to hand-edit by
 *  ADR-001. The quotes are already verbatim-correct against the pinned corpus; what is
 *  wrong is that the corpus is raw markdown and we were rendering it raw.
 *
 *  ROOT CAUSE (verified, and it is the opposite of what it looks like): every source in
 *  data/graph.json holds exactly ONE newline across 7.6k-20k chars — the corpus extractor
 *  flattened the markdown. So sentenceAround()'s "\n" boundary (model.ts:144/146) is dead
 *  code returning -1, the winning boundary is lastIndexOf(". "), and the slice therefore
 *  begins exactly at "## Vectors". Honouring "\n" is what would PREVENT this.
 *
 *  MUST be applied to the quote as well as the passage. Citation.tsx does
 *  passage.indexOf(quote); rewriting only the passage silently drops <mark> — no error,
 *  no warning, just a receipt with nothing highlighted. The "--" rewrite is why: it
 *  cannot be done corpus-side (3 quotes contain "--"), so it has to be a symmetric
 *  render-time normalisation, which is exactly why both sides go through ONE function.
 *
 *  Verified first-party against data/graph.json (not the fixture) — see sourceProse.test.ts:
 *  7/31 passages leak before, 0/31 after, and all 31 quotes still resolve inside their
 *  passage afterwards.
 */
export function sourceProse(text: string): string {
  return text
    .replace(/:(?:begin|end)_tab:\w*/g, " ") // \w* eats the "pytorch"/"mxnet" suffix
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s#{1,6}\s+(?=[A-Z])/g, " ")
    .replace(/(\w)--(\w)/g, "$1—$2")
    .replace(/\s{2,}/g, " ")
    .trim();
}
