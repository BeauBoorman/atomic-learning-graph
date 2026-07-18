import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type {
  AlternateFormat,
  LearningGraph,
  Rendering,
  RenderingSet,
} from "../types";
import { invalidRenderingCitations } from "../graph/invariants";
import { loadGraph } from "../graph/load";
import { writeRenderingsArtifact } from "./artifacts";
import { ResponsesClient } from "./client";
import { OER_DIR } from "./manifest";
import {
  lessonSchema,
  parseLesson,
  renderInstructions,
  snapLesson,
  sourceForConcept,
  translationInput,
  type TranslationClient,
  type TranslationRequestOptions,
} from "./translate";

export const RENDERING_PROMPT_VERSION = "renderings-v2-one-claim-per-step";
export const RENDERINGS_PATH = resolve(OER_DIR, "..", "renderings.json");
export const RENDERINGS_RUN_PATH = resolve(OER_DIR, "..", "renderings.run.json");

const ALTERNATE_FORMATS = ["why-it-exists", "how-it-works"] as const;
const requestOptions: TranslationRequestOptions = {
  forceStrict: true,
  maxOutputTokens: 3000,
};

export type RenderingClient = TranslationClient;

function candidateFromLesson(
  conceptId: string,
  format: AlternateFormat,
  lesson: ReturnType<typeof parseLesson>,
): Rendering {
  return {
    conceptId,
    format,
    plainTitle: lesson.plainTitle,
    steps: lesson.steps,
  };
}

/**
 * Generate optional question-specific routes without manufacturing a fallback. Invalid cited steps
 * are dropped; if fewer than two grounded steps remain, the entire rendering is dropped.
 */
export async function generateRenderings(
  graph: LearningGraph,
  client: RenderingClient,
  onWarning: (message: string) => void = (message) => console.warn(message),
): Promise<RenderingSet> {
  const renderings: Rendering[] = [];

  for (const concept of graph.concepts) {
    for (const format of ALTERNATE_FORMATS) {
      try {
        const source = sourceForConcept(graph, concept);
        // The alternate question may be answered by a span outside the original what-it-is anchor.
        // Supplying the complete licensed source keeps question, not context truncation, as the axis.
        const raw = await client.request(
          renderInstructions(format),
          translationInput(concept, source, source.text),
          lessonSchema,
          `rendering_${format}`,
          requestOptions,
        );
        let candidate = candidateFromLesson(
          concept.id,
          format,
          snapLesson(parseLesson(raw), source),
        );

        const citationIssues = invalidRenderingCitations(graph, { renderings: [candidate] });
        const invalidStepIndices = new Set(
          citationIssues.filter(({ stepIndex }) => stepIndex >= 0).map(({ stepIndex }) => stepIndex),
        );
        if (invalidStepIndices.size > 0) {
          onWarning(
            `Rendering ${concept.id}:${format} dropped ${invalidStepIndices.size} ungrounded step(s)`,
          );
          candidate = {
            ...candidate,
            steps: candidate.steps.filter((_step, stepIndex) => !invalidStepIndices.has(stepIndex)),
          };
        }

        const remainingIssues = invalidRenderingCitations(graph, { renderings: [candidate] });
        if (remainingIssues.length > 0) {
          onWarning(
            `Rendering ${concept.id}:${format} dropped: ${remainingIssues
              .map(({ stepIndex, reason }) => `[${stepIndex}]:${reason}`)
              .join(", ")}`,
          );
          continue;
        }
        renderings.push(candidate);
      } catch (error) {
        onWarning(`Rendering ${concept.id}:${format} omitted: ${String(error)}`);
      }
    }
  }

  return { renderings };
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function printResultTable(
  graph: LearningGraph,
  set: RenderingSet,
  log: (message: string) => void,
): void {
  const kept = new Set(set.renderings.map(({ conceptId, format }) => `${conceptId}\0${format}`));
  log("CONCEPT\tFORMAT\tRESULT");
  for (const concept of graph.concepts) {
    for (const format of ALTERNATE_FORMATS) {
      log(`${concept.id}\t${format}\t${kept.has(`${concept.id}\0${format}`) ? "PASS" : "DROP"}`);
    }
  }
}

export interface RenderingRunMetadata {
  model: string;
  strictStructuredOutputs: boolean;
  responseIds: readonly string[];
  omitResponseIds?: boolean;
}

export interface RenderingArtifactPaths {
  renderings: string;
  runLog: string;
}

/**
 * The one paid rendering path. It generates exactly one candidate set, validates and writes that
 * exact set, then prints its verdict table. Printing after both writes means a visible table is
 * evidence about the artifact that landed, never about a discarded or later-regenerated run.
 */
export async function generateAndWriteRenderings(
  graph: LearningGraph,
  client: RenderingClient,
  metadata: RenderingRunMetadata,
  paths: RenderingArtifactPaths = {
    renderings: RENDERINGS_PATH,
    runLog: RENDERINGS_RUN_PATH,
  },
  onWarning: (message: string) => void = (message) => console.warn(message),
  log: (message: string) => void = (message) => console.log(message),
): Promise<RenderingSet> {
  const set = await generateRenderings(graph, client, onWarning);
  const renderingBytes = writeRenderingsArtifact(paths.renderings, graph, set, {
    overwriteExisting: true,
  });
  const runLog = {
    model: metadata.model,
    renderingPromptVersion: RENDERING_PROMPT_VERSION,
    strictStructuredOutputs: metadata.strictStructuredOutputs,
    renderingsSha256: sha256(renderingBytes),
    ...(metadata.omitResponseIds ? {} : { responseIds: metadata.responseIds }),
  };
  writeFileSync(paths.runLog, `${JSON.stringify(runLog, null, 2)}\n`);

  printResultTable(graph, set, log);
  log(`RENDERING PASS: wrote ${set.renderings.length} alternate renderings.`);
  return set;
}

export interface RenderOptions {
  omitResponseIds: boolean;
}

export function parseRenderArgs(args: readonly string[]): RenderOptions {
  let omitResponseIds = false;
  for (const arg of args) {
    if (arg === "--no-response-ids") omitResponseIds = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return { omitResponseIds };
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const options = parseRenderArgs(args);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for build-time rendering generation");

  const client = new ResponsesClient(apiKey);
  await client.initialize();
  const graph = loadGraph();
  await generateAndWriteRenderings(graph, client, {
    model: client.modelSnapshot || client.model,
    strictStructuredOutputs: client.strictSchema,
    responseIds: client.responseIds,
    omitResponseIds: options.omitResponseIds,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
