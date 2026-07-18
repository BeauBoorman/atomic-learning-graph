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
