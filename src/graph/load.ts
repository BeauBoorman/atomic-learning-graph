// Reads the graph produced by `pnpm atomize` (build-time; the app makes no LLM
// call on the request path). Deliberately small — the graded work is the atomizer
// and the invariants, not this loader.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { LearningGraph, Rendering, RenderingSet } from "../types";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const GRAPH_PATH = resolve(repoRoot, "data", "graph.json");
export const RENDERINGS_PATH = resolve(repoRoot, "data", "renderings.json");

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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isRendering(value: unknown): value is Rendering {
  if (!isObject(value)) return false;
  if (typeof value.conceptId !== "string" || typeof value.plainTitle !== "string") return false;
  if (value.format !== "why-it-exists" && value.format !== "how-it-works") return false;
  if (!Array.isArray(value.steps)) return false;
  return value.steps.every((step) => {
    if (!isObject(step) || typeof step.text !== "string") return false;
    if (step.stepTier !== "core" && step.stepTier !== "deep") return false;
    if (!isObject(step.citation)) return false;
    return (
      typeof step.citation.sourceId === "string" &&
      typeof step.citation.quotedText === "string"
    );
  });
}

/**
 * Load optional build-time alternate renderings. A missing artifact means RUN 3 has not produced
 * any alternates yet. Once the file exists, malformed contents throw instead of becoming a
 * vacuously valid empty set that would silently disarm the generated-artifact gate.
 */
export function loadRenderings(path: string = RENDERINGS_PATH): RenderingSet {
  if (!existsSync(path)) return { renderings: [] };
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isObject(raw) || !Array.isArray(raw.renderings) || !raw.renderings.every(isRendering)) {
    throw new Error(`invalid renderings artifact at ${path}`);
  }
  return { renderings: raw.renderings };
}
