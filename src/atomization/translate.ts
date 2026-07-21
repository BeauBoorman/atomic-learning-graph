import type {
  AlternateFormat,
  Concept,
  LearningGraph,
  Lesson,
  LessonStep,
  Source,
} from "../types";
import { groundedQuote } from "./grounding";
import { convergeLessonCitations } from "./repair";

export const PROMPT_VERSION = "atomizer-v7-moonshot-beginner-teacher";

export const GRAPH_VOCABULARY_CONSTRAINT =
  "Each lesson step may use technical vocabulary only when either (a) the term names a concept " +
  "listed in GRAPH_DEFINED_CONCEPTS, so the graph defines it elsewhere, or (b) the same step " +
  "defines the term inline in plain language first. Never reach for undefined technical vocabulary " +
  'such as "multi-head attention." When introducing a term, pattern: plain words first, term in ' +
  'parentheses — e.g. "a stack of number-grids (a third-order tensor)".';

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

export const TRANSLATE_INSTRUCTIONS = `You are a world-class teacher — think Feynman, 3Blue1Brown, the best teacher you ever had — writing for a smart, motivated beginner with NO background in the subject and NO math past basic arithmetic. They must finish this lesson able to (a) explain the concept in their own words to a friend, and (b) work a simple example themselves. If your lesson wouldn't pass that test, it isn't done. Aim for the moon: target the single best explanation of this concept a world-class teacher could give a beginner.

## TEACHING ARC (5 mandatory steps in this order; step 6 optional)
1. **The hook.** One or two short sentences: what problem does this solve, or what does it let you do that you couldn't before? Make the reader WANT it before you define it. Plain words only — no jargon yet.
2. **Plain definition.** What it IS, in everyday language. Define EVERY technical term in non-technical words the first time it appears. Never define a word with itself (banned: "Attention is when tokens attend to each other"). If you can't define a term plainly, don't use the term.
3. **Worked example.** Small, real numbers, worked step by step so the reader can follow and reproduce. Show the arithmetic explicitly (e.g., "(2×5) + (3×1) + (4×2) = 10 + 3 + 8 = 21"). Mandatory — a lesson without a worked example is not a lesson.
4. **Intuition / analogy.** Tie the idea to something from everyday life so the reader can SEE it in their mind. A picture is worth a thousand words of definition.
5. **The precise version, LAST.** Only now give the formal statement or notation, tied back to the plain words you just used. This step carries the heavy citation. Rigor is the FINAL stop, never the opening.
6. *(optional)* **Connection.** How this links to a prerequisite concept, or where it gets used next. Skip if there's no genuinely useful link — don't pad.

## LANGUAGE (hard rules)
- Short sentences. Everyday words. Read like a great teacher talking, not a textbook.
- Target reading level: US grade 6-8. NO unexplained jargon, ever. A symbol NEVER appears without its plain-word meaning given first. Pattern: "a stack of number-grids (a third-order tensor)" — plain first, term in parentheses.
- Warm and respectful, never condescending. The reader is smart; they just haven't met this idea yet.
- If a concept has more than one great way in, give more than one.

## DECOUPLE TEACHING FROM CITATION (this is the root-cause fix for the college-level feel)
Write the plain explanation FIRST, as if no source existed. THEN attach the verbatim source quote UNDERNEATH as PROOF. The citation must NOT drag your wording back to textbook register. Your step text and the cited span will often use very different words — that is correct and expected. The cited span is the EVIDENCE your plain-language claim rests on; it is NOT a wording template and you must NOT paraphrase it back into the step text.

## HONESTY (unbreakable)
- Each step MUST include a \`citation.quotedText\` copied VERBATIM, character-for-character, from the SOURCE excerpt — a single contiguous span, no ellipses, no edits. The span must ground the step's core claim or method (for the hook, the problem it solves; for the definition, the definition; for the worked example, the METHOD the example illustrates; for the formal step, the precise statement). A span that is merely topically related but does not state that claim is a FAILURE. If you cannot ground a step in a verbatim span, rewrite the step until you can, or DROP it.
- Worked-example NUMBERS are model-authored (good — they won't appear in the source) and you must NEVER attribute them to the source. The arithmetic MUST be correct: a wrong worked example is worse than none.
- No fabricated quotes, ever. Use only the given \`sourceId\`. Never invent, summarize, or paraphrase inside \`quotedText\`.
- Do NOT cite text inside \`~~strikethrough~~\` markers — those are authorial deletions, not active prose. Pick a span from active text.
- If one proposed step needs two different source spans to ground it, SPLIT it into two steps, each with its own verbatim quote. Never attach one quote to a step that makes two separate claims.
${GRAPH_VOCABULARY_CONSTRAINT}

## TITLES (\`plainTitle\`)
- Jargon-free.
- UNIQUE across the whole course. No two lessons share or nearly-share a title. If another concept in this run would naturally have a similar title, rename YOURS to something specific to THIS concept (e.g., not "Measuring a Matrix" for both frobenius-norm and matrix-norms — one becomes "How Big Is This Matrix, Counting Every Entry?" and the other becomes "Two Ways to Measure a Matrix: by Entries and by Stretching").
- One consistent voice across all your lessons. Specific to THIS concept, not generic enough to apply to a sibling.

## OUTPUT
- Produce 5 ordered \`steps\` (the mandatory arc above) — or 6 if the optional Connection step adds value. Each step is one short paragraph (1–3 sentences, ≤~60 words). Mark each \`stepTier\`: \`"core"\` for steps 1–5; \`"deep"\` for step 6 if present.
- Output ONLY the JSON matching the schema.`;

