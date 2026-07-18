import type { ConceptId, LearningGraph } from "../types";
import { titleFor } from "./titles";

interface CompletionPageProps {
  graph: LearningGraph;
  goalId: ConceptId;
  route: ConceptId[];
  onRestart: () => void;
}

export function CompletionPage({ graph, goalId, route, onRestart }: CompletionPageProps) {
  const concepts = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const goal = concepts.get(goalId);
  if (!goal) throw new Error(`missing completion goal: ${goalId}`);
  const routeTitles = route.map((id) => {
    const concept = concepts.get(id);
    if (!concept) throw new Error(`missing completion concept: ${id}`);
    return titleFor(concept);
  });

  return (
    <main className="completion-page" id="main-content" aria-labelledby="completion-title">
      <p className="completion-mark" aria-hidden="true">✓</p>
      <p className="eyebrow">You reached your goal</p>
      <h1 id="completion-title">Course complete</h1>
      <p className="completion-route">
        You can now approach {titleFor(goal)} because you worked through {routeTitles.join(" → ")}.
      </p>
      <button className="text-button" type="button" onClick={onRestart}>Start over</button>
    </main>
  );
}
