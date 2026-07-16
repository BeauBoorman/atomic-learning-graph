import type { CourseProgress } from "./model";

export function StepIndicator({ progress }: { progress: CourseProgress }) {
  const pageNumber = Math.min(progress.total, progress.completeCount + 1);
  return (
    <div className="step-indicator" aria-label="Course progress">
      <div className="step-copy">
        <span>Page {pageNumber} of {progress.total}</span>
        <span>{progress.percent}% complete</span>
      </div>
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
