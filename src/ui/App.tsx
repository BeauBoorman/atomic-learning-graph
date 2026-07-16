import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConceptId, LearningGraph, PassionId } from "../types";
import { PASSION_IDS } from "../types";
import { CompletionPage } from "./CompletionPage";
import { Entry } from "./Entry";
import { LessonPage } from "./LessonPage";
import { MapToggle } from "./MapToggle";
import { StepIndicator } from "./StepIndicator";
import {
  courseFor,
  coursePageKey,
  DEEPDIVES_KEY,
  deriveProgress,
  markUnderstood,
  resolveCitation,
  type CoursePage,
  type CourseProgress,
  type Depth,
} from "./model";

interface AppProps {
  graph: LearningGraph;
}

type Theme = "light" | "dark";

// v2: the graph was rebuilt (new d2l corpus, new concept ids, lesson steps). Progress saved
// against the OLD graph is meaningless but its ids still resolve, so it silently marked
// concepts "known" and dropped returning learners into the middle of a course. Bumping the
// key retires that stale state instead of honouring it.
const PROGRESS_KEY = "atomic-learning-graph.progress.v2";
const THEME_KEY = "atomic-learning-graph.theme.v1";
const PASSION_KEY = "atomic-learning-graph.passion.v1";

function storedIds(key: string, allowed?: Set<string>): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter(
      (value): value is string => typeof value === "string" && (!allowed || allowed.has(value)),
    ))];
  } catch {
    return [];
  }
}

function storedKnown(graph: LearningGraph): ConceptId[] {
  return storedIds(PROGRESS_KEY, new Set(graph.concepts.map((concept) => concept.id)));
}

function storedPassion(): PassionId | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(PASSION_KEY);
    return PASSION_IDS.find((passion) => passion === value);
  } catch {
    return undefined;
  }
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Continue with the system preference when storage is unavailable.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function hasStoredTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return ["light", "dark"].includes(window.localStorage.getItem(THEME_KEY) ?? "");
  } catch {
    return false;
  }
}

function uniqueConcepts(pages: CoursePage[]): ConceptId[] {
  return [...new Set(pages.map((page) => page.conceptId))];
}

interface CourseScreenProps {
  graph: LearningGraph;
  goalId: ConceptId;
  depth: Depth;
  passion?: PassionId;
  known: ConceptId[];
  theme: Theme;
  progress: CourseProgress;
  onNext: () => void;
  onRestart: () => void;
}

/** Pure course boundary used by the progress regression test. */
export function CourseScreen({
  graph,
  goalId,
  depth,
  passion,
  known,
  theme,
  progress,
  onNext,
  onRestart,
}: CourseScreenProps) {
  if (progress.complete) return <CompletionPage onRestart={onRestart} />;
  const page = progress.remaining[0];
  if (!page) return null;
  const concept = graph.concepts.find((candidate) => candidate.id === page.conceptId);
  const step = concept?.lesson?.steps[page.stepIndex];
  if (!concept || !step) throw new Error(`missing course page: ${coursePageKey(page)}`);

  const initialPages = courseFor(graph, goalId, depth, []);
  const path = uniqueConcepts(progress.remaining);
  const nextLabel = progress.remaining.length === 1
    ? "Finish course"
    : progress.remaining.some(
      (candidate, index) => index > 0 && candidate.conceptId === page.conceptId,
    )
      ? "Next page"
      : "Next idea";

  return (
    <main className="course" id="main-content">
      <StepIndicator progress={progress} />
      <LessonPage
        concept={concept}
        step={step}
        resolved={resolveCitation(graph, page.conceptId, page.stepIndex)}
        passion={passion}
        nextLabel={nextLabel}
        onNext={onNext}
      />
      <MapToggle
        graph={graph}
        goalId={goalId}
        currentId={page.conceptId}
        path={path}
        initialPath={uniqueConcepts(initialPages)}
        known={known}
        theme={theme}
      />
    </main>
  );
}

