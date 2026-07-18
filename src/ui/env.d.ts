import type { CourseReceipt, LearningGraph, RenderingSet } from "../types";

declare global {
  const __LEARNING_GRAPH__: LearningGraph;
  const __RENDERINGS__: RenderingSet;
  const __COURSE_RECEIPT__: CourseReceipt;
}

export {};
