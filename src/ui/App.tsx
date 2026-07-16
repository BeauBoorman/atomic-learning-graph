import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConceptId, Edge, EdgeType, LearningGraph } from "../types";
import { GraphMap } from "./GraphMap";
import { markUnderstood, pathFor, resolveLesson } from "./model";

interface AppProps {
  graph: LearningGraph;
}

type Theme = "light" | "dark";

const PROGRESS_KEY = "atomic-learning-graph.progress.v1";
const THEME_KEY = "atomic-learning-graph.theme.v1";

const edgeLabels: Record<EdgeType, { outgoing: string; incoming: string }> = {
  prereq: { outgoing: "Unlocks", incoming: "Requires" },
  method: { outgoing: "Method for", incoming: "Uses method" },
  related: { outgoing: "Related concept", incoming: "Related concept" },
};

function storedKnown(graph: LearningGraph): ConceptId[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = new Set(graph.concepts.map((concept) => concept.id));
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && ids.has(id)))];
  } catch {
    return [];
  }
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A private browser context can disable storage. The system theme is still a safe fallback.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function hasStoredTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark";
  } catch {
    return false;
  }
}

function revisionFor(url?: string): string {
  return url?.match(/[?&]oldid=(\d+)/)?.[1] ?? "Corpus snapshot";
}

function relationKey(edge: Edge): string {
  return `${edge.type}-${edge.from}-${edge.to}`;
}

function Passage({ passage, quote }: { passage: string; quote: string }) {
  const quoteIndex = passage.indexOf(quote);
  if (quoteIndex < 0) return <>{passage}</>;
  return (
    <>
      {passage.slice(0, quoteIndex)}
      <mark>{quote}</mark>
      {passage.slice(quoteIndex + quote.length)}
    </>
  );
}

