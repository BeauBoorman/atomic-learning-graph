import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConceptId, LearningGraph, PassionId } from "../types";
import { PASSION_IDS } from "../types";
import { CompletionPage } from "./CompletionPage";
import { Entry } from "./Entry";
import { LessonPage } from "./LessonPage";
import { MapToggle } from "./MapToggle";
import { StepIndicator } from "./StepIndicator";
import {
  coursePageKey,
  deriveProgress,
  knownForGoal,
  resolveCitation,
  understoodConcepts,
  type CoursePage,
  type CourseProgress,
  type Depth,
} from "./model";
import { titleFor } from "./titles";

interface AppProps {
  graph: LearningGraph;
}

type Theme = "light" | "dark";

// v4: progress is COMPLETED PAGE KEYS, scoped to goal + depth + the learner's fixed entry-screen
// declaration. v1/v2 stored a global
// known-concept list with no course scope, so finishing one course silently marked five
// other goals complete. That is not migratable — "you knew this" and "you read this" were
// never distinguishable in the old shape — so the old keys are retired, not converted.
const COURSE_KEY = "atomic-learning-graph.course.v4";
/** Exported for the scoping regression test: cross-course contamination is prevented HERE and
 *  nowhere else. `deriveProgress` is course-pure but page keys overlap between courses, so the
 *  storage key is the only thing that stops course A's pages being read as course B's. */
export const courseKey = (
  goalId: ConceptId,
  depth: Depth,
  known: ConceptId[] = [],
) => {
  const declaration = encodeURIComponent(JSON.stringify([...new Set(known)].sort()));
  return `${COURSE_KEY}:${encodeURIComponent(goalId)}:${depth}:${declaration}`;
};

const LEGACY_KEYS = [
  "atomic-learning-graph.progress.v1", // orphaned by the .v2 bump; still on real machines
  "atomic-learning-graph.progress.v2", // the leak that produced "Page 3 of 8"
  "atomic-learning-graph.deep-dives.v1", // equally unscoped; same class of leak
];
const LEGACY_COURSE_PREFIXES = ["atomic-learning-graph.course.v3:"];

// The .v2 bump reset the value once and left the bug dormant. The v3 page-key shape was sound,
// but it had no declaration in its identity and therefore cannot be migrated to v4 safely.
// Retire every predecessor instead of guessing which declaration an old course belonged to.
function retireLegacyProgress() {
  if (typeof window === "undefined") return;
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
    const storedKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    ).filter((key): key is string => key !== null);
    for (const key of storedKeys) {
      if (LEGACY_COURSE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Nothing to retire.
  }
}

const THEME_KEY = "atomic-learning-graph.theme.v1";
const PASSION_KEY = "atomic-learning-graph.passion.v1";

/** A page key that is not in this course is inert — `deriveProgress` only ever counts keys it
 *  finds IN the course — so nothing here needs to know the graph to be safe. */
function storedPages(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string => typeof value === "string"))];
  } catch {
    return [];
  }
}

function savePages(key: string, pages: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(pages));
  } catch {
    // Progress remains available for this visit.
  }
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

/** The completed pages and the course they belong to are ONE value, never two.
 *  Held apart, the save effect fires once mid-switch holding course A's pages and course B's
 *  key — writing A's progress into B. That is the same leak the v3 key retires, one frame wide
 *  instead of forever. Married, a page key cannot reach the wrong course's storage at all. */
interface CourseState {
  key: string;
  pages: string[];
}

/** A stable empty list: a fresh `[]` each render would churn every downstream useMemo. */
const NO_PAGES: string[] = [];

/** aria-live announces only when the text NODE changes. The old string was byte-identical on
 *  pages 2 through 7, so React bailed on Object.is and six of eight page turns announced
 *  nothing. Naming the page and the lesson is unique by construction, and says the same thing
 *  the step indicator shows sighted learners. */
function pageAnnouncement(
  graph: LearningGraph,
  page: CoursePage,
  pageNumber: number,
  total: number,
): string {
  const concept = graph.concepts.find((candidate) => candidate.id === page.conceptId);
  return `Page ${pageNumber} of ${total}: ${concept ? titleFor(concept) : page.conceptId}`;
}

interface CourseScreenProps {
  graph: LearningGraph;
  goalId: ConceptId;
  passion?: PassionId;
  understood: ConceptId[];
  theme: Theme;
  progress: CourseProgress;
  onNext: () => void;
  onOpenLesson: (id: ConceptId) => void;
  onRestart: () => void;
}

/** Pure course boundary used by the progress regression test. */
export function CourseScreen({
  graph,
  goalId,
  passion,
  understood,
  theme,
  progress,
  onNext,
  onOpenLesson,
  onRestart,
}: CourseScreenProps) {
  if (progress.complete) return <CompletionPage onRestart={onRestart} />;
  const page = progress.remaining[0];
  if (!page) return null;
  const concept = graph.concepts.find((candidate) => candidate.id === page.conceptId);
  const step = concept?.lesson?.steps[page.stepIndex];
  if (!concept || !step) throw new Error(`missing course page: ${coursePageKey(page)}`);

  // The whole course, from `progress` — the one place the page list is built. Rebuilding it
  // here with a second `courseFor` call is how two views of one course drift apart.
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
        initialPath={uniqueConcepts(progress.pages)}
        known={understood}
        theme={theme}
        onOpenLesson={onOpenLesson}
      />
    </main>
  );
}

