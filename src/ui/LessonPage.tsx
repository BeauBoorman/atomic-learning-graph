import { useEffect, useRef, useState } from "react";
import type {
  AlternateFormat,
  Concept,
  LessonStep,
  PassionId,
  Rendering,
} from "../types";
import { Citation, FootnoteMark } from "./Citation";
import type { ResolvedPassage } from "./model";
import { titleFor } from "./titles";

interface LessonPageProps {
  concept: Concept;
  step: LessonStep;
  resolved: ResolvedPassage;
  renderings?: Rendering[];
  resolveRendering?: (rendering: Rendering, stepIndex: number) => ResolvedPassage;
  passion?: PassionId;
  selfExplanation?: string;
  selfExplanationAnswer?: string;
  onSelfExplanationChange?: (answer: string) => void;
  nextLabel: string;
  onNext: () => void;
}

/** The passion names the VOICE. "(analogy)" told the learner what the box was instead of what
 *  it said — and labelling an optional aid with its own mechanism is the tell. */
const analogyVoices: Record<PassionId, string> = {
  cooking: "In the kitchen",
  sports: "On the field",
  music: "In the music",
  "video-games": "In the game",
  cars: "Under the hood",
  gardening: "In the garden",
};

const routeLabel = (format: AlternateFormat): string => (
  format === "why-it-exists" ? "See why it matters" : "See how it works"
);

export function SelfExplanation({
  question,
  answer = "",
  onAnswerChange = () => undefined,
}: {
  question?: string;
  answer?: string;
  onAnswerChange?: (answer: string) => void;
}) {
  if (!question) return null;
  return (
    <section className="self-explanation" aria-labelledby="self-explanation-question">
      <label id="self-explanation-question" htmlFor="self-explanation-response">{question}</label>
      <textarea
        key={question}
        id="self-explanation-response"
        rows={2}
        aria-describedby="self-explanation-note"
        value={answer}
        onChange={(event) => onAnswerChange(event.currentTarget.value)}
        onBlur={(event) => onAnswerChange(event.currentTarget.value)}
      />
      <p id="self-explanation-note">
        Optional. Nothing grades this — your notes come back at the end.
      </p>
    </section>
  );
}

function RenderingStep({
  rendering,
  stepIndex,
  resolved,
  attribution,
}: {
  rendering: Rendering;
  stepIndex: number;
  resolved: ResolvedPassage;
  attribution: boolean;
}) {
  const step = rendering.steps[stepIndex];
  const mark = useRef<HTMLButtonElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <li className="rendering-step">
      <p className="rendering-step-number">Step {stepIndex + 1} of {rendering.steps.length}</p>
      <p className="rendering-step-text">
        {step.text}
        <FootnoteMark ref={mark} open={sourceOpen} onOpen={() => setSourceOpen(true)} />
      </p>
      <Citation
        resolved={resolved}
        stepText={step.text}
        open={sourceOpen}
        onOpen={() => setSourceOpen(true)}
        onClose={() => setSourceOpen(false)}
        attribution={attribution}
      />
    </li>
  );
}

interface RenderingRouteProps {
  concept: Concept;
  rendering: Rendering;
  otherRenderings: Rendering[];
  resolveCitation: (rendering: Rendering, stepIndex: number) => ResolvedPassage;
  selfExplanation?: string;
  selfExplanationAnswer?: string;
  onSelfExplanationChange?: (answer: string) => void;
  nextLabel: string;
  onNext: () => void;
  onReturn: () => void;
  onSelect: (format: AlternateFormat) => void;
}

/** A summoned route replaces the lesson rather than competing beside it. Each sentence keeps the
 *  edition's full receipt; the learner can return home before or after reading the route. */
export function RenderingRoute({
  concept,
  rendering,
  otherRenderings,
  resolveCitation,
  selfExplanation,
  selfExplanationAnswer,
  onSelfExplanationChange,
  nextLabel,
  onNext,
  onReturn,
  onSelect,
}: RenderingRouteProps) {
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => title.current?.focus(), [rendering.format]);

  return (
    <article className="lesson-page rendering-route" aria-labelledby="rendering-title">
      <button className="text-button route-return route-return-top" type="button" onClick={onReturn}>
        Back to the lesson
      </button>
      <p className="eyebrow">Another route to {titleFor(concept)}</p>
      <h1 id="rendering-title" ref={title} tabIndex={-1}>{rendering.plainTitle}</h1>

      <ol className="rendering-steps">
        {/* One visible colophon per SOURCE, on its first step. Every step keeps its own sheet
            and footnote mark; only the repeated attribution paragraph is deduplicated — it was
            printed identically under all four steps of a route. */}
        {(() => {
          const attributedSources = new Set<string>();
          return rendering.steps.map((step, stepIndex) => {
            const resolved = resolveCitation(rendering, stepIndex);
            const attribution = !attributedSources.has(resolved.source.id);
            attributedSources.add(resolved.source.id);
            return (
              <RenderingStep
                key={`${rendering.format}:${stepIndex}:${step.text}`}
                rendering={rendering}
                stepIndex={stepIndex}
                resolved={resolved}
                attribution={attribution}
              />
            );
          });
        })()}
      </ol>

      <div className="route-actions" aria-label="Lesson routes">
        <button className="text-button" type="button" onClick={onReturn}>Back to the lesson</button>
        {otherRenderings.map((candidate) => (
          <button
            key={candidate.format}
            className="text-button"
            type="button"
            onClick={() => onSelect(candidate.format)}
          >
            {routeLabel(candidate.format)}
          </button>
        ))}
      </div>
      <SelfExplanation
        question={selfExplanation}
        answer={selfExplanationAnswer}
        onAnswerChange={onSelfExplanationChange}
      />
      <button className="primary-button lesson-next" type="button" onClick={onNext}>
        {nextLabel}
      </button>
    </article>
  );
}

