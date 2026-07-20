import { Children, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import type { RenderingSet } from "../types";
import {
  App,
  courseKey,
  CourseScreen,
  loadSelfExplanations,
  restartCourseState,
  saveSelfExplanation,
  selfExplanationCourseKey,
  selfExplanationStorageKey,
} from "./App";
import { Entry } from "./Entry";
import { GraphMap } from "./GraphMap";
import { SelfExplanation } from "./LessonPage";
import {
  coursePageKey,
  courseSelfExplanationPrompts,
  coveredConcepts,
  deriveProgress,
  selfExplanationPromptId,
  selfExplanationPrompt,
} from "./model";
import { titleFor } from "./titles";

describe("Phase 5 learning flow", () => {
  function memoryStorage(initial: [string, string][] = []): Storage {
    const stored = new Map(initial);
    return {
      get length() { return stored.size; },
      clear: () => stored.clear(),
      getItem: (key) => stored.get(key) ?? null,
      key: (index) => [...stored.keys()][index] ?? null,
      removeItem: (key) => { stored.delete(key); },
      setItem: (key, value) => { stored.set(key, value); },
    };
  }

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
        onRestart={() => undefined}
        onGoalChange={() => undefined}
      />,
    );

    expect(html).toContain(">See why it matters<");
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
        onRestart={() => undefined}
        onGoalChange={() => undefined}
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
      onRestart: () => undefined,
      onGoalChange: () => undefined,
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
        onRestart={() => undefined}
        onGoalChange={() => undefined}
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

  it("persists a self-explanation on change and blur, then prefills it on return", () => {
    const storage = memoryStorage();
    const courseNotesKey = selfExplanationCourseKey(fixtureGraph.goalId, "quick", []);
    const promptId = selfExplanationPromptId("dot-product", "vectors");
    const persist = (answer: string) => (
      saveSelfExplanation(courseNotesKey, promptId, answer, storage)
    );
    const prompt = "Why does this idea need the one before it?";
    const element = SelfExplanation({ question: prompt, answer: "", onAnswerChange: persist });
    const textarea = Children.toArray(element?.props.children).find(
      (child) => isValidElement(child) && child.type === "textarea",
    ) as ReactElement<{
      onBlur: (event: { currentTarget: { value: string } }) => void;
      onChange: (event: { currentTarget: { value: string } }) => void;
    }>;

    textarea.props.onChange({ currentTarget: { value: "It supplies stable positions." } });
    expect(storage.getItem(selfExplanationStorageKey(courseNotesKey, promptId)))
      .toBe("It supplies stable positions.");
    textarea.props.onBlur({ currentTarget: { value: "It supplies the values to compare." } });

    const returned = loadSelfExplanations(courseNotesKey, storage);
    const progress = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      ["vectors:0"],
    );
    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        covered={["vectors"]}
        theme="light"
        progress={progress}
        selfExplanations={returned}
        onSelfExplanationChange={() => undefined}
        onNext={() => undefined}
        onRestart={() => undefined}
        onGoalChange={() => undefined}
      />,
    );

    expect(returned[promptId]).toBe("It supplies the values to compare.");
    expect(html).toContain(">It supplies the values to compare.</textarea>");
  });

  it("scopes self-explanations to the exact course", () => {
    const storage = memoryStorage();
    const courseA = selfExplanationCourseKey("self-attention", "quick", []);
    const courseB = selfExplanationCourseKey("softmax", "quick", []);
    const promptId = selfExplanationPromptId("dot-product", "vectors");

    saveSelfExplanation(courseA, promptId, "Only course A owns this.", storage);

    expect(selfExplanationStorageKey(courseA, promptId)).toBe(
      "atomic-learning-graph.selfexpl.v1:self-attention:quick:%5B%5D:dot-product:vectors",
    );
    expect(selfExplanationStorageKey(courseA, promptId)).not.toBe(
      selfExplanationStorageKey(courseB, promptId),
    );
    expect(courseA).not.toBe(selfExplanationCourseKey("self-attention", "thorough", []));
    expect(courseA).not.toBe(selfExplanationCourseKey("self-attention", "quick", ["vectors"]));
    expect(loadSelfExplanations(courseA, storage)[promptId]).toBe("Only course A owns this.");
    expect(loadSelfExplanations(courseB, storage)[promptId]).toBeUndefined();
  });

  it("starts the active course over without touching another course's notes or any preference", () => {
    const activeKey = courseKey(fixtureGraph.goalId, "quick", []);
    const otherCourseKey = courseKey("softmax", "thorough", ["vectors"]);
    const activeNotesKey = selfExplanationCourseKey(fixtureGraph.goalId, "quick", []);
    const otherNotesKey = selfExplanationCourseKey("softmax", "thorough", ["vectors"]);
    const promptId = selfExplanationPromptId("dot-product", "vectors");
    const storage = memoryStorage([
      [activeKey, JSON.stringify(["vectors:0", "dot-product:0"])],
      [otherCourseKey, JSON.stringify(["vectors:0"])],
      [selfExplanationStorageKey(activeNotesKey, promptId), "Active note"],
      [selfExplanationStorageKey(otherNotesKey, promptId), "Other course note"],
      ["atomic-learning-graph.theme.v1", "dark"],
      ["atomic-learning-graph.passion.v1", "music"],
    ]);

    const restarted = restartCourseState(activeKey, activeNotesKey, storage);
    expect(restarted).toEqual({ key: activeKey, pages: [] });
    expect(storage.getItem(activeKey)).toBeNull();
    expect(storage.getItem(selfExplanationStorageKey(activeNotesKey, promptId))).toBeNull();
    expect(storage.getItem(otherCourseKey)).toBe(JSON.stringify(["vectors:0"]));
    expect(storage.getItem(selfExplanationStorageKey(otherNotesKey, promptId)))
      .toBe("Other course note");
    expect(storage.getItem("atomic-learning-graph.theme.v1")).toBe("dark");
    expect(storage.getItem("atomic-learning-graph.passion.v1")).toBe("music");

    const progress = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      restarted.pages,
    );
    expect(progress.remaining[0]).toEqual(progress.pages[0]);
  });

  it("offers a quiet Start over control on both the lesson and completion screens", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    const props = {
      graph: fixtureGraph,
      goalId: fixtureGraph.goalId,
      covered: [],
      theme: "light" as const,
      onNext: () => undefined,
      onRestart: () => undefined,
      onGoalChange: () => undefined,
    };
    const lesson = renderToStaticMarkup(<CourseScreen {...props} progress={progress} />);
    const complete = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      progress.pages.map(coursePageKey),
    );
    const completion = renderToStaticMarkup(<CourseScreen {...props} progress={complete} />);

    expect(lesson).toContain('class="text-button"');
    expect(lesson).toContain(">Start over<");
    expect(completion).toContain('class="text-button"');
    expect(completion).toContain(">Start over<");
  });

  it("recaps the completed course in the same prerequisite order with display titles", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    const complete = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      progress.pages.map(coursePageKey),
    );
    const route = [...new Set(progress.pages.map((page) => page.conceptId))]
      .map((id) => fixtureGraph.concepts.find((concept) => concept.id === id))
      .map((concept) => {
        if (!concept) throw new Error("fixture course concept missing");
        return titleFor(concept);
      });
    const goal = fixtureGraph.concepts.find((concept) => concept.id === fixtureGraph.goalId);
    if (!goal) throw new Error("fixture goal missing");

    const html = renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        covered={[]}
        theme="light"
        progress={complete}
        onNext={() => undefined}
        onRestart={() => undefined}
        onGoalChange={() => undefined}
      />,
    );

    expect(html).toContain(
      `You can now approach ${titleFor(goal)} because you worked through ${route.join(" → ")}.`,
    );
    expect(html).not.toContain(`worked through ${progress.pages.map(coursePageKey).join(" → ")}`);
  });

  it("recaps only written self-explanations at completion and renders nothing when none exist", () => {
    const progress = deriveProgress(fixtureGraph, fixtureGraph.goalId, "quick", []);
    const complete = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      progress.pages.map(coursePageKey),
    );
    const prompts = courseSelfExplanationPrompts(fixtureGraph, complete.pages);
    expect(prompts.length).toBeGreaterThan(1);
    const notes = {
      [prompts[0].id]: "This is the thread I made.",
      [prompts[1].id]: "   ",
    };
    const props = {
      graph: fixtureGraph,
      goalId: fixtureGraph.goalId,
      covered: [],
      theme: "light" as const,
      progress: complete,
      onNext: () => undefined,
      onRestart: () => undefined,
      onGoalChange: () => undefined,
    };

    const written = renderToStaticMarkup(
      <CourseScreen {...props} selfExplanations={notes} />,
    );
    const empty = renderToStaticMarkup(
      <CourseScreen {...props} selfExplanations={{}} />,
    );

    expect(written).toContain("What you wrote");
    expect(written).toContain("The thread you wrote through these ideas");
    expect(written).toContain(prompts[0].prompt);
    expect(written).toContain("This is the thread I made.");
    expect(written).not.toContain(prompts[1].prompt);
    expect(empty).not.toContain("What you wrote");
    expect(empty).not.toContain("The thread you wrote through these ideas");
    expect(empty).not.toContain("self-explanation-recap");
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
        onRestart={() => undefined}
        onGoalChange={() => undefined}
      />,
    );

    expect(html).toContain(selfExplanationPrompt(concept, prerequisite));
    expect(html).toContain("<textarea");
    expect(html).toContain("Optional. Nothing grades this — your notes come back at the end.");
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
        onRestart={() => undefined}
        onGoalChange={() => undefined}
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
        onRestart={() => undefined}
        onGoalChange={() => undefined}
      />,
    );

    expect(html).toContain("<textarea");
    expect(JSON.stringify(progress)).toBe(progressBefore);
    expect(JSON.stringify(
      coveredConcepts(fixtureGraph, fixtureGraph.goalId, "quick", completedPages),
    )).toBe(coveredBefore);
  });

  it("keeps progress and covered status byte-identical when the optional prompt is answered", () => {
    const completedPages = ["vectors:0"];
    const beforeProgress = deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      completedPages,
    );
    const beforeCovered = coveredConcepts(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      completedPages,
    );
    const promptId = selfExplanationPromptId("dot-product", "vectors");

    renderToStaticMarkup(
      <CourseScreen
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        covered={beforeCovered}
        theme="light"
        progress={beforeProgress}
        selfExplanations={{ [promptId]: "Any answer, including nonsense." }}
        onSelfExplanationChange={() => undefined}
        onNext={() => undefined}
        onRestart={() => undefined}
        onGoalChange={() => undefined}
      />,
    );

    expect(deriveProgress(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      completedPages,
    )).toEqual(beforeProgress);
    expect(coveredConcepts(
      fixtureGraph,
      fixtureGraph.goalId,
      "quick",
      completedPages,
    )).toEqual(beforeCovered);
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
