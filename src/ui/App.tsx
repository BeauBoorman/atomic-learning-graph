import { useMemo, useState } from "react";
import type { ConceptId, EdgeType, LearningGraph } from "../types";
import { markUnderstood, pathFor, resolveLesson } from "./model";

interface AppProps {
  graph: LearningGraph;
}

const edgeLabels: Record<EdgeType, string> = {
  prereq: "prerequisite for",
  method: "method for",
  related: "related to",
};

export function App({ graph }: AppProps) {
  const [known, setKnown] = useState<ConceptId[]>([]);
  const initialPath = useMemo(() => pathFor(graph, []), [graph]);
  const [selectedId, setSelectedId] = useState<ConceptId>(
    initialPath[0] ?? graph.goalId,
  );
  const path = useMemo(() => pathFor(graph, known), [graph, known]);
  const lesson = useMemo(() => resolveLesson(graph, selectedId), [graph, selectedId]);
  const pathSet = useMemo(() => new Set(path), [path]);
  const knownSet = useMemo(() => new Set(known), [known]);
  const currentId = path[0];
  const complete = path.length === 0;

  const understandCurrent = () => {
    if (!currentId) return;
    if (selectedId !== currentId) {
      setSelectedId(currentId);
      return;
    }
    const next = markUnderstood(graph, known, currentId);
    setKnown(next.known);
    setSelectedId(next.path[0] ?? graph.goalId);
  };

  const reset = () => {
    setKnown([]);
    setSelectedId(initialPath[0] ?? graph.goalId);
  };

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Atomic Learning Graph home">
          <span className="wordmark-mark" aria-hidden="true">A</span>
          <span>Atomic Learning Graph</span>
        </a>
        <div className="status-pill">
          <span className="status-dot" aria-hidden="true" />
          Offline reasoning
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">OPEN EDUCATION · VERIFIED SOURCES</div>
        <h1>Understand self-attention,<br />one dependency at a time.</h1>
        <p className="lede">
          A generated concept map, checked by hard invariants. Your route is a
          deterministic walk through the committed graph—not a chat response.
        </p>
        <div className="hero-metrics" aria-label="Graph facts">
          <span><strong>{graph.concepts.length}</strong> concepts</span>
          <span><strong>{graph.edges.length}</strong> relationships</span>
          <span><strong>{graph.sources.length}</strong> open sources</span>
        </div>
      </section>

      <section className="workspace" aria-label="Learning workspace">
        <div className="map-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">YOUR ROUTE</div>
              <h2>{complete ? "Path complete" : `${path.length} concepts to go`}</h2>
            </div>
            <button className="text-button" type="button" onClick={reset} disabled={known.length === 0}>
              Reset progress
            </button>
          </div>

          <ol className="route" aria-label="Ordered learning path">
            {initialPath.map((id, index) => {
              const concept = graph.concepts.find((candidate) => candidate.id === id);
              if (!concept) return null;
              const isKnown = knownSet.has(id);
              const isCurrent = id === currentId;
              return (
                <li key={id} className={isKnown ? "is-known" : isCurrent ? "is-current" : ""}>
                  <button type="button" onClick={() => setSelectedId(id)} aria-current={isCurrent ? "step" : undefined}>
                    <span className="route-number">{isKnown ? "✓" : String(index + 1).padStart(2, "0")}</span>
                    <span className="route-copy">
                      <strong>{concept.title}</strong>
                      <small>{isKnown ? "Understood" : isCurrent ? "Up next" : "Locked in sequence"}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="graph-heading">
            <div className="eyebrow">FULL MAP</div>
            <span>Path nodes are highlighted</span>
          </div>
          <div className="concept-grid">
            {graph.concepts.map((concept) => {
              const relationCount = graph.edges.filter(
                (edge) => edge.from === concept.id || edge.to === concept.id,
              ).length;
              return (
                <button
                  key={concept.id}
                  type="button"
                  className={`concept-card ${pathSet.has(concept.id) ? "on-path" : ""} ${knownSet.has(concept.id) ? "known" : ""} ${selectedId === concept.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(concept.id)}
                >
                  <span className="node-dot" aria-hidden="true" />
                  <strong>{concept.title}</strong>
                  <small>{relationCount} {relationCount === 1 ? "connection" : "connections"}</small>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="lesson-panel" aria-live="polite">
          <div className="lesson-index">CONCEPT / {lesson.concept.id.toUpperCase()}</div>
          <h2>{lesson.concept.title}</h2>
          <p className="summary">{lesson.concept.summary}</p>

          <div className="source-card">
            <div className="source-label">
              <span>VERIFIED SOURCE PASSAGE</span>
              <span className="verified">✓ QUOTE MATCH</span>
            </div>
            <blockquote>{lesson.concept.provenance.quotedText}</blockquote>
            <details>
              <summary>Read surrounding source context</summary>
              <p>{lesson.context}</p>
            </details>
            <footer>
              <span>{lesson.source.title}</span>
              <span>{lesson.source.license}</span>
            </footer>
          </div>

          <div className="relations">
            <h3>Connections</h3>
            {graph.edges
              .filter((edge) => edge.from === selectedId || edge.to === selectedId)
              .slice(0, 5)
              .map((edge) => {
                const outgoing = edge.from === selectedId;
                const otherId = outgoing ? edge.to : edge.from;
                const other = graph.concepts.find((concept) => concept.id === otherId);
                return (
                  <button key={`${edge.from}-${edge.to}-${edge.type}`} type="button" onClick={() => setSelectedId(otherId)}>
                    <span>{outgoing ? edgeLabels[edge.type] : `depends via ${edge.type}`}</span>
                    <strong>{other?.title ?? otherId}</strong>
                  </button>
                );
              })}
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={understandCurrent}
            disabled={complete}
          >
            {complete
              ? "Goal reached"
              : selectedId === currentId
                ? "Mark understood →"
                : `Return to ${graph.concepts.find((concept) => concept.id === currentId)?.title ?? "next concept"}`}
          </button>
          <p className="button-note">
            {complete
              ? "Every required concept is now in your understood set."
              : "Recomputes the path locally from your understood concepts."}
          </p>
        </aside>
      </section>

      <footer className="site-footer">
        <span>Built from open educational resources.</span>
        <span>No account · no grades · no request-time AI</span>
      </footer>
    </main>
  );
}
