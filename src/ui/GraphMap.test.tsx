import cytoscape from "cytoscape";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import type { LearningGraph } from "../types";
import { GraphMap, graphMapKeyboardCommand, stylesFor } from "./GraphMap";
import { titleFor } from "./titles";

/**
 * WHAT THIS FILE CAN AND CANNOT SEE — read this before adding to it.
 *
 * The clipped label the owner found on screen ("Next · Vectors" rendered as "xt · Vect") CANNOT
 * be caught from here, and the trap is that it looks like it can. Headless Cytoscape has no
 * canvas, so `measureText` never runs and `rstyle.labelWidth` is never populated; a node's
 * bounding box with labels and without are therefore IDENTICAL. `expect(withLabel).toBe(box)`
 * passes for a grossly overflowing 36-character label. The old probe failed exactly this way in
 * the other direction — it recorded `font-size × zoom`, a quantity mathematically incapable of
 * noticing clipping, and reported a healthy 15.7 for a clipped label while the suite ran green.
 *
 * So these tests do not measure pixels. They assert what IS knowable in node and what actually
 * caused the clip:
 *   1. the stylesheet Cytoscape actually kept (an illegal value is dropped SILENTLY), and
 *   2. that the map names a concept the way the rest of the app names it.
 * Every assertion here was mutation-tested by putting the real bug back and watching it go red.
 * One further test — "never prefixes status onto a label" — was written, found to be incapable
 * of failing, and deleted; see the note where it used to be before writing it again.
 */

/** What Cytoscape's parser KEPT for one property. `pstyle` is real and is the only way to see a
 *  rejected value (it is how Cytoscape reads its own styles internally), but it is absent from
 *  the published typings — hence the one narrow cast, made here once rather than at every use. */
interface ParsedProperty {
  strValue: string;
  pfValue: number;
}

/** styleEnabled is required or Cytoscape parses nothing and every assertion below reads
 *  undefined; destroy() is required or the core keeps the vitest process alive. */
function parsedNodeStyle(): Record<string, ParsedProperty> {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [{ data: { id: "vectors", displayLabel: "Vectors as fixed-length lists" } }],
    style: stylesFor("light"),
  });
  const node = cy.getElementById("vectors") as unknown as {
    pstyle(name: string): ParsedProperty | undefined;
  };
  const read = (name: string): ParsedProperty => {
    const parsed = node.pstyle(name);
    // A property Cytoscape rejected outright comes back undefined. Fail loudly rather than
    // let `undefined === undefined` quietly satisfy an assertion.
    if (!parsed) throw new Error(`Cytoscape kept no value at all for \`${name}\``);
    return parsed;
  };
  const parsed = {
    fontWeight: read("font-weight"),
    fontFamily: read("font-family"),
    width: read("width"),
    height: read("height"),
    textMaxWidth: read("text-max-width"),
    overflowWrap: read("text-overflow-wrap"),
  };
  cy.destroy();
  return parsed;
}

describe("the map shell's keyboard commands", () => {
  const keyboardOrder = fixtureGraph.concepts.map((concept) => concept.id);
  const shell = {};

  it.each([
    ["Zoom in", "Enter"],
    ["Zoom in", " "],
    ["Zoom out", "Enter"],
    ["Zoom out", " "],
    ["Fit visible concepts in view", "Enter"],
    ["Fit visible concepts in view", " "],
  ])("leaves %s's %j key press to the button", (_control, key) => {
    const button = {};
    expect(
      graphMapKeyboardCommand({ key, target: button, currentTarget: shell }, keyboardOrder, "vectors"),
    ).toBeNull();
  });

  it.each(["Enter", " "])(
    "keeps the map open and the selected node in place for %j",
    (key) => {
      expect(
        graphMapKeyboardCommand(
          { key, target: shell, currentTarget: shell },
          keyboardOrder,
          "vectors",
        ),
      ).toEqual({ type: "stay", id: "vectors" });
    },
  );
});

describe("the map's stylesheet survives Cytoscape's parser", () => {
  // THE REGRESSION THAT SHIPPED. `font-weight: 650` is not a member of Cytoscape's fontWeight
  // enum (cytoscape.cjs.js:17414), so it is rejected and `normal` — weight 400 — is applied to
  // the drawing font AND the measuring font. A change made to get BOLDER type shipped LIGHTER
  // type, silently, with the suite green. Note the enum's own trap: the number 700 is a member,
  // the string "700" is not. Mutation-tested: setting 650 or "700" turns this red.
  it("keeps the node font-weight it was given", () => {
    expect(parsedNodeStyle().fontWeight.strValue).toBe("600");
  });

  // A font string that fails to parse in canvas `ctx.font` makes measureText lie — and
  // `width: "label"` below sizes the box FROM measureText, so it would inherit the lie. This is
  // why the font is fixed before the box. `Inter` is not installed and was never fetched (a
  // fetch would break the offline gate anyway); `ui-sans-serif` is not a canvas-resolvable name.
  it("names only fonts a canvas can resolve — no phantom Inter, no ui-sans-serif", () => {
    const style = parsedNodeStyle();
    expect(style.fontFamily.strValue).not.toContain("Inter");
    expect(style.fontFamily.strValue).not.toContain("ui-sans-serif");
    expect(style.fontFamily.strValue).toContain("-apple-system");
  });

  // The box is sized to the text, so a label cannot overflow it. This asserts the MECHANISM is
  // in place, which is the part that is knowable here — the pixel result is a browser question.
  // Mutation-tested: restoring `width: 184` turns this red.
  it("sizes the node box from its label, and wraps at one width with no second opinion", () => {
    const style = parsedNodeStyle();
    expect(style.width.strValue).toBe("label");
    expect(style.height.strValue).toBe("label");
    expect(style.textMaxWidth.pfValue).toBe(200);
    // "whitespace", not "anywhere". "anywhere" was chosen to stop a word longer than
    // text-max-width escaping the node — but `width: "label"` sizes the node TO its label,
    // so an over-long word widens the box; it cannot escape. The cost was real: it breaks
    // at any character on EVERY line, and the live map rendered "Vectors as fixed-length
    // list / s" and "Multiply matching values, t / hen add". Found by opening the map.
    // This assertion still earns its place: cytoscape rejects an illegal value silently and
    // falls back to the default, and the default IS "whitespace" — so this cannot tell
    // "accepted" from "rejected". What proves acceptance is the absence of a parser warning
    // (the same run warns loudly about the deprecated `label` width/height and says nothing
    // here). Kept as a pin against a future agent reintroducing "anywhere".
    expect(style.overflowWrap.strValue).toBe("whitespace");
  });
});

