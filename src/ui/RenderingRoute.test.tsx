import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../graph/fixture-graph";
import type { Rendering } from "../types";
import { RenderingRoute } from "./LessonPage";
import { resolveRenderingCitation } from "./model";

const concept = fixtureGraph.concepts.find((candidate) => candidate.id === "vectors");
if (!concept?.lesson) throw new Error("fixture vectors lesson missing");
const baseStep = concept.lesson.steps[0];

const rendering: Rendering = {
  conceptId: concept.id,
  format: "why-it-exists",
  plainTitle: "Why fixed-length lists help",
  steps: [
    { ...baseStep, text: "A fixed list gives each quantity a dependable place." },
    { ...baseStep, text: "That shared shape lets one operation compare many quantities." },
  ],
};

const otherRendering: Rendering = {
  ...rendering,
  format: "how-it-works",
  plainTitle: "How the list works",
};

const html = () => renderToStaticMarkup(
  <RenderingRoute
    concept={concept}
    rendering={rendering}
    otherRenderings={[otherRendering]}
    resolveCitation={(candidate, stepIndex) => (
      resolveRenderingCitation(fixtureGraph, candidate, stepIndex)
    )}
    nextLabel="Next idea"
    onNext={() => undefined}
    onReturn={() => undefined}
    onSelect={() => undefined}
  />,
);

describe("summoned rendering route", () => {
  it("shows every step with its own citation and one attribution per source", () => {
    const markup = html();

    expect(markup).toContain("Why fixed-length lists help");
    expect(markup).toContain("A fixed list gives each quantity a dependable place.");
    expect(markup).toContain("That shared shape lets one operation compare many quantities.");
    // Every step keeps its own sheet and footnote mark…
    expect(markup.match(/aria-label="Read the source behind this step"/g)).toHaveLength(2);
    expect(markup.match(/<mark>/g)).toHaveLength(2);
    // …but the visible colophon prints ONCE for the one source both steps cite. Printing the
    // identical attribution under all steps read as a stuck rubber stamp; the license
    // obligation is discharged by the single visible credit.
    expect(markup.match(/Read the source ↗/g)).toHaveLength(1);
    expect(markup.match(/Plain translation/g)).toHaveLength(1);
  });

  it("keeps the lesson one gesture away and offers a second grounded route contextually", () => {
    const markup = html();

    expect(markup).toContain(">Back to the lesson<");
    expect(markup).toContain(">See how it works<");
    expect(markup).not.toContain("tablist");
  });

  it("never renders the banned machine-first framing", () => {
    expect(html()).not.toContain("AI-" + "translated");
  });
});
