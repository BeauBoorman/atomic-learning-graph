import type { CourseProgress } from "./model";

export function StepIndicator({ progress }: { progress: CourseProgress }) {
  const pageNumber = Math.min(progress.total, progress.completeCount + 1);
  const current = progress.remaining[0];

  // Eight pages carry only five distinct h1s — pages 2, 4 and 8 repeat the headline directly
  // above them, which reads as a broken app rather than as the second part of one idea. This
  // names the part so the repeat is legible as structure.
  //
  // Derived from the COURSE's page list, never from `concept.lesson.steps.length`: that counts
  // deep steps quick mode will not render, so it would print "Part 1 of 4" and then jump to the
  // end of the course. `progress.pages` is the same list the folio number counts, so the two
  // readouts cannot disagree.
  const siblings = current
    ? progress.pages.filter((page) => page.conceptId === current.conceptId)
    : [];
  const partIndex = current
    ? siblings.findIndex((page) => page.stepIndex === current.stepIndex)
    : -1;
  const part = siblings.length > 1 && partIndex >= 0
    ? `Part ${partIndex + 1} of ${siblings.length}`
    : "";

  return (
    <div className="step-indicator">
      <p className="folio">
        <span>{part}</span>
        <span>Page {pageNumber} of {progress.total}</span>
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Pages completed"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={progress.completeCount}
      >
        <span style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
