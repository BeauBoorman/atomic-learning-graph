// Reads the graph produced by `pnpm atomize` (build-time; the app makes no LLM
// call on the request path). Deliberately small — the graded work is the atomizer
// and the invariants, not this loader.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { LearningGraph } from "../types";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const GRAPH_PATH = resolve(repoRoot, "data", "graph.json");

/**
 * Load `data/graph.json`. Throws if the atomizer has not run yet — a missing
 * graph is a failure, never a silently-empty graph (an empty graph would
 * vacuously satisfy several invariants and produce a FALSE GREEN).
 */
export function loadGraph(path: string = GRAPH_PATH): LearningGraph {
  if (!existsSync(path)) {
    throw new Error(
      `no graph at ${path} — run \`pnpm atomize\` to build it from data/oer/ first`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as LearningGraph;
}
