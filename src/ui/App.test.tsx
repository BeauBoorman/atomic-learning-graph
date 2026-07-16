import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import { App, CourseScreen } from "./App";
import { deriveProgress } from "./model";

describe("Phase 5 learning flow", () => {
  it("shows one progressbar and no completion message while course pages remain", () => {
    const progress = deriveProgress(fixtureGraph, [], fixtureGraph.goalId, "quick");
    expect(progress.remaining.length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        depth="quick"
        known={[]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html.match(/role="progressbar"/g)).toHaveLength(1);
    expect(html).not.toContain("Course complete");
  });

  it("labels the theme toggle with the current state, not its target", () => {
    const html = renderToStaticMarkup(<App graph={fixtureGraph} />);
    expect(html).toContain("Current theme: Light. Switch to dark theme.");
    expect(html).toContain("☀");
    expect(html).toContain(">Light<");
  });
});
