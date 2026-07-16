import type { Concept, LearningGraph, Lesson, LessonStep, Source } from "../types";
import { groundedQuote } from "./grounding";
import { convergeLessonCitations } from "./repair";

export const PROMPT_VERSION = "atomizer-v2-translate-three-phase";

export type JsonObject = Record<string, unknown>;

export interface TranslationRequestOptions {
  forceStrict: true;
  maxOutputTokens: 3000;
}

export interface TranslationClient {
  request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options: TranslationRequestOptions,
  ): Promise<JsonObject>;
}

export const TRANSLATE_INSTRUCTIONS = `You are a translator, not an author. Rewrite ONE concept from the SOURCE excerpt below into plain language an average adult can read (US grade 8–10). Rules:
1. Produce 2–4 ordered \`steps\`, each one short page (1–2 sentences, ≤~45 words). Everyday words; define any unavoidable technical term inline in plain words.
2. Each step MUST include a \`citation.quotedText\` copied VERBATIM, character-for-character, from the SOURCE excerpt — a single contiguous span, no ellipses, no edits. If you cannot ground a step in a verbatim span, DROP that step.
3. Use only the given \`sourceId\`. Never invent, summarise, or paraphrase inside \`quotedText\`.
4. Mark each step \`stepTier\`: \`"core"\` if it is essential to understand the concept (shown on the quick path), \`"deep"\` if it is enrichment.
5. \`plainTitle\`: a jargon-free title for this concept.
Output ONLY the JSON matching the schema.`;

const citationSchema: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["sourceId", "quotedText"],
  properties: {
    sourceId: { type: "string" },
    quotedText: { type: "string" },
  },
};

const lessonStepSchema: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["text", "stepTier", "citation"],
  properties: {
    text: { type: "string" },
    stepTier: { type: "string", enum: ["core", "deep"] },
    citation: citationSchema,
  },
};

export const lessonSchema: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["plainTitle", "steps"],
  properties: {
    plainTitle: { type: "string" },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: lessonStepSchema,
    },
  },
};

