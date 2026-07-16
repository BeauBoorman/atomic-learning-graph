import type { Concept } from "../types";

/**
 * HUMAN-CURATED display titles. The MODEL wrote the CONTENT; a HUMAN chose the CASING.
 *
 * `data/graph.json` is byte-pinned to the atomizer run (`data/graph.run.json`, asserted by
 * `src/atomization/graph-run.test.ts`) and ADR-001 forbids hand-editing it: re-stamping the
 * hash after a hand-edit would make a run log carrying 23 real model response IDs certify
 * human prose as model output. So the casing fix lives here, in the display layer — in git,
 * reviewable, and superseded automatically when a future run emits sentence-case plainTitles.
 *
 * Sentence case, not Title Case: Title Case is the textbook table-of-contents register these
 * lessons are translating *away* from. The shipped artifact is inconsistent (8 of 10 Title
 * Case, 2 sentence case — including `self-attention`, the default goal and therefore the
 * pre-selected string in the app's only control). Ten explicit strings, never a mechanical
 * title-caser: that would mangle "Vectors as fixed-length lists".
 */
export const DISPLAY_TITLE: Record<string, string> = {
  "attention-pooling": "Using attention with any amount of data",
  "dot-product": "Multiply matching values, then add",
  "matrix-vector-product": "How a matrix changes a vector",
  "positional-encoding": "How a model keeps track of word order",
  "qkv": "How attention chooses and combines information",
  "self-attention": "How each word can use the whole sequence",
  "softmax": "Turning network scores into probabilities",
  "softmax-ordering": "The biggest input stays on top",
  "vector-norm": "Measuring a vector’s size",
  "vectors": "Vectors as fixed-length lists",
};

/**
 * The one name for each thing. Apply everywhere a concept is named — the entry goal list, the
 * lesson h1, and the map node label — so the map cannot say "Vectors" while the lesson says
 * "Vectors as Fixed-Length Lists".
 */
export const titleFor = (concept: Concept): string =>
  DISPLAY_TITLE[concept.id] ?? concept.lesson?.plainTitle ?? concept.title;
