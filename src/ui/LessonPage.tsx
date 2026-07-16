import { useEffect, useRef, useState } from "react";
import type { Concept, LessonStep, PassionId } from "../types";
import { Citation, FootnoteMark } from "./Citation";
import type { ResolvedPassage } from "./model";
import { titleFor } from "./titles";

interface LessonPageProps {
  concept: Concept;
  step: LessonStep;
  resolved: ResolvedPassage;
  passion?: PassionId;
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

export function LessonPage({
  concept,
  step,
  resolved,
  passion,
  nextLabel,
  onNext,
}: LessonPageProps) {
  const analogy = passion ? step.analogies?.[passion] : undefined;
  const title = useRef<HTMLHeadingElement>(null);
  const mark = useRef<HTMLButtonElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  // A summoned sheet must never outlive the claim it backs. Without this, turning the page with
  // the sheet open leaves page 4's source sitting over page 5's lesson — a wrong receipt, which
  // on this project is the only unsurvivable kind of bug.
  //
  // Keyed on step.TEXT, not on the `step` object. Today App.tsx reads steps straight off the
  // module-level graph so their identity is stable, but that is an assumption this file cannot
  // enforce: the day anyone maps or clones the step list, an identity dep fires on EVERY render
  // and the sheet slams shut the instant it opens. A primitive cannot rot that way.
  useEffect(() => setSourceOpen(false), [concept.id, step.text]);

  // `S` summons the source. Bound here rather than in App.tsx because the source belongs to the
  // step, and the state that owns it is this component's.
  // INTEGRATION NOTE: §4.4 puts the keymap on `document` in App.tsx (S source · M map · →/Space
  // next · Esc dismiss). Whoever builds that map must NOT also bind `S`, or it toggles twice and
  // nets to nothing. Esc is already handled — natively, by the dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? "")) return;
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
  }, []);

  // The h1 has carried tabIndex={-1} since before this pass and nothing ever focused it.
  // Keyed on the CONCEPT, not the page key: the Next button survives reconciliation and keeps
  // focus, so keying this on every page turn would strip focus off Next on all eight pages. A
  // new idea earns the move; the next step of the same idea does not. Mouse users see no ring
  // — the outline is on :focus-visible, which programmatic focus does not trigger for them.
  useEffect(() => {
    title.current?.focus();
  }, [concept.id]);

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
      <button className="primary-button lesson-next" type="button" onClick={onNext}>
        {nextLabel}
      </button>
    </article>
  );
}
