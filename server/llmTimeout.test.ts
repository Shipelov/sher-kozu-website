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

import { invokeLLM } from "./_core/llm";

function abortAwarePendingFetch(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
}

describe("invokeLLM timeout and abort", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("aborts a stalled fetch after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(abortAwarePendingFetch);
    vi.stubGlobal("fetch", fetchMock);

    const request = invokeLLM({
      messages: [{ role: "user", content: "Тест" }],
      timeoutMs: 40,
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(40);
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("forwards a caller abort to the active fetch", async () => {
    const fetchMock = vi.fn(abortAwarePendingFetch);
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const request = invokeLLM({
      messages: [{ role: "user", content: "Тест" }],
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
