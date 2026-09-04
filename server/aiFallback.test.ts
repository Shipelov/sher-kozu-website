import { afterEach, describe, expect, it, vi } from "vitest";

async function loadFallback() {
  vi.resetModules();
  return import("./aiFallback");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("assistant-specific AI fallback", () => {
  it("uses the fixed Masha endpoint and marks the request as a single fallback hop", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_FALLBACK_ALLOW_IN_TESTS", "true");
    vi.stubEnv("AI_FALLBACK_BASE_URL", "https://fallback.example.test/");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { result: { data: { json: { reply: "Маша работает", uncertain: false } } } },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { AI_FALLBACK_HEADER, requestMashaFallback } = await loadFallback();
    const result = await requestMashaFallback({
      messages: [{ role: "user", content: "Привет" }],
      sessionId: "test-session",
      source: "faq",
    });

    expect(result?.reply).toBe("Маша работает");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://fallback.example.test/api/trpc/faqChat.chat?batch=1",
    );
    expect(new Headers(init?.headers).get(AI_FALLBACK_HEADER)).toBe("1");
  });

  it("uses only the Zoya chat endpoint and returns the assistant reply", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_FALLBACK_ALLOW_IN_TESTS", "true");
    vi.stubEnv("AI_FALLBACK_BASE_URL", "https://fallback.example.test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            result: {
              data: {
                json: {
                  reply: "Зоя работает",
                  userType: "guest",
                  limitReached: false,
                },
              },
            },
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const { requestZoyaFallback } = await loadFallback();
    const result = await requestZoyaFallback({
      messages: [{ role: "user", content: "Привет" }],
      fingerprint: "guest-test",
    });

    expect(result).toEqual({
      reply: "Зоя работает",
      userType: "guest",
      limitReached: false,
    });
  });

  it("detects the hop header that prevents recursive fallback", async () => {
    const { AI_FALLBACK_HEADER, isAiFallbackHop } = await loadFallback();

    expect(isAiFallbackHop({})).toBe(false);
    expect(isAiFallbackHop({ [AI_FALLBACK_HEADER]: "1" })).toBe(true);
  });

  it("returns null instead of leaking upstream errors", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AI_FALLBACK_ALLOW_IN_TESTS", "true");
    vi.stubEnv("AI_FALLBACK_BASE_URL", "https://fallback.example.test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unauthorized", { status: 401 }),
    );

    const { requestMashaFallback } = await loadFallback();
    await expect(
      requestMashaFallback({
        messages: [{ role: "user", content: "Привет" }],
      }),
    ).resolves.toBeNull();
  });
});
