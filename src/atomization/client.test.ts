import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsesClient } from "./client";

const responseBody = (
  id: string,
  inputTokens: number,
  outputTokens: number,
): string => JSON.stringify({
  id,
  model: "gpt-5.6-sol-2026-07-01",
  usage: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  },
  output: [
    {
      content: [
        { type: "output_text", text: JSON.stringify({ ok: true }) },
      ],
    },
  ],
});

describe("ResponsesClient usage accounting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("accumulates billed tokens across every Responses API call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(responseBody("resp_1", 100, 40)))
      .mockResolvedValueOnce(new Response(responseBody("resp_2", 25, 10)));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ResponsesClient("test-key");
    client.model = "gpt-5.6-sol";
    await client.request("instructions", "input", {}, "first");
    await client.request("instructions", "input", {}, "second");

    expect(client.usageTokens).toEqual({ input: 125, output: 50, total: 175 });
    expect(client.responseIds).toEqual(["resp_1", "resp_2"]);
  });

  it("forwards an external AbortSignal to fetch", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async (_input: string, init: RequestInit) => await new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const client = new ResponsesClient("test-key");
    client.model = "gpt-5.6-sol";

    const pending = client.request(
      "instructions",
      "input",
      {},
      "aborted",
      { signal: controller.signal, timeoutMs: 10_000 },
    );
    controller.abort(new Error("caller cancelled"));

    await expect(pending).rejects.toThrow(/caller cancelled/i);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("diagnoses a 401 on the model probe as a rejected key, never as a missing model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Incorrect API key provided" } }), { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ResponsesClient("wrong-key");

    const error = await client.initialize().catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Your API key was rejected by the provider — check the key and rebuild. Nothing was generated.",
    );
    expect((error as Error).message).not.toMatch(/pinned GPT-5\.x candidates/u);
  });

  it("diagnoses a 403 on the model probe the same way", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "forbidden" } }), { status: 403 }),
    ));
    const client = new ResponsesClient("revoked-key");
    await expect(client.initialize()).rejects.toThrow(/API key was rejected by the provider/u);
  });

  it("keeps the missing-model diagnosis for non-auth probe failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }),
    ));
    const client = new ResponsesClient("valid-key");
    await expect(client.initialize()).rejects.toThrow(/none of the pinned GPT-5\.x candidates are available/u);
  });

  it("brands provider errors with the endpoint the builder actually routed to", async () => {
    // PROVIDER_LABEL is resolved at module load from the builder's routing env var
    // (builder/provider-fetch.mjs rewrites the transport; the label must follow it).
    vi.resetModules();
    vi.stubEnv("ALG_BUILDER_PROVIDER", "anthropic");
    try {
      const { ResponsesClient: RoutedClient } = await import("./client");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 500 }),
      ));
      const client = new RoutedClient("wrong-anthropic-key");
      client.model = "claude-opus-4-8";

      const error = await client.request("i", "in", {}, "probe").catch((caught: Error) => caught);
      expect((error as Error).message).toMatch(/^Anthropic API 500/u);
      expect((error as Error).message).not.toContain("OpenAI");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("aborts a request that exceeds its timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      async (_input: string, init: RequestInit) => await new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ResponsesClient("test-key");
    client.model = "gpt-5.6-sol";

    const pending = client.request(
      "instructions",
      "input",
      {},
      "timed_out",
      { timeoutMs: 25 },
    );
    const rejection = expect(pending).rejects.toThrow(/timed out.*25 ms/i);
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
  });
});
