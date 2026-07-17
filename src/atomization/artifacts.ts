import { writeFileSync } from "node:fs";
import type { LearningGraph, RenderingSet } from "../types";
import {
  invalidLessonCitations,
  invalidRenderingCitations,
  type LessonCitationIssue,
  type RenderingCitationIssue,
} from "../graph/invariants";

export class InvalidGraphArtifactError extends Error {
  constructor(public readonly issues: LessonCitationIssue[]) {
    super(
      `refusing to write graph with invalid lesson citations: ${issues
        .map((issue) => `${issue.conceptId}[${issue.stepIndex}]:${issue.reason}`)
        .join(", ")}`,
    );
    this.name = "InvalidGraphArtifactError";
  }
}

export interface ArtifactWriteOptions {
  overwriteExisting?: boolean;
}

function writeBytes(
  path: string,
  bytes: Uint8Array,
  options: ArtifactWriteOptions = {},
): void {
  writeFileSync(path, bytes, { flag: options.overwriteExisting ? "w" : "wx" });
}

export function writeJsonArtifact(
  path: string,
  value: unknown,
  options: ArtifactWriteOptions = {},
): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  writeBytes(path, bytes, options);
  return bytes;
}

export function writeGraphArtifact(
  path: string,
  graph: LearningGraph,
  options: ArtifactWriteOptions = {},
): Buffer {
  const issues = invalidLessonCitations(graph);
  if (issues.length > 0) throw new InvalidGraphArtifactError(issues);
  return writeJsonArtifact(path, graph, options);
}

export class InvalidRenderingArtifactError extends Error {
  constructor(public readonly issues: RenderingCitationIssue[]) {
    super(
      `refusing to write renderings with invalid citations: ${issues
        .map((issue) =>
          `${issue.conceptId}:${issue.format}[${issue.stepIndex}]:${issue.reason}`,
        )
        .join(", ")}`,
    );
    this.name = "InvalidRenderingArtifactError";
  }
}

export function writeRenderingsArtifact(
  path: string,
  graph: LearningGraph,
  set: RenderingSet,
  options: ArtifactWriteOptions = {},
): Buffer {
  const issues = invalidRenderingCitations(graph, set);
  if (issues.length > 0) throw new InvalidRenderingArtifactError(issues);
  return writeJsonArtifact(path, set, options);
}
