import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({
  openaiApiUrl: "",
  openaiApiKeyDirect: "",
  forgeApiUrl: "https://forge.example.com",
  forgeApiKey: "forge-test-key",
  telegramApiProxyUrl: "",
  isProduction: false,
}));

vi.mock("./_core/env", () => ({ ENV: envMock }));

import { invokeLLM, DEFAULT_MAX_TOKENS, RETRY_DELAY_MS } from "./_core/llm";

const okResponse = () =>
  new Response(
    JSON.stringify({
      id: "r1",
      created: 1,
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const errorResponse = (status: number, body = "upstream failure") =>
  new Response(body, { status, statusText: "Upstream", headers: { "content-type": "text/plain" } });

const params = { messages: [{ role: "user" as const, content: "Тест" }] };

describe("invokeLLM retry", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults max_tokens to 2048", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM(params);

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(DEFAULT_MAX_TOKENS).toBe(2048);
    expect(payload.max_tokens).toBe(2048);
  });

  it.each([429, 502, 503, 504])("retries once after %i with an 800ms delay", async (status) => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(status))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const request = invokeLLM({ ...params, timeoutMs: 10_000 });
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    const result = await request;
    expect(result.choices[0].message.content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once after a network error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const request = invokeLLM({ ...params, timeoutMs: 10_000 });
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);

    await expect(request).resolves.toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Размер тела попадает в лог сетевой ошибки — для диагностики обрывов на прокси
    const sentBody = String((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(`attempt=1 bodyBytes=${Buffer.byteLength(sentBody)}`),
    );
  });

  it("logs the body size when the last attempt fails with a network error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const request = invokeLLM({ ...params, timeoutMs: 10_000 });
    const expectation = expect(request).rejects.toThrow("fetch failed");
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    await expectation;

    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/attempt=2 bodyBytes=\d+/), expect.any(Error));
  });

  it("does not retry more than once", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async () => errorResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    const request = invokeLLM({ ...params, timeoutMs: 10_000 });
    const rejection = expect(request).rejects.toThrow(/LLM invoke failed: 503/);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 500])("does not retry on %i", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(status));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLLM(params)).rejects.toThrow(new RegExp(`LLM invoke failed: ${status}`));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the remaining timeout budget is smaller than the delay", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLLM({ ...params, timeoutMs: 500 })).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry after a caller abort during a network error", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(() => {
      controller.abort();
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      invokeLLM({ ...params, signal: controller.signal, timeoutMs: 10_000 }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops waiting for the retry when the caller aborts during the delay", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(503));
    vi.stubGlobal("fetch", fetchMock);

    const request = invokeLLM({ ...params, signal: controller.signal, timeoutMs: 10_000 });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps only the status and a short sanitized snippet in the error message", async () => {
    const secretBody = `{"error":"prompt leak: ${"п".repeat(500)} key sk-abcdef123456"}`;
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(500, secretBody));
    vi.stubGlobal("fetch", fetchMock);

    let caught: Error | null = null;
    try {
      await invokeLLM(params);
    } catch (error) {
      caught = error as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/^LLM invoke failed: 500 Upstream – /);
    const snippet = caught!.message.replace(/^LLM invoke failed: 500 Upstream – /, "");
    expect(snippet.length).toBeLessThanOrEqual(200);
    expect(caught!.message).not.toContain("sk-abcdef123456");
    expect(caught!.message.length).toBeLessThan(secretBody.length);
  });

  it("redacts secrets that fall inside the snippet", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => errorResponse(500, "bad key sk-abcdef123456 Bearer tok.en-1"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeLLM(params)).rejects.toThrow(/\[REDACTED\]/);
    await expect(invokeLLM(params)).rejects.not.toThrow(/sk-abcdef123456/);
  });
});
