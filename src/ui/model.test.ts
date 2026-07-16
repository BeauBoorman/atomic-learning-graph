import { describe, expect, it } from "vitest";
import { loadGraph } from "../graph/load";
import { markUnderstood, pathFor, resolveLesson } from "./model";

const graph = loadGraph();

describe("UI learning model", () => {
  it("derives the visible route from getPath", () => {
    const path = pathFor(graph, []);
    expect(path[0]).toBe("vectors");
    expect(path.at(-1)).toBe(graph.goalId);
    expect(path).toContain("dot-product");
    expect(path).toContain("softmax");
    expect(path).toContain("qkv");
  });

  it("mark understood recomputes and advances the path without mutating the graph", () => {
    const original = JSON.stringify(graph);
    const current = pathFor(graph, [])[0];
    const next = markUnderstood(graph, [], current);

    expect(next.known).toEqual([current]);
    expect(next.path).not.toContain(current);
    expect(next.path[0]).not.toBe(current);
    expect(JSON.stringify(graph)).toBe(original);
  });

  it("renders lesson material from resolved, quote-primary provenance", () => {
    const lesson = resolveLesson(graph, graph.goalId);
    expect(lesson.source.id).toBe(lesson.concept.provenance.sourceId);
    expect(lesson.source.text).toContain(lesson.concept.provenance.quotedText);
    expect(lesson.context).toContain(lesson.concept.provenance.quotedText);
  });
});