describe("the map speaks the app's vocabulary", () => {
  const render = (graph: LearningGraph, covered: string[] = []) =>
    renderToStaticMarkup(
      <GraphMap
        graph={graph}
        goalId={graph.goalId}
        selectedId="vectors"
        currentId="vectors"
        path={graph.concepts.map((concept) => concept.id)}
        initialPath={graph.concepts.map((concept) => concept.id)}
        covered={covered}
        theme="light"
        onSelect={() => undefined}
      />,
    );

  // THE TWO-VOCABULARIES SPLIT. `concept.title` is the textbook's register; titleFor() is the
  // one the learner reads everywhere else. The map used to render concept.title straight onto
  // its nodes, so it said "Vectors" while the lesson directly above said "Vectors as
  // Fixed-Length Lists". The fixture makes this visible: its title is the bare id.
  it("names a concept the way the lesson names it, never the way the textbook does", () => {
    const vectors = fixtureGraph.concepts.find((concept) => concept.id === "vectors");
    expect(vectors).toBeDefined();
    // Guard the guard: if these ever coincide the assertions below prove nothing.
    expect(titleFor(vectors!)).not.toBe(vectors!.title);

    const html = render(fixtureGraph);
    expect(html).toContain(titleFor(vectors!));
    // The sr-only route list is the map's text alternative; it must not fall back to the
    // textbook title. ">vectors," is the shape the old `${title}, ${status}` produced.
    expect(html).not.toContain(">vectors,");
  });

  it("announces page completion as covered, never as comprehension", () => {
    const vectors = fixtureGraph.concepts.find((concept) => concept.id === "vectors");
    if (!vectors) throw new Error("fixture vectors concept missing");

    const html = render(fixtureGraph, [vectors.id]);
    expect(html).toContain(`Step 1: ${titleFor(vectors)}, covered.`);
    expect(html).not.toMatch(/understood/i);
  });

  /* DELIBERATELY NOT TESTED HERE — and this note exists so the next agent does not helpfully
     rebuild the fake guard I just removed.
   *
   * "Never prefixes status onto a name" is the single highest-value regression in this file:
   * the "Next · " prefix is what turned a 7-character concept into a 14-character label and
   * clipped it. I wrote the obvious test —
   *     expect(render(fixtureGraph)).not.toContain("Next · ")
   * — it passed, and it is WORTHLESS. The label is composed inside a useEffect, and
   * renderToStaticMarkup never runs effects. Verified by mutation, not by reasoning: I put the
   * exact status ternary back and the file stayed 7/7 GREEN. A test that cannot fail is worse
   * than no test, because it tells the next reader the bug is guarded.
   *
   * Catching it honestly needs the effect to run (jsdom), which this repo does not have and
   * which the plan explicitly cut. What protects it instead is STRUCTURAL and is tested above:
   * with `width: "label"` the box is defined as the size of its own text, so even a label that
   * grew a prefix back could not clip — it would only get wider. That is why the fix was to
   * size the box to the text rather than to tune the prefix away. */
});

describe("the map's key is gated on the data, not the view", () => {
  // data/graph.json holds 9 edges and all 9 are `prereq`. The key advertised "Related" whenever
  // the full map was open, promising a dashed line the map is incapable of drawing — on a
  // product whose whole claim is that nothing on screen is invented.
  it("advertises no key for a line the data cannot draw", () => {
    expect(fixtureGraph.edges.some((edge) => edge.type === "related")).toBe(false);
    const html = renderToStaticMarkup(
      <GraphMap
        graph={fixtureGraph}
        goalId={fixtureGraph.goalId}
        selectedId="vectors"
        currentId="vectors"
        path={[]}
        initialPath={fixtureGraph.concepts.map((concept) => concept.id)}
        covered={[]}
        theme="light"
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("Your route");
    expect(html).not.toContain("Side quest");
  });

  it("shows the side-quest key the moment a side quest exists", () => {
    const withSideQuest: LearningGraph = {
      ...fixtureGraph,
      edges: [...fixtureGraph.edges, { from: "vectors", to: "softmax", type: "related" }],
    };
    const html = renderToStaticMarkup(
      <GraphMap
        graph={withSideQuest}
        goalId={withSideQuest.goalId}
        selectedId="vectors"
        currentId="vectors"
        path={[]}
        initialPath={withSideQuest.concepts.map((concept) => concept.id)}
        covered={[]}
        theme="light"
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain("Side quest");
  });
});
