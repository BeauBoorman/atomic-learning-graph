import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadGraph } from "../graph/load";
import { courseKey } from "./App";
import { Entry } from "./Entry";
import { knownForGoal } from "./model";

const graph = loadGraph();
const noop = () => undefined;

function markupWith(resumePageCount: number): string {
  return renderToStaticMarkup(
    <Entry
      graph={graph}
      goalId={graph.goalId}
      depth="quick"
      known={[]}
      onGoalChange={noop}
      onDepthChange={noop}
      onKnownChange={noop}
      onPassionChange={noop}
      onStart={noop}
      onStartFresh={noop}
      resumePageCount={resumePageCount}
    />,
  );
}

describe("Entry resume affordance", () => {
  it("offers a fresh start by default", () => {
    const markup = markupWith(0);
    expect(markup).toContain("Start learning");
    expect(markup).not.toContain("Continue where I left off");
  });

  it("surfaces stored progress instead of silently resuming mid-course", () => {
    // The historic failure: a machine with old progress opened the judge's "first" lesson at
    // page N (or the completion screen) with zero indication why. The entry screen must SAY it.
    const markup = markupWith(3);
    expect(markup).toContain("Continue where I left off");
    expect(markup).toContain("3 pages");
    expect(markup).toContain("Start from the beginning instead");
    expect(markup).not.toContain(">Start learning<");
  });
});

describe("declaration relevance and course identity", () => {
  it("an irrelevant declaration cannot fork a course key", () => {
    // The raw declaration persists across goal flips; course identity uses only the subset the
    // goal cares about. A declaration no goal cares about must land on the SAME storage key.
    const goal = graph.goalId;
    const nonPrereq = "definitely-not-a-concept";
    expect(
      courseKey(goal, "quick", knownForGoal(graph, goal, [nonPrereq])),
    ).toBe(courseKey(goal, "quick", []));
  });
});
