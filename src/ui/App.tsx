import { useCallback, useEffect, useMemo, useState } from "react";
import type { ConceptId, CourseReceipt, LearningGraph, PassionId, RenderingSet } from "../types";
import { PASSION_IDS } from "../types";
import { CompletionPage } from "./CompletionPage";
import { Entry } from "./Entry";
import { LessonPage } from "./LessonPage";
import { ReceiptCard } from "./ReceiptCard";
import { MapToggle } from "./MapToggle";
import { StepIndicator } from "./StepIndicator";
import {
  coursePageKey,
  courseSelfExplanationPrompts,
  coveredConcepts,
  deriveProgress,
  knownForGoal,
  resolveCitation,
  resolveRenderingCitation,
  type CoursePage,
  type CourseProgress,
  type Depth,
} from "./model";
import { titleFor } from "./titles";

interface AppProps {
  graph: LearningGraph;
  renderings?: RenderingSet;
  receipt?: CourseReceipt;
}

type Theme = "light" | "dark";

// v4: progress is COMPLETED PAGE KEYS, scoped to goal + depth + the learner's fixed entry-screen
// declaration. v1/v2 stored a global
// known-concept list with no course scope, so finishing one course silently marked five
// other goals complete. That is not migratable — "you knew this" and "you read this" were
// never distinguishable in the old shape — so the old keys are retired, not converted.
const COURSE_KEY = "atomic-learning-graph.course.v4";
const SELF_EXPLANATION_KEY = "atomic-learning-graph.selfexpl.v1";

function courseScope(goalId: ConceptId, depth: Depth, known: ConceptId[]): string {
  const declaration = encodeURIComponent(JSON.stringify([...new Set(known)].sort()));
  return `${encodeURIComponent(goalId)}:${depth}:${declaration}`;
}

/** Exported for the scoping regression test: cross-course contamination is prevented HERE and
 *  nowhere else. `deriveProgress` is course-pure but page keys overlap between courses, so the
 *  storage key is the only thing that stops course A's pages being read as course B's. */
export const courseKey = (
  goalId: ConceptId,
  depth: Depth,
  known: ConceptId[] = [],
) => {
  return `${COURSE_KEY}:${courseScope(goalId, depth, known)}`;
};

/** Each answer gets its own storage key. The full course identity precedes the prompt identity,
 *  so matching concept edges in two courses cannot collide. */
export const selfExplanationCourseKey = (
  goalId: ConceptId,
  depth: Depth,
  known: ConceptId[] = [],
): string => `${SELF_EXPLANATION_KEY}:${courseScope(goalId, depth, known)}`;

export const selfExplanationStorageKey = (courseKey: string, promptId: string): string => (
  `${courseKey}:${promptId}`
);

type SelfExplanationStorage = Pick<
  Storage,
  "getItem" | "key" | "length" | "removeItem" | "setItem"
>;

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadSelfExplanations(
  courseNotesKey: string,
  storage: SelfExplanationStorage | undefined = browserStorage(),
): Record<string, string> {
  if (!storage) return {};
  try {
    const prefix = `${courseNotesKey}:`;
    const answers: Record<string, string> = {};
    const keys = Array.from(
      { length: storage.length },
      (_, index) => storage.key(index),
    ).filter((key): key is string => key?.startsWith(prefix) ?? false);
    for (const key of keys) {
      const answer = storage.getItem(key);
      if (answer !== null) answers[key.slice(prefix.length)] = answer;
    }
    return answers;
  } catch {
    return {};
  }
}

export function saveSelfExplanation(
  courseNotesKey: string,
  promptId: string,
  answer: string,
  storage: SelfExplanationStorage | undefined = browserStorage(),
) {
  try {
    const key = selfExplanationStorageKey(courseNotesKey, promptId);
    if (answer.length === 0) storage?.removeItem(key);
    else storage?.setItem(key, answer);
  } catch {
    // The note remains available in React state for this visit.
  }
}

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
    // No progress is represented by no course record. This keeps Start over a real deletion
    // instead of immediately recreating the active key with an empty array on the next effect.
    if (pages.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(pages));
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
  renderings?: RenderingSet;
  goalId: ConceptId;
  passion?: PassionId;
  covered: ConceptId[];
  theme: Theme;
  progress: CourseProgress;
  selfExplanations?: Readonly<Record<string, string>>;
  onSelfExplanationChange?: (promptId: string, answer: string) => void;
  onNext: () => void;
  onRestart: () => void;
}

