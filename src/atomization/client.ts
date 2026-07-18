import type { JsonObject, TranslationRequestOptions } from "./translate";
import type { RunUsageTokens } from "./run-receipt";

export const MODEL_CANDIDATES = [process.env.OPENAI_MODEL ?? "gpt-5.6-sol"];

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function outputText(response: JsonObject): string {
  const output = response.output;
  if (!Array.isArray(output)) throw new Error("OpenAI response contains no output array");
  for (const item of output) {
    if (!isObject(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isObject(content) && content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI response contains no output_text content");
}

function billedTokenCount(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`OpenAI response usage.${field} must be a non-negative integer`);
  }
  return value as number;
}

function responseUsage(response: JsonObject): RunUsageTokens {
  if (!isObject(response.usage)) {
    throw new Error("OpenAI response contains no usage object");
  }
  const input = billedTokenCount(response.usage.input_tokens, "input_tokens");
  const output = billedTokenCount(response.usage.output_tokens, "output_tokens");
  const total = billedTokenCount(response.usage.total_tokens, "total_tokens");
  if (total !== input + output) {
    throw new Error(
      `OpenAI response usage.total_tokens (${total}) does not equal input_tokens + output_tokens (${input + output})`,
    );
  }
  return { input, output, total };
}

export class ResponsesClient {
  readonly responseIds: string[] = [];
  readonly usageTokens: RunUsageTokens = { input: 0, output: 0, total: 0 };
  model = "";
  modelSnapshot = "";
  strictSchema = false;

  constructor(private readonly apiKey: string) {}

  private async api(path: string, init: RequestInit = {}): Promise<JsonObject> {
    const response = await fetch(`https://api.openai.com/v1${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const raw = (await response.json()) as JsonObject;
    if (!response.ok) {
      const error = isObject(raw.error) && typeof raw.error.message === "string" ? raw.error.message : JSON.stringify(raw);
      throw new Error(`OpenAI API ${response.status} ${path}: ${error}`);
    }
    return raw;
  }

  async initialize(): Promise<void> {
    const candidates = [...new Set(MODEL_CANDIDATES)];
    for (const model of candidates) {
      try {
        await this.api(`/models/${encodeURIComponent(model)}`);
        this.model = model;
        break;
      } catch (error) {
        console.warn(`Model ${model} unavailable: ${String(error)}`);
      }
    }
    if (!this.model) throw new Error(`none of the pinned GPT-5.x candidates are available: ${candidates.join(", ")}`);

    const probe = await this.request(
      "Return exactly the requested object.",
      "Set ok to true.",
      {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
        additionalProperties: false,
      },
      "strict_probe",
      { forceStrict: true },
    );
    if (probe.ok !== true) throw new Error("strict Structured Outputs probe returned the wrong value");
    this.strictSchema = true;
  }

  async request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    options: Partial<TranslationRequestOptions> = {},
  ): Promise<JsonObject> {
    const useStrict = options.forceStrict || this.strictSchema;
    const body: JsonObject = {
      model: this.model,
      instructions,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: options.maxOutputTokens ?? 10000,
    };
    if (useStrict) {
      body.text = {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      };
    }
    const response = await this.api("/responses", { method: "POST", body: JSON.stringify(body) });
    const usage = responseUsage(response);
    this.usageTokens.input += usage.input;
    this.usageTokens.output += usage.output;
    this.usageTokens.total += usage.total;
    if (typeof response.id === "string") this.responseIds.push(response.id);
    if (typeof response.model === "string") this.modelSnapshot = response.model;
    const text = outputText(response);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!isObject(parsed)) throw new Error("top-level JSON value is not an object");
      return parsed;
    } catch (error) {
      throw new Error(`model output is not valid JSON: ${String(error)}; output=${text.slice(0, 500)}`);
    }
  }
}
