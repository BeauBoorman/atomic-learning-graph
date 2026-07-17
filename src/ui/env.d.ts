import type { LearningGraph, RenderingSet } from "../types";

declare global {
  const __LEARNING_GRAPH__: LearningGraph;
  const __RENDERINGS__: RenderingSet;
}

export {};
