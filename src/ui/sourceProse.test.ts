import { describe, expect, it } from "vitest";
import { loadGraph } from "../graph/load";
import { resolveCitation, resolveLesson } from "./model";
import { sourceProse } from "./sourceProse";

/** The REAL graph, not the fixture. The fixture's sources are hand-written prose with no
 *  markdown in them, so every assertion in this file passes VACUOUSLY against it while the
 *  shipped app renders "## Vectors" on page 1 of the default course. Guarding the fixture is
 *  how this bug survived a 116-green suite. */
const graph = loadGraph();

const steps = graph.concepts.flatMap((concept) =>
  (concept.lesson?.steps ?? []).map((_step, stepIndex) => ({ id: concept.id, stepIndex })),
);

/** Headings, d2l framework-tab markers, and the framework word a naive `:begin_tab:` regex
 *  leaves stranded as prose. That last alternative is the point: without it the sanitizer
 *  passes its own test while "pytorch" renders mid-sentence inside the source panel. */
const LEAK = /#{1,6}\s|:(?:begin|end)_tab:|\b(?:pytorch|mxnet|tensorflow|jax)\b/i;

describe("sourceProse — the d2l corpus preserves source LaTeX", () => {
  it("keeps every landed lesson quote byte-exact while preserving display-math newlines", () => {
    expect(steps.length).toBe(52);
    expect(graph.sources.some((source) => [...source.text.matchAll(/\n/g)].length > 1)).toBe(true);
    for (const concept of graph.concepts) {
      for (const step of concept.lesson?.steps ?? []) {
        const source = graph.sources.find(({ id }) => id === step.citation.sourceId);
        expect(source, `${concept.id} source`).toBeDefined();
        expect(
          Buffer.from(source?.text ?? "").includes(Buffer.from(step.citation.quotedText)),
          `${concept.id} quote is not a byte-exact source substring`,
        ).toBe(true);
      }
    }
  });

  it("leaks markdown into 4 of 52 rendered passages before sanitizing", () => {
    const leaking = steps.filter(({ id, stepIndex }) =>
      LEAK.test(resolveCitation(graph, id, stepIndex).passage),
    );
    expect(leaking).toHaveLength(4);
  });

  it("leaks nothing into any of the 52 after sanitizing", () => {
    for (const { id, stepIndex } of steps) {
      const { passage, quote } = resolveCitation(graph, id, stepIndex);
      expect(sourceProse(passage), `${id}:${stepIndex} passage`).not.toMatch(LEAK);
      expect(sourceProse(quote), `${id}:${stepIndex} quote`).not.toMatch(LEAK);
    }
  });

  // THE ASSERTION THAT MATTERS. Citation.tsx does passage.indexOf(quote) and returns bare text
  // with NO <mark> when it misses — silently, with no error. Sanitizing only the passage would
  // drop the highlight on matrix-vector-product, whose quotes contain "--", and the receipt
  // would render looking perfectly fine with nothing highlighted in it.
  it("keeps every quote findable inside its own passage, both sides through one function", () => {
    for (const { id, stepIndex } of steps) {
      const { passage, quote } = resolveCitation(graph, id, stepIndex);
      expect(
        sourceProse(passage).includes(sourceProse(quote)),
        `${id}:${stepIndex} lost its <mark>`,
      ).toBe(true);
    }
    for (const concept of graph.concepts) {
      const { passage, quote } = resolveLesson(graph, concept.id);
      expect(sourceProse(passage).includes(sourceProse(quote)), `${concept.id} provenance`).toBe(true);
    }
  });

  it("rewrites the corpus's -- only between word characters, symmetrically", () => {
    // Verified: 3 quotes carry "--" (matrix-vector-product steps 0 and 3, plus its concept
    // provenance). This CANNOT be fixed corpus-side — data/graph.json is byte-pinned by
    // graph-run.test.ts — so it has to be a symmetric render-time rewrite, which is precisely
    // why passage and quote go through ONE function rather than two.
    expect(sourceProse("Matrix--vector products")).toBe("Matrix—vector products");
    expect(sourceProse("a -- b")).toBe("a -- b");
    expect(sourceProse(":begin_tab:pytorch To express")).toBe("To express");
    expect(sourceProse(":end_tab: :begin_tab:mxnet Use mv")).toBe("Use mv");
    expect(sourceProse("## Vectors For current purposes")).toBe("Vectors For current purposes");
    expect(sourceProse("is performed. ## Visualization One")).toBe("is performed. Visualization One");
  });

  it("is idempotent, so applying it twice can never corrupt a passage", () => {
    // The display layer and model.ts are separate lanes; if both ever apply it, that must be a
    // no-op rather than a second pass eating something.
    for (const { id, stepIndex } of steps) {
      const once = sourceProse(resolveCitation(graph, id, stepIndex).passage);
      expect(sourceProse(once)).toBe(once);
    }
  });
});
