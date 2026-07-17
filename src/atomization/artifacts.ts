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

export function writeGraphArtifact(path: string, graph: LearningGraph): Buffer {
  const issues = invalidLessonCitations(graph);
  if (issues.length > 0) throw new InvalidGraphArtifactError(issues);
  const bytes = Buffer.from(`${JSON.stringify(graph, null, 2)}\n`, "utf8");
  writeFileSync(path, bytes);
  return bytes;
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

export function writeRenderingsArtifact(path: string, graph: LearningGraph, set: RenderingSet): Buffer {
  const issues = invalidRenderingCitations(graph, set);
  if (issues.length > 0) throw new InvalidRenderingArtifactError(issues);
  const bytes = Buffer.from(`${JSON.stringify(set, null, 2)}\n`, "utf8");
  writeFileSync(path, bytes);
  return bytes;
}
