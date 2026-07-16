import {
  PASSION_IDS,
  type LearningGraph,
  type PassionId,
} from "../types";
import type {
  JsonObject,
  TranslationRequestOptions,
} from "./translate";

export const ANALOGY_PROMPT_VERSION = "atomizer-v2-analogies-six-passions";

export interface AnalogyClient {
  request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options: TranslationRequestOptions,
  ): Promise<JsonObject>;
}

export const ANALOGY_INSTRUCTIONS = `Write short analogies for ONE concept's lesson steps. Every analogy is a labelled illustration, not a fact and not a citation. Rules:
1. For every supplied lesson step, return one analogy for each passion: cooking, sports, music, video-games, cars, and gardening.
2. Keep each analogy plain and about 30 words or fewer. Begin with comparison language such as "Imagine", "Like", or "Think of" so it cannot read as a source claim.
3. Relate the lesson step's idea to the passion without claiming that the comparison is literally or scientifically true.
4. Do not quote the source, add citations, or change the lesson text.
Output ONLY the JSON matching the schema.`;

export function analogySchema(stepCount: number): JsonObject {
  const properties = Object.fromEntries(
    PASSION_IDS.map((passion) => [passion, { type: "string", minLength: 1, maxLength: 240 }]),
  );
  return {
    type: "object",
    additionalProperties: false,
    required: ["steps"],
    properties: {
      steps: {
        type: "array",
        minItems: stepCount,
        maxItems: stepCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: [...PASSION_IDS],
          properties,
        },
      },
    },
  };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function parseAnalogies(
  raw: JsonObject,
  stepCount: number,
): Array<Partial<Record<PassionId, string>>> {
  if (!Array.isArray(raw.steps) || raw.steps.length !== stepCount) {
    throw new Error(`analogy response must contain exactly ${stepCount} step rows`);
  }

  return raw.steps.map((rawStep) => {
    const analogies: Partial<Record<PassionId, string>> = {};
    if (!isObject(rawStep)) return analogies;
    for (const passion of PASSION_IDS) {
      const value = rawStep[passion];
      if (typeof value !== "string") continue;
      const normalized = value.trim().replace(/\s+/gu, " ");
      if (normalized.length === 0 || wordCount(normalized) > 30) continue;
      analogies[passion] = normalized;
    }
    return analogies;
  });
}

const requestOptions: TranslationRequestOptions = {
  forceStrict: true,
  maxOutputTokens: 3000,
};

function analogyInput(
  concept: LearningGraph["concepts"][number],
): string {
  const steps = concept.lesson?.steps ?? [];
  return `CONCEPT_ID=${concept.id}
CONCEPT_TITLE=${concept.lesson?.plainTitle ?? concept.title}
CONCEPT_SUMMARY=${concept.summary}
PASSIONS=${PASSION_IDS.join(",")}
STEP_COUNT=${steps.length}
LESSON_STEPS:
${steps.map((step, index) => `${index + 1}. ${step.text}`).join("\n")}`;
}

/**
 * Add build-time analogies without introducing a new gate. Each concept gets at most one request;
 * a failed request leaves that concept untouched, and an invalid passion string alone is omitted.
 */
export async function generateAnalogies(
  graph: LearningGraph,
  client: AnalogyClient,
  onWarning: (message: string) => void = (message) => console.warn(message),
): Promise<LearningGraph> {
  const enriched: LearningGraph = JSON.parse(JSON.stringify(graph));

  for (const concept of enriched.concepts) {
    const steps = concept.lesson?.steps ?? [];
    if (steps.length === 0) {
      onWarning(`Analogies skipped for ${concept.id}: no translated lesson steps`);
      continue;
    }
    try {
      const raw = await client.request(
        ANALOGY_INSTRUCTIONS,
        analogyInput(concept),
        analogySchema(steps.length),
        "lesson_analogies",
        requestOptions,
      );
      const generated = parseAnalogies(raw, steps.length);
      for (const [stepIndex, analogies] of generated.entries()) {
        if (Object.keys(analogies).length > 0) steps[stepIndex]!.analogies = analogies;
      }
    } catch (error) {
      onWarning(`Analogies omitted for ${concept.id}: ${String(error)}`);
    }
  }

  return enriched;
}
