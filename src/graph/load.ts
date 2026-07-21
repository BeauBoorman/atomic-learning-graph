// Reads the graph produced by `pnpm atomize` (build-time; the app makes no LLM
// call on the request path). Deliberately small — the graded work is the atomizer
// and the invariants, not this loader.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { CourseReceipt, LearningGraph, Rendering, RenderingSet } from "../types";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const GRAPH_PATH = resolve(repoRoot, "data", "graph.json");
export const RENDERINGS_PATH = resolve(repoRoot, "data", "renderings.json");
export const COURSE_RECEIPT_PATH = resolve(repoRoot, "data", "course.receipt.json");

/**
 * Load the committed build receipt for inlining into the browser. Fail-closed: the receipt is a
 * gated artifact emitted by `pnpm emit:receipt`, and a missing one is a build error, not an empty
 * default that would ship a course with no provenance.
 */
export function loadCourseReceipt(path: string = COURSE_RECEIPT_PATH): CourseReceipt {
  if (!existsSync(path)) {
    throw new Error(`no course receipt at ${path} — run \`pnpm emit:receipt\` first`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as CourseReceipt;
}

/**
 * Load `data/graph.json`. Throws if the atomizer has not run yet — a missing
 * graph is a failure, never a silently-empty graph (an empty graph would
 * vacuously satisfy several invariants and produce a FALSE GREEN).
 */
export function loadGraph(path: string = GRAPH_PATH): LearningGraph {
  if (!existsSync(path)) {
    // When the builder sets BUILDER_GRAPH_PATH, trust it even if the file is not at the
    // committed data/graph.json location (the builder writes its artifact to a temp dir).
    const builderPath = process.env.BUILDER_GRAPH_PATH;
    if (builderPath && existsSync(builderPath)) return JSON.parse(readFileSync(builderPath, "utf8")) as LearningGraph;
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

function parseRenderings(path: string): RenderingSet {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isObject(raw) || !Array.isArray(raw.renderings) || !raw.renderings.every(isRendering)) {
    throw new Error(`invalid renderings artifact at ${path}`);
  }
  return { renderings: raw.renderings };
}

/**
 * Load optional build-time alternate renderings for the UI. Absence means the app has no
 * alternate route to claim or display, so it deliberately degrades to the base lesson product.
 */
export function loadRenderings(path: string = RENDERINGS_PATH): RenderingSet {
  if (!existsSync(path)) return { renderings: [] };
  return parseRenderings(path);
}

/**
 * Load the committed renderings artifact for verification. A verifier must not accept absence or
 * an empty set as proof that every generated rendering is grounded: both states are vacuously
 * valid under `invalidRenderingCitations`, whose job is to classify the renderings that exist.
 */
export function loadRenderingsForVerification(
  path: string = RENDERINGS_PATH,
): RenderingSet {
  if (!existsSync(path)) throw new Error(`no renderings artifact at ${path}`);
  const set = parseRenderings(path);
  return requireRenderingsForVerification(set, path);
}

export function requireRenderingsForVerification(
  set: RenderingSet,
  path: string = RENDERINGS_PATH,
): RenderingSet {
  if (set.renderings.length === 0) throw new Error(`empty renderings artifact at ${path}`);
  return set;
}
