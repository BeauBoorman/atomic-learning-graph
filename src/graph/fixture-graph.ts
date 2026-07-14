// ⚠ THIS IS A TEST FIXTURE. IT IS NOT, AND MUST NEVER BECOME, `data/graph.json`.
//
// A hand-built 5-node graph so the invariant functions and the pathfinder can be tested WITHOUT
// an LLM. It is hand-authored on purpose and is labelled as such (ADR 001, rule 3). Copying this
// into `data/graph.json` would make the project's headline claim — "GPT-5.6 BUILT this graph" —
// false. `data/graph.json` is written ONLY by `pnpm atomize`.
//
// The fixture is deliberately a straight chain, so the golden ordered path is UNIQUE and a
// deep-equal assertion on it is meaningful:
//   vectors -> dot-product -> softmax -> qkv -> self-attention
//
// Note the whitespace trap in SOURCE_TEXT (a newline mid-sentence in the softmax sentence) which
// the softmax QUOTE renders with a single space. A byte-exact `source.text.includes(quote)` FAILS
// on that. Provenance matching MUST normalize whitespace first. That trap is the point: the
// whitespace false-fail looks exactly like hallucination, and is the most likely way the
// provenance invariant gets wrongly "fixed" by weakening it.

import type { Concept, LearningGraph } from "../types";

export const SOURCE_TEXT = [
  "A vector is an ordered list of numbers.",
  "The dot product multiplies two vectors elementwise and sums the result.",
  "Softmax turns a vector of scores into\na probability distribution that sums to one.",
  "Query, key and value are three learned projections of the same input.",
  "Self-attention scores every token against every other token.",
].join(" ");

export const QUOTES: Record<string, string> = {
  vectors: "A vector is an ordered list of numbers.",
  "dot-product": "The dot product multiplies two vectors elementwise and sums the result.",
  // Quoted with collapsed whitespace on purpose — the source has a newline inside it.
  softmax: "Softmax turns a vector of scores into a probability distribution that sums to one.",
  qkv: "Query, key and value are three learned projections of the same input.",
  "self-attention": "Self-attention scores every token against every other token.",
};

/** The demo's golden path, in order. `getPath(fixtureGraph, "self-attention")` must equal this. */
export const GOLDEN_PATH = [
  "vectors",
  "dot-product",
  "softmax",
  "qkv",
  "self-attention",
] as const;

export const fixtureGraph: LearningGraph = {
  goalId: "self-attention",
  sources: [
    { id: "s1", title: "How LLMs work (primer)", license: "CC-BY-SA-4.0", text: SOURCE_TEXT },
  ],
  concepts: GOLDEN_PATH.map(
    (id): Concept => ({
      id,
      title: id,
      summary: `single concept: ${id}`,
      provenance: { sourceId: "s1", quotedText: QUOTES[id] },
      tags: ["llm"],
    })
  ),
  edges: [
    { from: "vectors", to: "dot-product", type: "prereq" },
    { from: "dot-product", to: "softmax", type: "prereq" },
    { from: "softmax", to: "qkv", type: "prereq" },
    { from: "qkv", to: "self-attention", type: "prereq" },
  ],
};
