import type { Concept, RecallRubric } from "../types";
import { quoteContentWords } from "./invariants";

const normalizedKeywords = (value: string): string[] => {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of quoteContentWords(value)) {
    const normalized = word.toLocaleLowerCase("en-US");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(normalized);
  }
  return keywords;
};

/** Project a concept's lesson-step receipts into an ordered, deterministic recall checklist. */
export function buildRecallRubric(concept: Concept): RecallRubric {
  const steps = Array.isArray(concept.lesson?.steps) ? concept.lesson.steps : [];
  return {
    conceptId: concept.id,
    items: steps.map((step) => ({
      conceptId: concept.id,
      sourceId: step.citation.sourceId,
      quotedText: step.citation.quotedText,
      mustMention: normalizedKeywords(step.citation.quotedText),
    })),
  };
}

/**
 * Check each item using exact normalized content-word membership. Empty keyword lists fail closed;
 * grounded rubrics cannot produce one because quote grounding enforces a content-word floor.
 */
export function checkRecall(
  answer: string,
  rubric: RecallRubric,
): Array<{ itemIndex: number; met: boolean }> {
  const answerWords = new Set(normalizedKeywords(answer));
  return rubric.items.map((item, itemIndex) => ({
    itemIndex,
    met:
      item.mustMention.length > 0 &&
      item.mustMention.every((term) => answerWords.has(term.toLocaleLowerCase("en-US"))),
  }));
}