export function App({ graph }: AppProps) {
  const initialPath = useMemo(() => pathFor(graph, []), [graph]);
  const [known, setKnown] = useState<ConceptId[]>(() => storedKnown(graph));
  const [selectedId, setSelectedId] = useState<ConceptId>(() => {
    const firstRemaining = pathFor(graph, storedKnown(graph))[0];
    return firstRemaining ?? graph.goalId;
  });
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [themeIsExplicit, setThemeIsExplicit] = useState(hasStoredTheme);
  const [announcement, setAnnouncement] = useState("");
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const graphSectionRef = useRef<HTMLElement>(null);
  const shortcutsRef = useRef<HTMLDialogElement>(null);

  const path = useMemo(() => pathFor(graph, known), [graph, known]);
  const lesson = useMemo(() => resolveLesson(graph, selectedId), [graph, selectedId]);
  const knownSet = useMemo(() => new Set(known), [known]);
  const currentId = path[0];
  const complete = path.length === 0;
  const completeCount = initialPath.filter((id) => knownSet.has(id)).length;
  const progressPercent = initialPath.length === 0
    ? 100
    : Math.round((completeCount / initialPath.length) * 100);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(known));
    } catch {
      // Progress remains available for the current visit when storage is unavailable.
    }
  }, [known]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (themeIsExplicit) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
      } catch {
        // The chosen theme still applies for the current visit.
      }
    }
  }, [theme, themeIsExplicit]);

  useEffect(() => {
    if (themeIsExplicit) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystemTheme = (event: MediaQueryListEvent) => setTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", followSystemTheme);
    return () => media.removeEventListener("change", followSystemTheme);
  }, [themeIsExplicit]);

  const selectConcept = useCallback((id: ConceptId, focusLesson = false) => {
    setSelectedId(id);
    const title = graph.concepts.find((concept) => concept.id === id)?.title ?? id;
    setAnnouncement(`${title} lesson selected.`);
    if (focusLesson) window.requestAnimationFrame(() => lessonHeadingRef.current?.focus());
  }, [graph]);

  const understandCurrent = useCallback(() => {
    if (!currentId) return;
    if (selectedId !== currentId) {
      selectConcept(currentId, true);
      return;
    }
    const completedTitle = graph.concepts.find((concept) => concept.id === currentId)?.title ?? currentId;
    const next = markUnderstood(graph, known, currentId);
    setKnown(next.known);
    setSelectedId(next.path[0] ?? graph.goalId);
    setAnnouncement(
      next.path.length === 0
        ? `${completedTitle} understood. Learning path complete.`
        : `${completedTitle} understood. Next: ${graph.concepts.find((concept) => concept.id === next.path[0])?.title ?? next.path[0]}.`,
    );
  }, [currentId, graph, known, selectConcept, selectedId]);

  const reset = () => {
    setKnown([]);
    setSelectedId(initialPath[0] ?? graph.goalId);
    setAnnouncement("Progress reset. Your route starts at the first concept.");
  };

  const toggleTheme = useCallback(() => {
    setThemeIsExplicit(true);
    setTheme((current) => current === "light" ? "dark" : "light");
  }, []);

  const continueLearning = useCallback(() => {
    const nextId = currentId ?? graph.goalId;
    selectConcept(nextId);
    document.getElementById("lesson-title")?.scrollIntoView({ block: "start" });
    window.requestAnimationFrame(() => lessonHeadingRef.current?.focus());
  }, [currentId, graph.goalId, selectConcept]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || shortcutsRef.current?.open) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "?") {
        shortcutsRef.current?.showModal();
      } else if (event.key.toLowerCase() === "g") {
        graphSectionRef.current?.querySelector<HTMLElement>(".graph-shell")?.focus();
      } else if (event.key.toLowerCase() === "l") {
        lessonHeadingRef.current?.focus();
      } else if (event.key.toLowerCase() === "n" && currentId) {
        selectConcept(currentId, true);
      } else if (event.key.toLowerCase() === "m" && currentId) {
        understandCurrent();
      } else if (event.key.toLowerCase() === "t") {
        toggleTheme();
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [currentId, selectConcept, toggleTheme, understandCurrent]);

  const connections = graph.edges.filter(
    (edge) => edge.from === selectedId || edge.to === selectedId,
  );
  const nextTitle = graph.concepts.find((concept) => concept.id === currentId)?.title;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to learning workspace</a>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Atomic Learning Graph home">
          <span className="wordmark-mark" aria-hidden="true">A·</span>
          <span>Atomic Learning Graph</span>
        </a>
        <nav className="header-actions" aria-label="Display and keyboard controls">
          <span className="status-pill" title="All lessons and route calculations run from the committed graph in this browser">
            <span className="status-dot" aria-hidden="true" />
            Offline reasoning
          </span>
          <button
            className="icon-button shortcut-button"
            type="button"
            onClick={() => shortcutsRef.current?.showModal()}
            aria-label="Show keyboard shortcuts"
          >
            <span aria-hidden="true">?</span><span className="button-label">Shortcuts</span>
          </button>
          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            aria-pressed={theme === "dark"}
          >
            <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
            <span className="button-label">{theme === "light" ? "Dark" : "Light"}</span>
          </button>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">A CALM PATH TO SELF-ATTENTION</p>
            <h1 id="hero-title">One concept.<br /><em>Then the next.</em></h1>
            <p className="lede">
              Learn at your own pace with a clear route, verified source passages, and no chat
              guesses. Your next step is always easy to find.
            </p>
            <button className="hero-action" type="button" onClick={continueLearning}>
              {complete ? "Review self-attention" : `Continue with ${nextTitle}`} <span aria-hidden="true">→</span>
            </button>
            <p className="hero-reassurance">No account · no timer · progress stays on this device</p>
          </div>
          <div className="hero-progress" aria-label={`${progressPercent}% of learning path complete`}>
            <div className="progress-orbit" style={{ "--progress": `${progressPercent * 3.6}deg` } as React.CSSProperties}>
              <div>
                <strong>{progressPercent}<span>%</span></strong>
                <small>{complete ? "Path complete" : `${path.length} left`}</small>
              </div>
            </div>
            <dl className="hero-metrics">
              <div><dt>Concepts</dt><dd>{graph.concepts.length}</dd></div>
              <div><dt>Relations</dt><dd>{graph.edges.length}</dd></div>
              <div><dt>Open sources</dt><dd>{graph.sources.length}</dd></div>
            </dl>
          </div>
        </section>

        <section className="learning-shell" aria-label="Learning workspace">
          <section className="map-panel" id="concept-map" ref={graphSectionRef} aria-labelledby="map-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">INTERACTIVE KNOWLEDGE GRAPH</p>
                <h2 id="map-title">{complete ? "You reached self-attention." : "Your route, made visible."}</h2>
                <p className="panel-intro">
                  Start with the five steps on your route. The wider map stays tucked away until
                  you choose to open it.
                </p>
              </div>
              <button className="text-button" type="button" onClick={reset} disabled={known.length === 0}>
                Reset progress
              </button>
            </div>

            <GraphMap
              graph={graph}
              selectedId={selectedId}
              currentId={currentId}
              path={path}
              initialPath={initialPath}
              known={known}
              theme={theme}
              onSelect={selectConcept}
            />

            <section className="route-alternative" id="graph-text-alternative" aria-labelledby="route-title">
              <div className="route-heading">
                <div>
                  <p className="eyebrow">ACCESSIBLE ROUTE VIEW</p>
                  <h3 id="route-title">{complete ? "All steps understood" : `Step ${completeCount + 1} of ${initialPath.length}`}</h3>
                </div>
                <span>{completeCount}/{initialPath.length} complete</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Learning path completion"
                aria-valuemin={0}
                aria-valuemax={initialPath.length}
                aria-valuenow={completeCount}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <ol className="route-list">
                {initialPath.map((id, index) => {
                  const concept = graph.concepts.find((candidate) => candidate.id === id);
                  if (!concept) return null;
                  const isKnown = knownSet.has(id);
                  const isCurrent = id === currentId;
                  return (
                    <li key={id} className={isKnown ? "is-known" : isCurrent ? "is-current" : ""}>
                      <button
                        type="button"
                        onClick={() => selectConcept(id, true)}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={`${index + 1}. ${concept.title}. ${isKnown ? "Understood" : isCurrent ? "Up next" : "Upcoming"}`}
                      >
                        <span className="route-number" aria-hidden="true">{isKnown ? "✓" : index + 1}</span>
                        <span><strong>{concept.title}</strong><small>{isKnown ? "Understood" : isCurrent ? "Up next" : "Upcoming"}</small></span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <details className="concept-directory">
                <summary>Browse every concept in the map</summary>
                <div>
                  {graph.concepts.map((concept) => (
                    <button
                      type="button"
                      key={concept.id}
                      onClick={() => selectConcept(concept.id, true)}
                      aria-pressed={selectedId === concept.id}
                    >
                      {knownSet.has(concept.id) ? "✓ " : ""}{concept.title}
                      {concept.id === graph.goalId ? " · Goal" : ""}
                    </button>
                  ))}
                </div>
              </details>
            </section>
          </section>

          <aside className="lesson-panel" aria-labelledby="lesson-title">
            <div className="lesson-sticky">
              <div className="lesson-kicker">
                <span>CONCEPT · {lesson.concept.id.toUpperCase()}</span>
                {knownSet.has(selectedId) && <span className="understood-badge">✓ Understood</span>}
              </div>
              <h2 id="lesson-title" ref={lessonHeadingRef} tabIndex={-1}>{lesson.concept.title}</h2>
              <p className="summary">{lesson.concept.summary}</p>
              <ul className="tag-list" aria-label="Concept tags">
                {lesson.concept.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>

              <article className="source-card" aria-labelledby="source-card-title">
                <header className="source-label">
                  <span id="source-card-title">VERIFIED SOURCE PASSAGE</span>
                  <span className="verified"><span aria-hidden="true">◆</span> Quote match</span>
                </header>
                <blockquote>
                  <Passage passage={lesson.passage} quote={lesson.concept.provenance.quotedText} />
                </blockquote>
                <details className="source-context">
                  <summary>Expand surrounding source context</summary>
                  <div className="context-copy">{lesson.context}</div>
                </details>
                <dl className="provenance-grid" aria-label="Source provenance">
                  <div><dt>Source</dt><dd>{lesson.source.title}</dd></div>
                  <div><dt>Licence</dt><dd>{lesson.source.license}</dd></div>
                  <div><dt>Pinned revision</dt><dd>{revisionFor(lesson.source.url)}</dd></div>
                  <div><dt>Source ID</dt><dd>{lesson.source.id}</dd></div>
                </dl>
              </article>

              <section className="relations" aria-labelledby="connections-title">
                <div className="section-title-row">
                  <h3 id="connections-title">Typed connections</h3>
                  <span>{connections.length} total</span>
                </div>
                <div className="relation-list">
                  {connections.map((edge) => {
                    const outgoing = edge.from === selectedId;
                    const otherId = outgoing ? edge.to : edge.from;
                    const other = graph.concepts.find((concept) => concept.id === otherId);
                    return (
                      <button key={relationKey(edge)} type="button" onClick={() => selectConcept(otherId, true)}>
                        <span className={`relation-type ${edge.type}`}>{outgoing ? edgeLabels[edge.type].outgoing : edgeLabels[edge.type].incoming}</span>
                        <strong>{other?.title ?? otherId}</strong>
                        <span aria-hidden="true">↗</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className={`lesson-action ${complete ? "is-complete" : ""}`}>
                {complete && <p className="complete-message"><span aria-hidden="true">✓</span> Goal reached. Your progress is saved on this device.</p>}
                <button className="primary-button" type="button" onClick={complete ? reset : understandCurrent}>
                  {complete
                    ? <>Review from the beginning <span aria-hidden="true">↺</span></>
                    : selectedId === currentId
                      ? <>Mark “{nextTitle}” understood <span aria-hidden="true">→</span></>
                      : <>Continue with “{nextTitle}” <span aria-hidden="true">→</span></>}
                </button>
                <p className="button-note">
                  {complete
                    ? "Reset progress whenever you want to walk the graph again."
                    : "Saved locally, then the deterministic route is recomputed."}
                </p>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <footer className="site-footer">
        <span>Built from open educational resources.</span>
        <span>Committed graph · deterministic path · no request-time AI</span>
      </footer>

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      <dialog className="shortcuts-dialog" ref={shortcutsRef} aria-labelledby="shortcuts-title">
        <form method="dialog">
          <div className="dialog-heading">
            <div><p className="eyebrow">MOVE AT YOUR SPEED</p><h2 id="shortcuts-title">Keyboard shortcuts</h2></div>
            <button className="icon-button" value="close" aria-label="Close keyboard shortcuts">×</button>
          </div>
          <dl>
            <div><dt><kbd>G</kbd></dt><dd>Focus the graph</dd></div>
            <div><dt><kbd>L</kbd></dt><dd>Focus the lesson</dd></div>
            <div><dt><kbd>N</kbd></dt><dd>Open the next concept</dd></div>
            <div><dt><kbd>M</kbd></dt><dd>Mark the current concept understood</dd></div>
            <div><dt><kbd>T</kbd></dt><dd>Toggle light or dark theme</dd></div>
            <div><dt><kbd>?</kbd></dt><dd>Show this shortcut guide</dd></div>
          </dl>
          <p>Inside the graph: use arrow keys to select nodes, <kbd>+</kbd>/<kbd>−</kbd> to zoom, and <kbd>0</kbd> to fit.</p>
        </form>
      </dialog>
    </>
  );
}
