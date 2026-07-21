import type { Concept } from "../types";

/**
 * HUMAN-CURATED display titles. The MODEL wrote the CONTENT; a HUMAN chose the WORDS.
 *
 * Each title is a short noun phrase — the kind that reads cleanly as an h1, a route chip,
 * a map node label, a legend entry, and inside the self-explanation template
 * ("You just read 'Vectors'. Next is 'Dot product' — …"). Sentence-form titles
 * ("Multiply matching values, then add") forced every one of those surfaces into a
 * grammatical corner: the h1 read as body copy, the chip read as a sentence fragment,
 * and the self-explanation template interpolated prose into prose.
 *
 * The full plain-English definition still lives in the lesson text (`lesson.steps[].text`)
 * and in `concept.lesson.plainTitle`; the title here is the LABEL, not the definition.
 *
 * `data/graph.json` is byte-pinned to the atomizer run (`data/graph.run.json`, asserted by
 * `src/atomization/graph-run.test.ts`) and ADR-001 forbids hand-editing it, so the label
 * choice lives here in the display layer — in git, reviewable, and superseded automatically
 * when a future run ships a different `plainTitle` shape.
 *
 * Sentence case, not Title Case: "Dot product", not "Dot Product"; "Softmax and ordering",
 * not "Softmax And Ordering". A mechanical title-caser would mangle "Queries, keys, and
 * values" into "Queries, Keys, And Values". Ten explicit strings, never a transform.
 */
export const DISPLAY_TITLE: Record<string, string> = {
  "attention-pooling": "Attention pooling",
  "dot-product": "Dot product",
  "matrix-vector-product": "Matrix-vector product",
  "positional-encoding": "Positional encoding",
  "qkv": "Queries, keys, and values",
  "self-attention": "Self-attention",
  "softmax": "Softmax",
  "softmax-ordering": "Softmax and ordering",
  "vector-norm": "Vector norm",
  "vectors": "Vectors",
};

/**
 * The one name for each thing. Apply everywhere a concept is named — the entry goal list, the
 * lesson h1, and the map node label — so the map cannot say "Vectors" while the lesson says
 * "Vectors as Fixed-Length Lists".
 */
export const titleFor = (concept: Concept): string =>
  DISPLAY_TITLE[concept.id] ?? concept.lesson?.plainTitle ?? concept.title;
