import { writeFileSync } from "node:fs";
import type { LearningGraph } from "../types";
import { invalidLessonCitations, type LessonCitationIssue } from "../graph/invariants";

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