const lessonCitationRepairSchema: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["quotedText"],
  properties: { quotedText: { type: "string" } },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: JsonObject, expected: readonly string[], field: string): void {
  const unexpected = Object.keys(value).filter((key) => !expected.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${field} has unexpected field(s): ${unexpected.join(", ")}`);
  }
  const missing = expected.filter((key) => !(key in value));
  if (missing.length > 0) throw new Error(`${field} is missing field(s): ${missing.join(", ")}`);
}

export function parseLesson(raw: JsonObject): Lesson {
  exactKeys(raw, ["plainTitle", "steps"], "lesson");
  if (typeof raw.plainTitle !== "string" || raw.plainTitle.trim().length === 0) {
    throw new Error("lesson.plainTitle must be a non-blank string");
  }
  if (!Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 4) {
    throw new Error("lesson.steps must contain 2–4 items");
  }

  const steps = raw.steps.map((rawStep, index): LessonStep => {
    if (!isObject(rawStep)) throw new Error(`lesson.steps[${index}] must be an object`);
    exactKeys(rawStep, ["text", "stepTier", "citation"], `lesson.steps[${index}]`);
    if (typeof rawStep.text !== "string" || rawStep.text.trim().length === 0) {
      throw new Error(`lesson.steps[${index}].text must be a non-blank string`);
    }
    if (rawStep.stepTier !== "core" && rawStep.stepTier !== "deep") {
      throw new Error(`lesson.steps[${index}].stepTier must be core or deep`);
    }
    if (!isObject(rawStep.citation)) {
      throw new Error(`lesson.steps[${index}].citation must be an object`);
    }
    exactKeys(
      rawStep.citation,
      ["sourceId", "quotedText"],
      `lesson.steps[${index}].citation`,
    );
    if (
      typeof rawStep.citation.sourceId !== "string" ||
      typeof rawStep.citation.quotedText !== "string"
    ) {
      throw new Error(`lesson.steps[${index}].citation fields must be strings`);
    }
    return {
      text: rawStep.text.trim(),
      stepTier: rawStep.stepTier,
      citation: {
        sourceId: rawStep.citation.sourceId,
        quotedText: rawStep.citation.quotedText,
      },
    };
  });

  return { plainTitle: raw.plainTitle.trim(), steps };
}

function sentenceWindow(sourceText: string, anchorStart: number, anchorEnd: number): string {
  const roughStart = Math.max(0, anchorStart - 1500);
  const roughEnd = Math.min(sourceText.length, anchorEnd + 1500);
  const beforeAnchor = sourceText.slice(roughStart, anchorStart);
  const startBoundary = Math.max(
    beforeAnchor.lastIndexOf(". "),
    beforeAnchor.lastIndexOf("? "),
    beforeAnchor.lastIndexOf("! "),
  );
  const start = startBoundary < 0 ? roughStart : roughStart + startBoundary + 2;
  const afterRoughEnd = sourceText.slice(roughEnd);
  const endBoundary = afterRoughEnd.search(/[.!?](?:\s|$)/u);
  const end = endBoundary < 0 ? roughEnd : roughEnd + endBoundary + 1;
  return sourceText.slice(start, end).trim();
}

/** Build the paragraph-aligned ±~1500-character source window around a validated quote. */
export function excerptAroundAnchor(sourceText: string, anchorQuote: string): string {
  const anchorStart = sourceText.indexOf(anchorQuote);
  if (anchorStart < 0) throw new Error("validated anchor quote is not an exact stored substring");
  const anchorEnd = anchorStart + anchorQuote.length;

  const paragraphStart = sourceText.lastIndexOf("\n\n", anchorStart) + 2;
  const nextBreak = sourceText.indexOf("\n\n", anchorEnd);
  const paragraphEnd = nextBreak < 0 ? sourceText.length : nextBreak;
  if (paragraphEnd - paragraphStart > 3500) {
    return sentenceWindow(sourceText, anchorStart, anchorEnd);
  }

  let start = paragraphStart;
  let end = paragraphEnd;
  while (start > 0) {
    const previousBreak = sourceText.lastIndexOf("\n\n", start - 3);
    const candidate = previousBreak < 0 ? 0 : previousBreak + 2;
    if (anchorStart - candidate > 1500) break;
    start = candidate;
  }
  while (end < sourceText.length) {
    const followingBreak = sourceText.indexOf("\n\n", end + 2);
    const candidate = followingBreak < 0 ? sourceText.length : followingBreak;
    if (candidate - anchorEnd > 1500) break;
    end = candidate;
  }
  return sourceText.slice(start, end).trim();
}

function sourceForConcept(graph: LearningGraph, concept: Concept): Source {
  const matches = graph.sources.filter(({ id }) => id === concept.provenance.sourceId);
  if (matches.length !== 1) {
    throw new Error(`concept ${concept.id} does not resolve to exactly one source`);
  }
  return matches[0]!;
}

function snapLesson(lesson: Lesson, source: Source): Lesson {
  return {
    ...lesson,
    steps: lesson.steps.map((step) => {
      if (step.citation.sourceId !== source.id) return step;
      const quote = groundedQuote(source.text, step.citation.quotedText);
      return quote ? { ...step, citation: { sourceId: source.id, quotedText: quote } } : step;
    }),
  };
}

const requestOptions: TranslationRequestOptions = {
  forceStrict: true,
  maxOutputTokens: 3000,
};

function translationInput(concept: Concept, source: Source, excerpt: string): string {
  return `CONCEPT_ID=${concept.id}
CONCEPT_TITLE=${concept.title}
CONCEPT_SUMMARY=${concept.summary}
SOURCE_ID=${source.id}
VALIDATED_ANCHOR=${concept.provenance.quotedText}
SOURCE excerpt:
<<<
${excerpt}
>>>`;
}

export async function translateAndConvergeLessons(
  graph: LearningGraph,
  client: TranslationClient,
  onWarning: (message: string) => void = (message) => console.warn(message),
): Promise<LearningGraph> {
  const candidate: LearningGraph = JSON.parse(JSON.stringify(graph));

  for (const concept of candidate.concepts) {
    const source = sourceForConcept(candidate, concept);
    const excerpt = excerptAroundAnchor(source.text, concept.provenance.quotedText);
    try {
      const raw = await client.request(
        TRANSLATE_INSTRUCTIONS,
        translationInput(concept, source, excerpt),
        lessonSchema,
        "lesson_translation",
        requestOptions,
      );
      concept.lesson = snapLesson(parseLesson(raw), source);
    } catch (error) {
      onWarning(`Translation for ${concept.id} failed; applying grounded floor: ${String(error)}`);
      concept.lesson = { plainTitle: concept.title, steps: [] };
    }
  }

  return convergeLessonCitations(candidate, {
    repairLessonCitation: async (repairingGraph, issue) => {
      const concept = repairingGraph.concepts.find(({ id }) => id === issue.conceptId);
      const step = concept?.lesson?.steps[issue.stepIndex];
      if (!concept || !step) return repairingGraph;
      const source = sourceForConcept(repairingGraph, concept);
      const excerpt = excerptAroundAnchor(source.text, concept.provenance.quotedText);
      try {
        const raw = await client.request(
          "Repair one lesson citation. Return one quotedText span copied verbatim, character-for-character, from the supplied SOURCE excerpt. No ellipses, edits, paraphrases, or commentary.",
          `CONCEPT_ID=${concept.id}\nSTEP_TEXT=${step.text}\nSOURCE_ID=${source.id}\nSOURCE excerpt:\n<<<\n${excerpt}\n>>>`,
          lessonCitationRepairSchema,
          "lesson_citation_repair",
          requestOptions,
        );
        if (typeof raw.quotedText !== "string") return repairingGraph;
        const quote = groundedQuote(source.text, raw.quotedText);
        if (quote) step.citation = { sourceId: source.id, quotedText: quote };
      } catch (error) {
        onWarning(
          `Citation repair for ${concept.id}[${issue.stepIndex}] failed; dropping step: ${String(error)}`,
        );
      }
      return repairingGraph;
    },
  });
}