export function App({ graph }: AppProps) {
  const [started, setStarted] = useState(false);
  const [goalId, setGoalId] = useState<ConceptId>(graph.goalId);
  const [depth, setDepth] = useState<Depth>("quick");
  const [passion, setPassion] = useState<PassionId | undefined>(storedPassion);
  const [known, setKnown] = useState<ConceptId[]>(() => storedKnown(graph));
  const [deepDivePages, setDeepDivePages] = useState<string[]>(() => storedIds(DEEPDIVES_KEY));
  const [sessionPages, setSessionPages] = useState<string[]>([]);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [themeIsExplicit, setThemeIsExplicit] = useState(hasStoredTheme);
  const [announcement, setAnnouncement] = useState("");

  const completedPages = useMemo(
    () => [...new Set([...deepDivePages, ...sessionPages])],
    [deepDivePages, sessionPages],
  );
  const progress = useMemo(
    () => deriveProgress(graph, known, goalId, depth, completedPages),
    [completedPages, depth, goalId, graph, known],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(known));
    } catch {
      // Progress remains available for this visit.
    }
  }, [known]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEEPDIVES_KEY, JSON.stringify(deepDivePages));
    } catch {
      // Deep-dive progress remains available for this visit.
    }
  }, [deepDivePages]);

  useEffect(() => {
    try {
      if (passion) window.localStorage.setItem(PASSION_KEY, passion);
      else window.localStorage.removeItem(PASSION_KEY);
    } catch {
      // The optional analogy choice still applies for this visit.
    }
  }, [passion]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (!themeIsExplicit) return;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The selected theme still applies for this visit.
    }
  }, [theme, themeIsExplicit]);

  useEffect(() => {
    if (themeIsExplicit) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystem = (event: MediaQueryListEvent) => setTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, [themeIsExplicit]);

  // Every page is a NEW page — put the learner at the top of it.
  // Without this the SPA kept the previous scroll offset: "Start learning" and "Next page"
  // both sit below the fold, so each lesson opened mid-sentence and the analogy floated
  // next to text it did not belong to. One clear thing at a time starts at its beginning.
  const currentPage = progress.remaining[0];
  const currentPageKey = currentPage
    ? `${currentPage.conceptId}#${currentPage.stepIndex}`
    : "complete";
  useEffect(() => {
    // "instant", not "auto": the page sets CSS scroll-behavior:smooth, and "auto" defers to
    // that — the animated scroll then loses to the content swap and strands the learner
    // mid-page. An instant jump is also the calmer, reduced-motion-friendly behaviour.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPageKey, started]);

  const handleNext = useCallback(() => {
    const page = progress.remaining[0];
    if (!page) return;
    const key = coursePageKey(page);
    const spineIds = new Set(
      courseFor(graph, goalId, "quick", []).map((candidate) => candidate.conceptId),
    );
    const currentStep = graph.concepts
      .find((concept) => concept.id === page.conceptId)
      ?.lesson?.steps[page.stepIndex];
    const isCoreSpinePage = spineIds.has(page.conceptId) && currentStep?.stepTier === "core";
    const anotherCorePageForConcept = progress.remaining.some(
      (candidate, index) => index > 0
        && candidate.conceptId === page.conceptId
        && graph.concepts
          .find((concept) => concept.id === candidate.conceptId)
          ?.lesson?.steps[candidate.stepIndex]?.stepTier === "core",
    );

    if (isCoreSpinePage) {
      setSessionPages((current) => current.includes(key) ? current : [...current, key]);
      if (!anotherCorePageForConcept) {
        const next = markUnderstood(graph, goalId, known, page.conceptId);
        setKnown(next.known);
      }
    } else {
      setDeepDivePages((current) => current.includes(key) ? current : [...current, key]);
    }
    setAnnouncement(
      progress.remaining.length === 1 ? "Final page finished." : "Next lesson page ready.",
    );
  }, [goalId, graph, known, progress.remaining]);

  const chooseCourse = () => {
    setStarted(false);
    setSessionPages([]);
    setAnnouncement("Choose a learning goal.");
  };

  const updateGoal = (nextGoal: ConceptId) => {
    setGoalId(nextGoal);
    setSessionPages([]);
  };

  const updateDepth = (nextDepth: Depth) => {
    setDepth(nextDepth);
    setSessionPages([]);
  };

  const currentThemeName = theme === "light" ? "Light" : "Dark";
  const nextThemeName = theme === "light" ? "dark" : "light";

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to the lesson</a>
      <header className="masthead">
        <button className="wordmark" type="button" onClick={chooseCourse}>
          <span className="wordmark-mark" aria-hidden="true">A·</span>
          <span>Atomic Learning</span>
        </button>
        <div className="header-actions">
          {started && (
            <button className="text-button" type="button" onClick={chooseCourse}>Change course</button>
          )}
          <button
            className="theme-button"
            type="button"
            onClick={() => {
              setThemeIsExplicit(true);
              setTheme(nextThemeName);
            }}
            aria-label={`Current theme: ${currentThemeName}. Switch to ${nextThemeName} theme.`}
          >
            <span aria-hidden="true">{theme === "light" ? "☀" : "☾"}</span>
            <span>{currentThemeName}</span>
          </button>
        </div>
      </header>

      {started ? (
        <CourseScreen
          graph={graph}
          goalId={goalId}
          depth={depth}
          passion={passion}
          known={known}
          theme={theme}
          progress={progress}
          onNext={handleNext}
          onRestart={chooseCourse}
        />
      ) : (
        <Entry
          graph={graph}
          goalId={goalId}
          depth={depth}
          passion={passion}
          onGoalChange={updateGoal}
          onDepthChange={updateDepth}
          onPassionChange={setPassion}
          onStart={() => {
            setSessionPages([]);
            setStarted(true);
            setAnnouncement("Your first lesson is ready.");
          }}
        />
      )}

      <p className="sr-only" aria-live="polite">{announcement}</p>
      <footer>Built from an openly licensed graph. Lessons run without a request-time AI call.</footer>
    </>
  );
}