export function App({ graph }: AppProps) {
  const [started, setStarted] = useState(false);
  const [goalId, setGoalId] = useState<ConceptId>(graph.goalId);
  const [depth, setDepth] = useState<Depth>("quick");
  // Captured only on the entry screen. Course progress never writes to this state.
  const [declaredKnown, setDeclaredKnown] = useState<ConceptId[]>([]);
  const [passion, setPassion] = useState<PassionId | undefined>(storedPassion);
  const activeCourse = courseKey(goalId, depth, declaredKnown);
  const [course, setCourse] = useState<CourseState>(
    () => ({ key: activeCourse, pages: storedPages(activeCourse) }),
  );
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [themeIsExplicit, setThemeIsExplicit] = useState(hasStoredTheme);
  const [announcement, setAnnouncement] = useState("");
  // Parked seed for the gated side-quest feature. The map can already name a concept the
  // learner wants to look at; nothing renders from it yet, and deliberately so — a peek must
  // never replace the lesson on screen. Kept because reading it must never touch progress.
  const [peekedConceptId, setPeekedConceptId] = useState<ConceptId | undefined>();

  // The v1/v2 keys are unscoped; v3 lacks the fixed declaration identity. Delete them on sight.
  useEffect(() => { retireLegacyProgress(); }, []);

  // Load on switch. Same course -> same object -> React bails; no needless re-render at mount.
  useEffect(() => {
    setCourse((current) => (
      current.key === activeCourse ? current : { key: activeCourse, pages: storedPages(activeCourse) }
    ));
  }, [activeCourse]);

  useEffect(() => {
    if (course.key !== activeCourse) return; // mid-switch: these pages belong to the OLD course.
    savePages(course.key, course.pages);
  }, [activeCourse, course]);

  const completedPages = course.key === activeCourse ? course.pages : NO_PAGES;
  // A map peek is navigation only. Keep it out of this dependency list and out of every
  // completed-page write so deriveProgress remains the sole progress authority.
  const progress = useMemo(
    () => deriveProgress(graph, goalId, depth, completedPages, declaredKnown),
    [completedPages, declaredKnown, depth, goalId, graph],
  );
  // The map's "understood" styling combines the fixed entry declaration with concepts whose
  // course pages are recorded. It is derived, never stored as a second progress channel.
  const understood = useMemo(
    () => understoodConcepts(graph, goalId, depth, completedPages, declaredKnown),
    [completedPages, declaredKnown, depth, goalId, graph],
  );

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
    // Finishing a page is one recorded fact. There is no second bookkeeping path: the fixed
    // declaration is not advanced, and there is no core/deep split or session copy — the tier
    // decides which pages are IN the course, never what "done" means.
    setCourse((current) => (
      current.key !== activeCourse || current.pages.includes(key)
        ? current
        : { key: current.key, pages: [...current.pages, key] }
    ));
    const arriving = progress.remaining[1];
    setAnnouncement(
      arriving
        // +2: recording this page raises completeCount by one, and the indicator numbers the
        // page on screen as completeCount + 1. Announce what arrives, not what just left.
        ? pageAnnouncement(graph, arriving, progress.completeCount + 2, progress.total)
        : "Final page finished.",
    );
  }, [activeCourse, graph, progress.completeCount, progress.remaining, progress.total]);

  // None of these clear progress any more. The course load effect is keyed on the course, so
  // switching cannot carry the old course's pages across: the leak is gone by construction,
  // not by remembering to reset.
  const chooseCourse = () => {
    setStarted(false);
    setPeekedConceptId(undefined);
    setAnnouncement("Choose a learning goal.");
  };

  const updateGoal = (nextGoal: ConceptId) => {
    setGoalId(nextGoal);
    setDeclaredKnown((current) => knownForGoal(graph, nextGoal, current));
    setPeekedConceptId(undefined);
  };

  const updateDepth = (nextDepth: Depth) => {
    setDepth(nextDepth);
    setPeekedConceptId(undefined);
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
            {/* Show the ACTION, not the current state. Labelling the button with the theme
                you are already in reads as "click to go dark" while you are dark — it made
                the toggle feel reversed even though the colours were always correct. The
                icon and text now both describe what the click will do, matching aria-label. */}
            <span aria-hidden="true">{nextThemeName === "light" ? "☀" : "☾"}</span>
            <span>Switch to {nextThemeName}</span>
          </button>
        </div>
      </header>

      {started ? (
        <CourseScreen
          graph={graph}
          goalId={goalId}
          passion={passion}
          understood={understood}
          theme={theme}
          progress={progress}
          onNext={handleNext}
          onOpenLesson={setPeekedConceptId}
          onRestart={chooseCourse}
        />
      ) : (
        <Entry
          graph={graph}
          goalId={goalId}
          depth={depth}
          known={declaredKnown}
          passion={passion}
          onGoalChange={updateGoal}
          onDepthChange={updateDepth}
          onKnownChange={setDeclaredKnown}
          onPassionChange={setPassion}
          onStart={() => {
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