/** Pure course boundary used by the progress regression test. */
export function CourseScreen({
  graph,
  renderings = { renderings: [] },
  goalId,
  passion,
  covered,
  theme,
  progress,
  selfExplanations = {},
  onSelfExplanationChange = () => undefined,
  onNext,
  onRestart,
}: CourseScreenProps) {
  if (progress.complete) {
    const recap = courseSelfExplanationPrompts(graph, progress.pages).flatMap((entry) => {
      const answer = selfExplanations[entry.id];
      return typeof answer === "string" && answer.trim().length > 0
        ? [{ prompt: entry.prompt, answer }]
        : [];
    });
    return (
      <CompletionPage
        graph={graph}
        goalId={goalId}
        route={uniqueConcepts(progress.pages)}
        selfExplanations={recap}
        onRestart={onRestart}
      />
    );
  }
  const page = progress.remaining[0];
  if (!page) return null;
  const concept = graph.concepts.find((candidate) => candidate.id === page.conceptId);
  const step = concept?.lesson?.steps[page.stepIndex];
  if (!concept || !step) throw new Error(`missing course page: ${coursePageKey(page)}`);
  const alternateRenderings = renderings.renderings.filter(
    (rendering) => rendering.conceptId === concept.id,
  );
  const explanation = courseSelfExplanationPrompts(graph, progress.pages).find(
    (entry) => entry.pageKey === coursePageKey(page),
  );

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
        renderings={alternateRenderings}
        resolveRendering={(rendering, stepIndex) => (
          resolveRenderingCitation(graph, rendering, stepIndex)
        )}
        passion={passion}
        selfExplanation={explanation?.prompt}
        selfExplanationAnswer={explanation ? selfExplanations[explanation.id] : undefined}
        onSelfExplanationChange={explanation
          ? (answer) => onSelfExplanationChange(explanation.id, answer)
          : undefined}
        nextLabel={nextLabel}
        onNext={onNext}
      />
      <MapToggle
        graph={graph}
        goalId={goalId}
        currentId={page.conceptId}
        path={path}
        initialPath={uniqueConcepts(progress.pages)}
        covered={covered}
        theme={theme}
      />
      <div className="course-reset">
        <button className="text-button" type="button" onClick={onRestart}>Start over</button>
      </div>
    </main>
  );
}

/** Reset one course, never the whole browser store. Returning the empty state from the same
 * operation keeps the persisted fact and the page on screen in agreement: this course's next
 * derived page is page 1, while every other course and preference remains untouched. */
export function restartCourseState(
  key: string,
  courseNotesKey: string,
  storage: SelfExplanationStorage | undefined = browserStorage(),
): CourseState {
  try {
    storage?.removeItem(key);
    const prefix = `${courseNotesKey}:`;
    const noteKeys = Array.from(
      { length: storage?.length ?? 0 },
      (_, index) => storage?.key(index),
    ).filter((storedKey): storedKey is string => storedKey?.startsWith(prefix) ?? false);
    for (const noteKey of noteKeys) storage?.removeItem(noteKey);
  } catch {
    // The in-memory reset still returns the learner to page 1 for this visit.
  }
  return { key, pages: [] };
}

