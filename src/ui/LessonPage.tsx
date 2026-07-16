import type { Concept, LessonStep, PassionId } from "../types";
import { Citation } from "./Citation";
import type { ResolvedPassage } from "./model";

interface LessonPageProps {
  concept: Concept;
  step: LessonStep;
  resolved: ResolvedPassage;
  passion?: PassionId;
  nextLabel: string;
  onNext: () => void;
}

export function LessonPage({
  concept,
  step,
  resolved,
  passion,
  nextLabel,
  onNext,
}: LessonPageProps) {
  const analogy = passion ? step.analogies?.[passion] : undefined;
  return (
    <article className="lesson-page" aria-labelledby="lesson-title">
      <p className="eyebrow">One idea</p>
      <h1 id="lesson-title" tabIndex={-1}>{concept.lesson?.plainTitle ?? concept.title}</h1>
      <p className="lesson-text">{step.text}</p>

      {analogy && (
        <aside className="analogy" aria-label="Optional analogy">
          <p className="analogy-label">Think of it like… <span>(analogy)</span></p>
          <p>{analogy}</p>
        </aside>
      )}

      <Citation resolved={resolved} />
      <button className="primary-button lesson-next" type="button" onClick={onNext}>
        {nextLabel}
      </button>
    </article>
  );
}
