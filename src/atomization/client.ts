import type { JsonObject, TranslationRequestOptions } from "./translate";
import type { RunUsageTokens } from "./run-receipt";

export const MODEL_CANDIDATES = [process.env.OPENAI_MODEL ?? "gpt-5.6-sol"];
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

export interface ResponsesRequestOptions extends Partial<TranslationRequestOptions> {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** The builder's provider adapter rewrites api.openai.com calls to the provider the teacher
 *  actually chose (see builder/provider-fetch.mjs). Errors surfaced to that teacher must carry
 *  the chosen provider's name — a wrong Anthropic key branded "OpenAI API 401" reads as our bug,
 *  not their typo. Outside the builder the env var is unset and the label stays "OpenAI". */
const PROVIDER_LABEL =
  process.env.ALG_BUILDER_PROVIDER === "anthropic"
    ? "Anthropic"
    : process.env.ALG_BUILDER_PROVIDER === "openai-compatible"
      ? "OpenAI-compatible endpoint"
      : "OpenAI";

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function outputText(response: JsonObject): string {
  const output = response.output;
  if (!Array.isArray(output)) throw new Error(`${PROVIDER_LABEL} response contains no output array`);
  for (const item of output) {
    if (!isObject(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isObject(content) && content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  throw new Error(`${PROVIDER_LABEL} response contains no output_text content`);
}

function billedTokenCount(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${PROVIDER_LABEL} response usage.${field} must be a non-negative integer`);
  }
  return value as number;
}

function responseUsage(response: JsonObject): RunUsageTokens {
  if (!isObject(response.usage)) {
    throw new Error(`${PROVIDER_LABEL} response contains no usage object`);
  }
  const input = billedTokenCount(response.usage.input_tokens, "input_tokens");
  const output = billedTokenCount(response.usage.output_tokens, "output_tokens");
  const total = billedTokenCount(response.usage.total_tokens, "total_tokens");
  if (total !== input + output) {
    throw new Error(
      `${PROVIDER_LABEL} response usage.total_tokens (${total}) does not equal input_tokens + output_tokens (${input + output})`,
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

  private async api(
    path: string,
    init: RequestInit = {},
    options: Pick<ResponsesRequestOptions, "signal" | "timeoutMs"> = {},
  ): Promise<JsonObject> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("request timeout must be a positive safe integer");
    }
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = (): void => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromCaller();
    else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`${PROVIDER_LABEL} API request timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    timer.unref?.();

    try {
      const response = await fetch(`https://api.openai.com/v1${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...(init.headers ?? {}),
        },
      });
      const raw = (await response.json()) as JsonObject;
      if (!response.ok) {
        const error = isObject(raw.error) && typeof raw.error.message === "string" ? raw.error.message : JSON.stringify(raw);
        throw new Error(`${PROVIDER_LABEL} API ${response.status} ${path}: ${error}`);
      }
      return raw;
    } catch (error) {
      if (timedOut) throw new Error(`${PROVIDER_LABEL} API request timed out after ${timeoutMs} ms`, { cause: error });
      if (options.signal?.aborted) {
        throw options.signal.reason instanceof Error
          ? options.signal.reason
          : new Error(`${PROVIDER_LABEL} API request aborted`, { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async initialize(): Promise<void> {
    const candidates = [...new Set(MODEL_CANDIDATES)];
    for (const model of candidates) {
      try {
        await this.api(`/models/${encodeURIComponent(model)}`);
        this.model = model;
        break;
      } catch (error) {
        const description = String(error);
        // A 401/403 on the model probe is a rejected KEY, not a missing model. Falling through to
        // "none of the pinned candidates are available" blames the model and sends the teacher
        // hunting for model access when the fix is retyping the key.
        if (/\bAPI 40[13]\b/u.test(description)) {
          throw new Error("Your API key was rejected by the provider — check the key and rebuild. Nothing was generated.");
        }
        console.warn(`Model ${model} unavailable: ${description}`);
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
    options: ResponsesRequestOptions = {},
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
    const response = await this.api(
      "/responses",
      { method: "POST", body: JSON.stringify(body) },
      options,
    );
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