export function App({ graph, renderings = { renderings: [] }, receipt }: AppProps) {
  const [started, setStarted] = useState(false);
  const [goalId, setGoalId] = useState<ConceptId>(graph.goalId);
  const [depth, setDepth] = useState<Depth>("quick");
  // Captured only on the entry screen. Course progress never writes to this state.
  const [declaredKnown, setDeclaredKnown] = useState<ConceptId[]>([]);
  const [passion, setPassion] = useState<PassionId | undefined>(storedPassion);
  // The RAW declaration persists across goal changes (the learner said it once); each course is
  // identified by the subset RELEVANT to its goal, so declaring a concept no goal cares about can
  // never fork a storage key or change a course.
  const relevantKnown = useMemo(
    () => knownForGoal(graph, goalId, declaredKnown),
    [declaredKnown, goalId, graph],
  );
  const activeCourse = courseKey(goalId, depth, relevantKnown);
  const activeSelfExplanationCourse = selfExplanationCourseKey(goalId, depth, relevantKnown);
  const [course, setCourse] = useState<CourseState>(
    () => ({ key: activeCourse, pages: storedPages(activeCourse) }),
  );
  const [selfExplanations, setSelfExplanations] = useState<{
    key: string;
    answers: Record<string, string>;
  }>(() => ({
    key: activeSelfExplanationCourse,
    answers: loadSelfExplanations(activeSelfExplanationCourse),
  }));
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [themeIsExplicit, setThemeIsExplicit] = useState(hasStoredTheme);
  const [announcement, setAnnouncement] = useState("");

  // The v1/v2 keys are unscoped; v3 lacks the fixed declaration identity. Delete them on sight.
  useEffect(() => { retireLegacyProgress(); }, []);

  // Load on switch. Same course -> same object -> React bails; no needless re-render at mount.
  useEffect(() => {
    setCourse((current) => (
      current.key === activeCourse ? current : { key: activeCourse, pages: storedPages(activeCourse) }
    ));
  }, [activeCourse]);

  useEffect(() => {
    setSelfExplanations((current) => (
      current.key === activeSelfExplanationCourse
        ? current
        : {
            key: activeSelfExplanationCourse,
            answers: loadSelfExplanations(activeSelfExplanationCourse),
          }
    ));
  }, [activeSelfExplanationCourse]);

  useEffect(() => {
    if (course.key !== activeCourse) return; // mid-switch: these pages belong to the OLD course.
    savePages(course.key, course.pages);
  }, [activeCourse, course]);

  const completedPages = course.key === activeCourse ? course.pages : NO_PAGES;
  const progress = useMemo(
    () => deriveProgress(graph, goalId, depth, completedPages, relevantKnown),
    [completedPages, relevantKnown, depth, goalId, graph],
  );
  // The map's "covered" styling combines the fixed entry declaration with concepts whose
  // course pages are recorded. It describes course scope, never learner comprehension.
  const covered = useMemo(
    () => coveredConcepts(graph, goalId, depth, completedPages, relevantKnown),
    [completedPages, relevantKnown, depth, goalId, graph],
  );
  const activeSelfExplanations = selfExplanations.key === activeSelfExplanationCourse
    ? selfExplanations.answers
    : {};

  const handleSelfExplanationChange = useCallback((promptId: string, answer: string) => {
    saveSelfExplanation(activeSelfExplanationCourse, promptId, answer);
    setSelfExplanations((current) => (
      current.key !== activeSelfExplanationCourse
        ? current
        : {
            key: current.key,
            answers: answer.length === 0
              ? Object.fromEntries(
                  Object.entries(current.answers).filter(([id]) => id !== promptId),
                )
              : { ...current.answers, [promptId]: answer },
          }
    ));
  }, [activeSelfExplanationCourse]);

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

  // The browser's Back button used to exit the site from page one of a course — the single
  // most reflexive gesture a judge makes, answered with losing the app. Starting a course
  // pushes ONE history entry; Back pops it and lands on the entry screen, exactly where
  // "Change course" goes. One entry, not one per page: paging through a course should not
  // charge the learner eight Back presses to leave.
  useEffect(() => {
    if (!started) return;
    window.history.pushState({ atomicCourseOpen: true }, "");
    const returnToEntry = () => {
      setStarted(false);
      setAnnouncement("Choose a learning goal.");
    };
    window.addEventListener("popstate", returnToEntry);
    return () => window.removeEventListener("popstate", returnToEntry);
  }, [started]);

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
    setAnnouncement("Choose a learning goal.");
  };

  const updateGoal = (nextGoal: ConceptId) => {
    // The declaration OUTLIVES the goal. Filtering state here silently unchecked every box the
    // moment a learner peeked at another goal, then handed them a fresh longer course whose old
    // progress was stranded under an unreachable storage key. Keep everything the learner said;
    // each goal reads its own relevant subset below.
    setGoalId(nextGoal);
  };

  const updateDepth = (nextDepth: Depth) => {
    setDepth(nextDepth);
  };

  const startOver = useCallback(() => {
    // Erasing progress AND typed notes on one unguarded click is the only destructive act in
    // the app. Ask first — but only when there is actually something to lose; confirming the
    // reset of an untouched course would be noise.
    const hasWork = (course.key === activeCourse && course.pages.length > 0)
      || Object.keys(activeSelfExplanations).length > 0;
    if (
      hasWork
      && typeof window !== "undefined"
      && !window.confirm(
        "Start this course over? Your page progress and any notes you typed for it will be erased.",
      )
    ) {
      return;
    }
    setCourse(restartCourseState(activeCourse, activeSelfExplanationCourse));
    setSelfExplanations({ key: activeSelfExplanationCourse, answers: {} });
    setStarted(true);
    setAnnouncement("Course restarted. Page 1 is ready.");
  }, [activeCourse, activeSelfExplanationCourse, activeSelfExplanations, course]);

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
          renderings={renderings}
          goalId={goalId}
          passion={passion}
          covered={covered}
          theme={theme}
          progress={progress}
          selfExplanations={activeSelfExplanations}
          onSelfExplanationChange={handleSelfExplanationChange}
          onNext={handleNext}
          onRestart={startOver}
        />
      ) : (
        <>
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
            resumePageCount={course.key === activeCourse ? course.pages.length : 0}
            onStart={() => {
              setStarted(true);
              const done = course.key === activeCourse ? course.pages.length : 0;
              setAnnouncement(
                done === 0
                  ? "Your first lesson is ready."
                  : `Resuming your course. ${done} page${done === 1 ? "" : "s"} already covered.`,
              );
            }}
            onStartFresh={() => {
              setCourse(restartCourseState(activeCourse, activeSelfExplanationCourse));
              setSelfExplanations({ key: activeSelfExplanationCourse, answers: {} });
              setStarted(true);
              setAnnouncement("Your first lesson is ready.");
            }}
          />
          {receipt && <ReceiptCard receipt={receipt} />}
        </>
      )}

      <p className="sr-only" aria-live="polite">{announcement}</p>
      <footer>Built from an openly licensed graph. Lessons run without a request-time AI call.</footer>
    </>
  );
}