const RENDERING_QUESTIONS: Record<AlternateFormat, string> = {
  "why-it-exists":
    "Answer ONE question: why does this concept exist — what problem does it solve, what came before it, what breaks without it. Do NOT define the concept; the reader already has a definition. Ground every step in a span about motivation, prior approaches, or limitations.",
  "how-it-works":
    "Answer ONE question: what actually happens, step by step, when this runs. Do NOT motivate it and do NOT define it. Ground every step in a span describing the mechanism or procedure.",
};

export function renderInstructions(format: AlternateFormat): string {
  return `You are a world-class teacher — think Feynman or 3Blue1Brown — writing for a smart, motivated beginner with NO background in the subject and NO math past basic arithmetic. This is a RENDERING (a single lens on the concept), not a full lesson. ${RENDERING_QUESTIONS[format]} Rules:
1. Produce 2–4 ordered \`steps\`, each one short paragraph (1–2 sentences, ≤~50 words) in everyday words at US grade 6–8 reading level.
2. NO unexplained jargon, ever. Define every technical term in plain words the first time it appears. Never define a word with itself. Pattern: "a stack of number-grids (a third-order tensor)" — plain first, term in parentheses.
3. DECOUPLE TEACHING FROM CITATION: Write the plain explanation FIRST, as if no source existed. THEN attach the verbatim source quote UNDERNEATH as PROOF. The citation must NOT drag your wording back to textbook register. Your step text and the cited span will often use very different words — that is correct.
4. Each step MUST include a \`citation.quotedText\` copied VERBATIM, character-for-character, from the SOURCE excerpt — a single contiguous span, no ellipses, no edits. The span must ground the step's core claim. A span that is merely topically related but does not state the claim is a FAILURE. Do NOT cite text inside \`~~strikethrough~~\` markers. If you cannot ground a step in a verbatim span, DROP it.
5. Worked-example numbers (if any) are model-authored and MUST be arithmetically correct. Never attribute them to the source.
6. Use only the given \`sourceId\`. Never invent, summarize, or paraphrase inside \`quotedText\`. ${GRAPH_VOCABULARY_CONSTRAINT}
7. Mark each step \`stepTier\`: \`"core"\` if essential to answer the question, \`"deep"\` if enrichment.
8. \`plainTitle\`: jargon-free, specific to THIS rendering, distinct from sibling renderings.
Output ONLY the JSON matching the schema.`;
}

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
      minItems: 4,
      maxItems: 6,
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
  if (!Array.isArray(raw.steps) || raw.steps.length < 4 || raw.steps.length > 6) {
    throw new Error("lesson.steps must contain 4–6 items");
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

export function sourceForConcept(graph: LearningGraph, concept: Concept): Source {
  const matches = graph.sources.filter(({ id }) => id === concept.provenance.sourceId);
  if (matches.length !== 1) {
    throw new Error(`concept ${concept.id} does not resolve to exactly one source`);
  }
  return matches[0]!;
}

export function snapLesson(lesson: Lesson, source: Source): Lesson {
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

export function translationInput(
  concept: Concept,
  source: Source,
  excerpt: string,
  graphConcepts: readonly Concept[] = [concept],
): string {
  const graphDefinedConcepts = graphConcepts.map(({ id, title, summary }) => ({
    id,
    title,
    summary,
  }));
  return `CONCEPT_ID=${concept.id}
CONCEPT_TITLE=${concept.title}
CONCEPT_SUMMARY=${concept.summary}
GRAPH_DEFINED_CONCEPTS=${JSON.stringify(graphDefinedConcepts)}
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
  onProgress: (message: string) => void = (message) => console.log(message),
): Promise<LearningGraph> {
  const candidate: LearningGraph = JSON.parse(JSON.stringify(graph));

  for (const [index, concept] of candidate.concepts.entries()) {
    // One line per model call: this loop is the longest silent stretch of a build, and a
    // builder that prints nothing for minutes reads as frozen rather than working.
    onProgress(`Translating ${index + 1}/${candidate.concepts.length}: ${concept.title}`);
    const source = sourceForConcept(candidate, concept);
    const excerpt = excerptAroundAnchor(source.text, concept.provenance.quotedText);
    try {
      const raw = await client.request(
        TRANSLATE_INSTRUCTIONS,
        translationInput(concept, source, excerpt, candidate.concepts),
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
