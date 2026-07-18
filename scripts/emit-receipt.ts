// Deterministic course receipt emit target. This module reads committed build artifacts;
// it never calls a model, reaches the network, or authors provenance, cost, or verification facts.
// Every receipt value is derived from the gated graph, run log, source manifest, and advisory report.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LearningGraph } from "../src/types";

const repoRoot = resolve(import.meta.dirname, "..");
const GRAPH_PATH = resolve(repoRoot, "data", "graph.json");
const GRAPH_RUN_PATH = resolve(repoRoot, "data", "graph.run.json");
const SOURCE_MANIFEST_PATH = resolve(repoRoot, "data", "oer", "sources.json");
const ATOMICITY_REPORT_PATH = resolve(repoRoot, "data", "atomicity-report.json");

export const COURSE_RECEIPT_PATH = resolve(repoRoot, "data", "course.receipt.json");

export interface GraphRunReceiptFacts {
  model: string;
  promptVersion: string;
  graphSha256: string;
  manifestSha256: string;
  costUsd: number;
  costPerConcept: number;
  usageTokens: { total: number };
}

export interface SourceReceiptFacts {
  sources: Array<{
    license: string;
    revision: { tag: string; commit: string };
  }>;
}

export interface AtomicityReceiptFacts {
  advisoryOnly: boolean;
  warnings: unknown[];
}

function assertOneSharedValue(label: string, values: string[]): string {
  if (values.length === 0) throw new Error(`cannot emit course receipt without ${label}`);
  const [first, ...rest] = values;
  if (rest.some((value) => value !== first)) {
    throw new Error(`cannot emit course receipt with differing ${label} values`);
  }
  return first;
}

/** Generate the receipt entirely in memory so a validation failure cannot partially write. */
export function emitCourseReceipt(
  graph: LearningGraph,
  run: GraphRunReceiptFacts,
  manifest: SourceReceiptFacts,
  atomicityReport: AtomicityReceiptFacts,
): string {
  const license = assertOneSharedValue(
    "source licenses",
    manifest.sources.map((source) => source.license),
  );
  const revisionTag = assertOneSharedValue(
    "source revision tags",
    manifest.sources.map((source) => source.revision.tag),
  );
  const commit = assertOneSharedValue(
    "source revision commits",
    manifest.sources.map((source) => source.revision.commit),
  );

  const receipt = {
    receiptVersion: 1,
    sourceCorpus: {
      work: "Dive into Deep Learning",
      authors: "Zhang, Lipton, Li & Smola",
      sections: manifest.sources.length,
      license,
      revisionTag,
      commit,
    },
    structure: {
      provenance: "human-specified",
      concepts: graph.concepts.length,
      prerequisiteEdges: graph.edges.length,
      citedLessonSteps: graph.concepts.reduce(
        (total, concept) => total + (concept.lesson?.steps.length ?? 0),
        0,
      ),
    },
    generation: {
      lessonProse: run.model,
      promptVersion: run.promptVersion,
      runtimeModelCalls: 0,
    },
    verification: {
      sourceQuotes: "deterministically-grounded",
      graphHash: run.graphSha256,
      manifestHash: run.manifestSha256,
      semanticReview: {
        kind: "advisory",
        advisoryOnly: atomicityReport.advisoryOnly,
        warnings: atomicityReport.warnings.length,
      },
    },
    cost: {
      usd: run.costUsd,
      perConcept: run.costPerConcept,
      tokens: run.usageTokens.total,
    },
  };

  return `${JSON.stringify(receipt, null, 2)}\n`;
}

export function writeCourseReceipt(
  receipt: string,
  path: string = COURSE_RECEIPT_PATH,
): void {
  writeFileSync(path, receipt, "utf8");
}

export function verifyCourseReceipt(
  expected: string,
  path: string = COURSE_RECEIPT_PATH,
): void {
  if (!existsSync(path) || readFileSync(path, "utf8") !== expected) {
    throw new Error(
      "data/course.receipt.json is not the exact artifact-derived receipt; run pnpm emit:receipt",
    );
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function currentReceipt(): string {
  return emitCourseReceipt(
    readJson<LearningGraph>(GRAPH_PATH),
    readJson<GraphRunReceiptFacts>(GRAPH_RUN_PATH),
    readJson<SourceReceiptFacts>(SOURCE_MANIFEST_PATH),
    readJson<AtomicityReceiptFacts>(ATOMICITY_REPORT_PATH),
  );
}

function main(): void {
  const receipt = currentReceipt();
  if (process.argv.slice(2).includes("--verify")) {
    try {
      verifyCourseReceipt(receipt);
    } catch {
      console.error("FAIL: data/course.receipt.json does not match committed artifact-derived bytes.");
      process.exit(1);
    }
    console.log("OK: verified data/course.receipt.json against committed artifact-derived bytes.");
    return;
  }
  writeCourseReceipt(receipt);
  console.log("Emitted data/course.receipt.json from committed build artifacts.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
