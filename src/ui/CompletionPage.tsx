import type { ConceptId, LearningGraph } from "../types";
import { titleFor } from "./titles";

interface CompletionPageProps {
  graph: LearningGraph;
  goalId: ConceptId;
  route: ConceptId[];
  selfExplanations?: Array<{ prompt: string; answer: string }>;
  onRestart: () => void;
  onGoalChange: (goalId: ConceptId) => void;
}

export function CompletionPage({
  graph,
  goalId,
  route,
  selfExplanations = [],
  onRestart,
  onGoalChange,
}: CompletionPageProps) {
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const goal = concepts.get(goalId);
  if (!goal) throw new Error(`missing completion goal: ${goalId}`);
  const routeSet = new Set(route);
  const routeTitles = route.map((id) => {
    const concept = concepts.get(id);
    if (!concept) throw new Error(`missing completion concept: ${id}`);
    return titleFor(concept);
  });
  const writtenExplanations = selfExplanations.filter(({ answer }) => answer.trim().length > 0);

  // Concepts not on this route — the rest of the graph the learner can explore.
  const unexplored = graph.concepts.filter((concept) => !routeSet.has(concept.id));
  const hasMore = unexplored.length > 0;

  return (
    <main className="completion-page" id="main-content" aria-labelledby="completion-title">
      <p className="completion-mark" aria-hidden="true">✓</p>
      <p className="eyebrow">You reached your goal</p>
      <h1 id="completion-title">Nice work.</h1>
      <p className="completion-route">
        You can now approach {titleFor(goal)} because you worked through {routeTitles.join(" → ")}.
      </p>
      {writtenExplanations.length > 0 && (
        <details className="self-explanation-recap" open>
          <summary>What you wrote</summary>
          <h2>The thread you wrote through these ideas</h2>
          <dl>
            {writtenExplanations.map(({ prompt, answer }) => (
              <div key={prompt}>
                <dt>{prompt}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {hasMore && (
        <details className="explore-more" open>
          <summary>Keep going — {unexplored.length} more idea{unexplored.length === 1 ? "" : "s"} to explore</summary>
          <p>Pick a new goal and the route recomputes from everything you just learned.</p>
          <ul className="explore-more-list">
            {unexplored.map((concept) => (
              <li key={concept.id}>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => onGoalChange(concept.id)}
                >
                  {titleFor(concept)}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <button className="text-button" type="button" onClick={onRestart}>Start over</button>
    </main>
  );
}