export function LessonPage({
  concept,
  step,
  resolved,
  renderings = [],
  resolveRendering,
  passion,
  selfExplanation,
  selfExplanationAnswer,
  onSelfExplanationChange,
  nextLabel,
  onNext,
}: LessonPageProps) {
  const analogy = passion ? step.analogies?.[passion] : undefined;
  const title = useRef<HTMLHeadingElement>(null);
  const mark = useRef<HTMLButtonElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [activeFormat, setActiveFormat] = useState<AlternateFormat>();
  const availableRenderings = renderings.filter(
    (rendering) => rendering.conceptId === concept.id,
  );
  const activeRendering = availableRenderings.find(
    (rendering) => rendering.format === activeFormat,
  );

  // A summoned sheet must never outlive the claim it backs. Without this, turning the page with
  // the sheet open leaves page 4's source sitting over page 5's lesson — a wrong receipt, which
  // on this project is the only unsurvivable kind of bug.
  //
  // Keyed on step.TEXT, not on the `step` object. Today App.tsx reads steps straight off the
  // module-level graph so their identity is stable, but that is an assumption this file cannot
  // enforce: the day anyone maps or clones the step list, an identity dep fires on EVERY render
  // and the sheet slams shut the instant it opens. A primitive cannot rot that way.
  useEffect(() => {
    setSourceOpen(false);
    setActiveFormat(undefined);
  }, [concept.id, step.text]);

  // `S` summons the source. Bound here rather than in App.tsx because the source belongs to the
  // step, and the state that owns it is this component's.
  // INTEGRATION NOTE: §4.4 puts the keymap on `document` in App.tsx (S source · M map · →/Space
  // next · Esc dismiss). Whoever builds that map must NOT also bind `S`, or it toggles twice and
  // nets to nothing. Esc is already handled — natively, by the dialog.
  useEffect(() => {
    // A complete alternate route has several independently cited steps, so there is no single
    // source for `S` to summon. Its visible footnote marks remain the honest controls there.
    if (activeRendering) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) return;
      // The map plate is its own modal; a dialog's inert background stops clicks and focus but
      // NOT document-level key handlers, so `S` with the map open stacked the source sheet on
      // top of the plate. The map owns the screen while it is up.
      if (document.querySelector("dialog.map-sheet[open]")) return;
      if (event.key !== "s" && event.key !== "S") return;
      event.preventDefault();
      // Focus the mark BEFORE opening: <dialog> restores focus to whatever was focused when it
      // opened, so this is what makes "focus returns to the ᵃ mark" true for the keyboard path
      // without hand-rolling any focus restoration.
      mark.current?.focus();
      setSourceOpen((open) => !open);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeRendering]);

  // The h1 has carried tabIndex={-1} since before this pass and nothing ever focused it.
  // Keyed on the CONCEPT, not the page key: the Next button survives reconciliation and keeps
  // focus, so keying this on every page turn would strip focus off Next on all eight pages. A
  // new idea earns the move; the next step of the same idea does not. Mouse users see no ring
  // — the outline is on :focus-visible, which programmatic focus does not trigger for them.
  useEffect(() => {
    if (!activeRendering) title.current?.focus();
  }, [activeRendering, concept.id]);

  if (activeRendering && resolveRendering) {
    return (
      <RenderingRoute
        concept={concept}
        rendering={activeRendering}
        otherRenderings={availableRenderings.filter(
          (rendering) => rendering.format !== activeRendering.format,
        )}
        resolveCitation={resolveRendering}
        selfExplanation={selfExplanation}
        selfExplanationAnswer={selfExplanationAnswer}
        onSelfExplanationChange={onSelfExplanationChange}
        nextLabel={nextLabel}
        onNext={onNext}
        onReturn={() => setActiveFormat(undefined)}
        onSelect={setActiveFormat}
      />
    );
  }

  return (
    <article className="lesson-page" aria-labelledby="lesson-title">
      <h1 id="lesson-title" ref={title} tabIndex={-1}>{titleFor(concept)}</h1>
      {/* The mark sits INSIDE the paragraph, hard against the final word — that is the whole
          point of a footnote mark. Rendered as a sibling element it would wrap to its own line
          and read as a button, which is what "Show the source" already was. */}
      <p className="lesson-text">
        {step.text}
        <FootnoteMark ref={mark} open={sourceOpen} onOpen={() => setSourceOpen(true)} />
      </p>

      {analogy && passion && (
        <aside className="analogy" aria-label="Optional analogy">
          <p className="analogy-label">{analogyVoices[passion]}</p>
          <p>{analogy}</p>
        </aside>
      )}

      <Citation
        resolved={resolved}
        stepText={step.text}
        open={sourceOpen}
        onOpen={() => setSourceOpen(true)}
        onClose={() => setSourceOpen(false)}
      />
      {availableRenderings.length > 0 && resolveRendering && (
        <section className="rendering-summon" aria-label="Another route through this idea">
          <p>Need another way into this idea?</p>
          <button
            className="text-button"
            type="button"
            onClick={() => setActiveFormat(
              availableRenderings.find((rendering) => rendering.format === "why-it-exists")
                ?.format ?? availableRenderings[0].format,
            )}
          >
            Try another way in
          </button>
        </section>
      )}
      <SelfExplanation
        question={selfExplanation}
        answer={selfExplanationAnswer}
        onAnswerChange={onSelfExplanationChange}
      />
      <button className="primary-button lesson-next" type="button" onClick={onNext}>
        {nextLabel}
      </button>
    </article>
  );
}
