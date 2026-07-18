const OPENAI_API_ORIGIN = "https://api.openai.com";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

function redactSecret(value, secret) {
  if (typeof value !== "string" || !secret) return value;
  return value.split(secret).join("[redacted]");
}

function readBearerSecret(headers) {
  const authorization = new Headers(headers).get("authorization") ?? "";
  return authorization.replace(/^Bearer\s+/iu, "");
}

function responseEnvelope({ id, model, text }) {
  return {
    id,
    model,
    output: [{
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text }],
    }],
  };
}

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

async function redactedFailure(response, secret) {
  const body = redactSecret(await response.text(), secret);
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed?.error?.message ?? parsed?.message ?? body;
  } catch {
    // Provider error bodies are not guaranteed to be JSON.
  }
  return jsonResponse(
    { error: { message: redactSecret(String(message).slice(0, 4_000), secret) } },
    { status: response.status, statusText: response.statusText },
  );
}

function parseEngineRequest(init) {
  if (typeof init?.body !== "string") throw new Error("provider adapter expected a JSON request body");
  const body = JSON.parse(init.body);
  if (!body || typeof body !== "object" || typeof body.instructions !== "string" || typeof body.input !== "string") {
    throw new Error("provider adapter received an invalid atomizer request");
  }
  return body;
}

function structuredFormat(body) {
  const format = body.text?.format;
  return format?.type === "json_schema" && format.schema && typeof format.schema === "object"
    ? format
    : undefined;
}

export function normalizeCompatibleBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter an absolute HTTP(S) base URL for the compatible endpoint.");
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter an absolute HTTP(S) base URL without credentials, a query, or a fragment.");
  }
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/`;
  return url.href;
}

async function anthropicResponse({ body, headers, model, fetchImpl }) {
  const secret = readBearerSecret(headers);
  const format = structuredFormat(body);
  const requestBody = {
    model,
    max_tokens: body.max_output_tokens ?? 10_000,
    system: body.instructions,
    messages: [{ role: "user", content: body.input }],
    ...(format ? { output_config: { format: { type: "json_schema", schema: format.schema } } } : {}),
  };
  const response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": secret,
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) return redactedFailure(response, secret);
  const raw = await response.json();
  const text = raw?.content?.find((item) => item?.type === "text" && typeof item.text === "string")?.text;
  if (typeof text !== "string") throw new Error("Anthropic response contains no text content");
  return jsonResponse(responseEnvelope({ id: raw.id, model: raw.model ?? model, text }));
}

async function compatibleResponse({ body, headers, model, baseUrl, fetchImpl }) {
  const secret = readBearerSecret(headers);
  const format = structuredFormat(body);
  const requestHeaders = {
    "content-type": "application/json",
    ...(secret ? { authorization: `Bearer ${secret}` } : {}),
  };
  const requestBody = {
    model,
    messages: [
      { role: "system", content: body.instructions },
      { role: "user", content: body.input },
    ],
    max_tokens: body.max_output_tokens ?? 10_000,
    stream: false,
    ...(format ? {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: format.name,
          strict: format.strict === true,
          schema: format.schema,
        },
      },
    } : {}),
  };
  const response = await fetchImpl(new URL("chat/completions", baseUrl), {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) return redactedFailure(response, secret);
  const raw = await response.json();
  const text = raw?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("OpenAI-compatible response contains no message content");
  return jsonResponse(responseEnvelope({ id: raw.id, model: raw.model ?? model, text }));
}

/** Adapt the existing engine's server-side Responses calls without changing the offline reader. */
export function createProviderFetch({ provider, model, baseUrl, fetchImpl = globalThis.fetch }) {
  if (provider !== "anthropic" && provider !== "openai-compatible") {
    throw new Error(`unsupported fetch adapter provider: ${provider}`);
  }
  if (typeof model !== "string" || !model.trim()) throw new Error("provider adapter requires a model");
  const compatibleBaseUrl = provider === "openai-compatible" ? normalizeCompatibleBaseUrl(baseUrl) : undefined;

  return async function providerFetch(input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== OPENAI_API_ORIGIN) return fetchImpl(input, init);
    if (/^\/v1\/models\//u.test(url.pathname)) {
      return jsonResponse({ id: model, object: "model" });
    }
    if (url.pathname !== "/v1/responses") return fetchImpl(input, init);

    const body = parseEngineRequest(init);
    const headers = init.headers ?? {};
    return provider === "anthropic"
      ? anthropicResponse({ body, headers, model, fetchImpl })
      : compatibleResponse({ body, headers, model, baseUrl: compatibleBaseUrl, fetchImpl });
  };
}

const configuredProvider = process.env.ALG_BUILDER_PROVIDER;
if (configuredProvider === "anthropic" || configuredProvider === "openai-compatible") {
  globalThis.fetch = createProviderFetch({
    provider: configuredProvider,
    model: process.env.ALG_BUILDER_MODEL,
    baseUrl: process.env.ALG_BUILDER_BASE_URL,
    fetchImpl: globalThis.fetch.bind(globalThis),
  });
}
