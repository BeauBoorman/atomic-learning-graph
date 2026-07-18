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
});
