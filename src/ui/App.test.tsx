import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import type { RenderingSet } from "../types";
import { App, courseKey, CourseScreen } from "./App";
import { Entry } from "./Entry";
import { GraphMap } from "./GraphMap";
import { coveredConcepts, deriveProgress, selfExplanationPrompt } from "./model";

describe("Phase 5 learning flow", () => {
  it("offers another route only when the current concept has one", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    const concept = fixtureGraph.concepts.find((candidate) => candidate.id === "vectors");
    if (!concept?.lesson) throw new Error("fixture vectors lesson missing");
    const renderings: RenderingSet = {
      renderings: [{
        conceptId: concept.id,
        format: "why-it-exists",
        plainTitle: "Why fixed-length lists help",
        steps: concept.lesson.steps,
      }],
    };

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        renderings={renderings}
        goalId={fixtureGraph.goalId}
        covered={[]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onOpenLesson={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html).toContain(">Try another way in<");
  });

  it("stays silent when alternates belong to a different concept", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    const other = fixtureGraph.concepts.find((candidate) => candidate.id === "dot-product");
    if (!other?.lesson) throw new Error("fixture dot-product lesson missing");
    const renderings: RenderingSet = {
      renderings: [{
        conceptId: other.id,
        format: "how-it-works",
        plainTitle: "How matching positions combine",
        steps: other.lesson.steps,
      }],
    };

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        renderings={renderings}
        goalId={fixtureGraph.goalId}
        covered={[]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onOpenLesson={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html).not.toContain("Try another way in");
    expect(html).not.toContain("alternate-route");
    expect(html).not.toMatch(/no other route|coming soon|not available/i);
  });

  it("renders an empty optional artifact exactly like no artifact", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    const props = {
      graph: fixtureGraph,
      goalId: fixtureGraph.goalId,
      covered: [],
      theme: "light" as const,
      progress,
      onNext: () => undefined,
      onOpenLesson: () => undefined,
      onRestart: () => undefined,
    };

    expect(renderToStaticMarkup(<CourseScreen {...props} renderings={{ renderings: [] }} />))
      .toBe(renderToStaticMarkup(<CourseScreen {...props} />));
  });

  it("shows one progressbar and no completion message while course pages remain", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    expect(progress.remaining.length).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        covered={[]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onOpenLesson={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html.match(/role="progressbar"/g)).toHaveLength(1);
    expect(html).not.toContain("Course complete");
  });

  it("stores progress under a key scoped to one goal, one depth, and one declaration", () => {
    // Page keys are NOT unique to a course — `vectors:0` is page 1 of six different courses.
    // So this key is the ONLY thing keeping one course's progress out of another's, which is
    // what the global v1/v2 keys failed to do: finishing one course marked five other goals
    // complete. A key that stops naming the goal and the depth reopens that leak exactly.
    const keys = fixtureGraph.concepts.flatMap((concept) => [
      courseKey(concept.id, "quick"),
      courseKey(concept.id, "thorough"),
    ]);
    expect(new Set(keys).size).toBe(keys.length);

    expect(courseKey("softmax", "quick")).toContain("softmax");
    expect(courseKey("softmax", "quick")).toContain("quick");
    expect(courseKey("softmax", "quick")).not.toBe(courseKey("self-attention", "quick"));
    expect(courseKey("softmax", "quick")).not.toBe(courseKey("softmax", "thorough"));
    expect(courseKey("softmax", "quick", ["vectors"])).not.toBe(
      courseKey("softmax", "quick", ["vectors", "dot-product"]),
    );
    expect(courseKey("softmax", "quick", ["vectors", "dot-product"])).toBe(
      courseKey("softmax", "quick", ["dot-product", "vectors"]),
    );
    expect(courseKey("softmax", "quick", [])).toContain("course.v4");
  });

  it("quietly asks for self-explanation on the first page after a direct prerequisite", () => {
    const progress = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      ["vectors:0"],
    );
    const concept = fixtureGraph.concepts.find((candidate) => candidate.id === "dot-product");
    const prerequisite = fixtureGraph.concepts.find((candidate) => candidate.id === "vectors");
    if (!concept || !prerequisite) throw new Error("fixture concepts missing");

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        covered={["vectors"]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onOpenLesson={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html).toContain(selfExplanationPrompt(concept, prerequisite));
    expect(html).toContain("<textarea");
    expect(html).toContain("Optional. Nothing checks or saves what you write.");
    expect(html).not.toContain("required");
    expect(html).toContain(">Next idea<");
  });

  it("renders no self-explanation prompt for a root concept with no prerequisite", () => {
    const progress = deriveProgress(fixtureGraph, "vectors", "quick", []);
    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId="vectors"
        covered={[]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onOpenLesson={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html).not.toContain("Before you continue");
    expect(html).not.toContain("<textarea");
  });

  it("keeps progress and covered status byte-identical when the optional prompt is skipped", () => {
    const completedPages = ["vectors:0"];
    const progress = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      completedPages,
    );
    const progressBefore = JSON.stringify(progress);
    const coveredBefore = JSON.stringify(
      coveredConcepts(fixtureGraph, fixtureGraph.goalId, "quick", completedPages),
    );

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        covered={["vectors"]}
        theme="light"
        progress={progress}
        onNext={() => undefined}
        onOpenLesson={() => undefined}
        onRestart={() => undefined}
      />,
    );

    expect(html).toContain("<textarea");
    expect(JSON.stringify(progress)).toBe(progressBefore);
    expect(JSON.stringify(
      coveredConcepts(fixtureGraph, fixtureGraph.goalId, "quick", completedPages),
    )).toBe(coveredBefore);
  });

  it("offers only the selected goal's prerequisite spine using display titles", () => {
    const html = renderToStaticMarkup(
      <Entry
        graph={fixtureGraph}
        goalId="softmax"
        depth="quick"
        known={[]}
        onGoalChange={() => undefined}
        onDepthChange={() => undefined}
        onKnownChange={() => undefined}
        onPassionChange={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).toContain("Vectors as fixed-length lists");
    expect(html).toContain("Multiply matching values, then add");
    expect(html).not.toContain('type="checkbox" value="qkv"');
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked=/);
  });

  it("renders the map legend as a key with swatches, not checkmark glyphs", () => {
    const html = renderToStaticMarkup(
      <GraphMap
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        selectedId="vectors"
        currentId="vectors"
        path={[...fixtureGraph.concepts.map((concept) => concept.id)]}
        initialPath={[...fixtureGraph.concepts.map((concept) => concept.id)]}
        covered={[]}
        theme="light"
        onSelect={() => undefined}
        onActivate={() => undefined}
      />,
    );

    // Anchor to the VISIBLE text node. An aria-label on the role-less legend div is inert
    // (ARIA prohibits name-from on `generic`), so asserting it would certify a no-op.
    expect(html).toContain(">Key<");
    expect(html).toContain('class="legend-swatch covered"');
    expect(html).toContain("> Covered</span>");
    expect(html).not.toMatch(/understood/i);
    // The bordered ✓ box read as a checked checkbox; the swatch pills replaced it.
    expect(html).not.toContain("✓");
  });

  it("labels the theme toggle with the action it performs, not the state you are already in", () => {
    const html = renderToStaticMarkup(<App graph={fixtureGraph} />);
    expect(html).toContain("Current theme: Light. Switch to dark theme.");
    // Anchored to the text node, NOT the substring: the aria-label above already contains
    // "Switch to dark", so a bare toContain("Switch to dark") stays green even if the visible
    // span is deleted. ☾ is unique to the icon span.
    expect(html).toContain(">Switch to dark<");
    expect(html).toContain("☾");
  });
});
