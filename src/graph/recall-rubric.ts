import type { Concept, RecallRubric } from "../types";
import { quoteContentWords } from "./invariants";

// Quote grounding uses a deliberately small stopword list: it needs only enough filtering to
// prove a citation carries content. Recall has a different job — asking a learner to repeat every
// connective word turns a source receipt into a brittle transcription test — so it drops the
// additional common function words that do not identify an idea.
const RECALL_STOPWORDS = new Set([
  "about", "after", "again", "against", "all", "also", "among", "any", "around", "because",
  "before", "between", "both", "can", "could", "current", "each", "either", "else", "enough",
  "even", "every", "few", "first", "further", "given", "here", "however", "just", "last", "like",
  "many", "may", "might", "more", "most", "much", "must", "near", "neither", "next", "now",
  "only", "other", "out", "over", "purposes", "same", "second", "several", "should", "since",
  "some", "still", "such", "think", "together", "toward", "until", "upon", "us", "via", "well",
  "would",
]);

/** Remove MathJax spans before tokenizing: TeX commands and symbolic variables are notation, not
 * learner-facing recall terms. Commands outside a delimited span are removed too. */
function proseForRecall(value: string): string {
  return value
    .replace(/\$\$[\s\S]*?\$\$/gu, " ")
    .replace(/\$[^$\r\n]*\$/gu, " ")
    .replace(/\\[A-Za-z]+/gu, " ");
}

const normalizedKeywords = (value: string): string[] => {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of quoteContentWords(proseForRecall(value))) {
    const normalized = word.toLocaleLowerCase("en-US");
    if (normalized.length <= 1) continue;
    if (RECALL_STOPWORDS.has(normalized)) continue;
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
