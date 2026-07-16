import type { ConceptId, LearningGraph, Lesson } from "../types";

export const READABILITY_ADVISORY_GRADE = 10;
export const READABILITY_HARD_FLOOR = 16;

export interface ReadabilityWarning {
  conceptId: ConceptId;
  grade: number;
  confidence: "low";
  reason: string;
}

export interface ReadabilityFailure {
  conceptId: ConceptId;
  grade: number;
}

export class ReadabilityFloorError extends Error {
  constructor(public readonly failures: ReadabilityFailure[]) {
    super(
      `lesson readability exceeds grade ${READABILITY_HARD_FLOOR}: ${failures
        .map((failure) => `${failure.conceptId} (${failure.grade})`)
        .join(", ")}`,
    );
    this.name = "ReadabilityFloorError";
  }
}

function syllablesInWord(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;

  const vowelGroups = word.match(/[aeiouy]+/g)?.length ?? 1;
  const silentTerminalE = word.endsWith("e") && !/[aeiouy]le$/.test(word);
  return Math.max(1, vowelGroups - (silentTerminalE ? 1 : 0));
}

/** Deterministic, dependency-free Flesch-Kincaid grade estimate for English prose. */
export function fleschKincaidGrade(text: string): number {
  const words = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? [];
  if (words.length === 0) return 0;
  const sentenceMarks = text.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
  const sentences = Math.max(1, sentenceMarks);
  const syllables = words.reduce((total, word) => total + syllablesInWord(word), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  return Math.round(grade * 100) / 100;
}

/** Compute once over the complete lesson; per-step samples are too short to be meaningful. */
export function lessonReadabilityGrade(lesson: Lesson): number {
  return fleschKincaidGrade(lesson.steps.map((step) => step.text).join(" "));
}

/**
 * Returns low-confidence advisories for grades 10–16 and throws only above the hard grade-16
 * floor. Missing lessons are owned by `invalidLessonCitations`, so this check does not duplicate
 * that gate.
 */
export function checkLessonReadability(graph: LearningGraph): ReadabilityWarning[] {
  const warnings: ReadabilityWarning[] = [];
  const failures: ReadabilityFailure[] = [];

  for (const concept of graph.concepts) {
    if (!concept.lesson || concept.lesson.steps.length === 0) continue;
    const grade = lessonReadabilityGrade(concept.lesson);
    if (grade > READABILITY_HARD_FLOOR) {
      failures.push({ conceptId: concept.id, grade });
    } else if (grade >= READABILITY_ADVISORY_GRADE) {
      warnings.push({
        conceptId: concept.id,
        grade,
        confidence: "low",
        reason: `lesson readability is estimated at US grade ${grade}`,
      });
    }
  }

  if (failures.length > 0) throw new ReadabilityFloorError(failures);
  return warnings;
}
