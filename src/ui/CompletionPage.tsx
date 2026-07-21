import type { ConceptId, LearningGraph } from "../types";
import { pathFor } from "./model";
import { titleFor } from "./titles";

interface CompletionPageProps {
  graph: LearningGraph;
  goalId: ConceptId;
  route: ConceptId[];
  selfExplanations?: Array<{ id: string; prompt: string; answer: string }>;
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

  const handleExport = () => {
    const goalTitle = goal ? titleFor(goal) : "Learning Goal";
    let markdown = `# Learning Notes: ${goalTitle}\n\n`;
    markdown += `*Path completed: ${routeTitles.join(" → ")}*\n\n`;
    markdown += `## Concept Recollection & Reflection\n\n`;

    route.forEach((id, index) => {
      const c = concepts.get(id);
      if (!c) return;
      markdown += `### ${index + 1}. ${titleFor(c)}\n`;
      markdown += `**Summary:** ${c.summary}\n\n`;

      // Match written explanation if any
      const matchingExplanation = selfExplanations.find((e) =>
        e.prompt.toLowerCase().includes(titleFor(c).toLowerCase())
      );
      if (matchingExplanation) {
        markdown += `**My Reflection:**\n> ${matchingExplanation.answer}\n\n`;
      }

      markdown += `---\n\n`;
    });

    markdown += `Generated offline by Atomic Learning.`;

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${goalId}-learning-notes.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Goals the learner could actually start from what they now know: every prerequisite
  // (transitive, via getPath) must already be in the completed route. The old shape listed
  // every off-spine concept and promised the route "recomputes from everything you just
  // learned" — false for goals whose prereqs lie partly off-route.
  const unexplored = graph.concepts.filter((concept) => {
    if (routeSet.has(concept.id)) return false;
    const ancestors = pathFor(graph, concept.id, []).filter((id) => id !== concept.id);
    return ancestors.every((id) => routeSet.has(id));
  });
  const hasMore = unexplored.length > 0;

  return (
    <main className="completion-page" id="main-content" aria-labelledby="completion-title">
      <p className="completion-mark" aria-hidden="true">✓</p>
      <p className="eyebrow">Course complete</p>
      <h1 id="completion-title">You reached your goal.</h1>
      <p className="completion-route-summary">
        You have completed your learning path and are ready to apply <strong>{titleFor(goal)}</strong>.
      </p>
      <div className="completed-path-section">
        <h2 className="path-section-title">Your completed path</h2>
        <ol className="completed-path-list">
          {route.map((id, idx) => {
            const isGoalConcept = id === goalId;
            const c = concepts.get(id);
            if (!c) return null;
            return (
              <li key={id} className={`completed-path-item${isGoalConcept ? " is-goal" : ""}`}>
                <span className="step-num">{idx + 1}</span>
                <span className="step-name">{titleFor(c)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {writtenExplanations.length > 0 && (
        <details className="self-explanation-recap" open>
          <summary>What you wrote</summary>
          <h2>What you wrote at each step</h2>
          <dl>
            {writtenExplanations.map(({ id, prompt, answer }) => (
              <div key={id}>
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
          <p>Pick a new goal and we'll route to it from what you just learned.</p>
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
      <div className="completion-actions">
        <button className="primary-button export-notes-button" type="button" onClick={handleExport}>
          Export my notes (.md)
        </button>
        <button className="text-button" type="button" onClick={onRestart}>
          Start over
        </button>
      </div>
    </main>
  );
}
