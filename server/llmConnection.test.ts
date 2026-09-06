import { afterEach, describe, expect, it, vi } from "vitest";

const okResponse = () =>
  new Response(
    JSON.stringify({
      id: "test-response",
      created: 1,
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Работаю" },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

async function loadInvokeLLM() {
  vi.resetModules();
  return (await import("./_core/llm")).invokeLLM;
}

async function loadDiagnoseLLMConnection() {
  vi.resetModules();
  return (await import("./_core/llm")).diagnoseLLMConnection;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("LLM connection resolution", () => {
  it("pairs the Forge URL with the Forge key even when a stale OpenAI key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "stale-openai-key");
    vi.stubEnv("OPENAI_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.example.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "valid-forge-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const invokeLLM = await loadInvokeLLM();
    await invokeLLM({
      messages: [{ role: "user", content: "Привет" }],
      maxTokens: 128,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://forge.example.test/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer valid-forge-key",
    );
    const payload = JSON.parse(String(init?.body));
    expect(payload.model).toBe("gemini-3-flash-preview");
    expect(payload.max_tokens).toBe(128);
  });

  it("normalizes the Cloudflare Worker root to the /openai route", async () => {
    vi.stubEnv("OPENAI_API_KEY", "custom-openai-key");
    vi.stubEnv("OPENAI_API_URL", "https://tg-proxy.example.workers.dev/");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.example.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "forge-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const invokeLLM = await loadInvokeLLM();
    await invokeLLM({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Привет" }],
      maxTokens: 256,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://tg-proxy.example.workers.dev/openai/v1/chat/completions",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer custom-openai-key",
    );
    const payload = JSON.parse(String(init?.body));
    expect(payload.model).toBe("gpt-5-mini");
    expect(payload.max_completion_tokens).toBe(256);
    expect(payload.max_tokens).toBeUndefined();
  });

  it("derives the OpenAI route from the existing Telegram Cloudflare Worker", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "custom-openai-key");
    vi.stubEnv("OPENAI_API_URL", "");
    vi.stubEnv(
      "TELEGRAM_API_PROXY_URL",
      "https://tg-proxy.example.workers.dev",
    );
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.example.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "forge-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const invokeLLM = await loadInvokeLLM();
    await invokeLLM({ messages: [{ role: "user", content: "Привет" }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://tg-proxy.example.workers.dev/openai/v1/chat/completions",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer custom-openai-key",
    );
    expect(JSON.parse(String(init?.body)).model).toBe("gpt-4o-mini");
  });

  it("uses a custom OpenAI pair when Forge is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "custom-openai-key");
    vi.stubEnv("OPENAI_API_URL", "https://openai-proxy.example.test/");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const invokeLLM = await loadInvokeLLM();
    await invokeLLM({ messages: [{ role: "user", content: "Привет" }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openai-proxy.example.test/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer custom-openai-key",
    );
  });

  it("falls back to the direct OpenAI endpoint when Forge is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "direct-openai-key");
    vi.stubEnv("OPENAI_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const invokeLLM = await loadInvokeLLM();
    await invokeLLM({ messages: [{ role: "user", content: "Привет" }] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer direct-openai-key",
    );
  });

  it("returns safe Cloudflare diagnostics without exposing credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-sensitive-diagnostic-key");
    vi.stubEnv("OPENAI_API_URL", "https://tg-proxy.example.workers.dev");
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: "invalid_request_error",
            code: "invalid_api_key",
            message: "Invalid key sk-sensitive-diagnostic-key",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );

    const diagnoseLLMConnection = await loadDiagnoseLLMConnection();
    const result = await diagnoseLLMConnection();

    expect(result).toMatchObject({
      ok: false,
      source: "cloudflare-openai",
      model: "worker-managed (request alias: gpt-4o-mini)",
      endpointHost: "tg-proxy.example.workers.dev",
      endpointPath: "/openai/v1/chat/completions",
      status: 401,
      error: {
        type: "invalid_request_error",
        code: "invalid_api_key",
      },
    });
    expect(JSON.stringify(result)).not.toContain("sk-sensitive-diagnostic-key");
    expect(result.error?.message).toContain("[REDACTED]");
  });
});
