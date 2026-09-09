import { afterEach, describe, expect, it, vi } from "vitest";

async function loadLlm() {
  vi.resetModules();
  return import("./_core/llm");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function stubWorkerEnv() {
  vi.stubEnv("OPENAI_API_KEY", "proxy-secret");
  vi.stubEnv("OPENAI_API_URL", "https://tg-proxy.example.workers.dev");
  vi.stubEnv("BUILT_IN_FORGE_API_URL", "");
  vi.stubEnv("BUILT_IN_FORGE_API_KEY", "");
}

/** Поток байтов, порезанный на куски произвольного размера — границы событий не совпадают с чанками */
function byteStream(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
      }
      controller.close();
    },
  });
}

const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
  `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;

describe("readSseDataLines", () => {
  it("склеивает события через границы чанков, поддерживает CRLF и останавливается на [DONE]", async () => {
    const { readSseDataLines } = await loadLlm();
    const text = [
      ": comment\n\n",
      "event: message\ndata: {\"a\":1}\n\n",
      "data: line1\ndata: line2\r\n\r\n",
      "data: [DONE]\n\n",
      "data: {\"after\":\"done\"}\n\n",
    ].join("");
    const seen: string[] = [];
    for await (const data of readSseDataLines(byteStream(text, 5))) seen.push(data);
    expect(seen).toEqual(['{"a":1}', "line1\nline2"]);
  });
});

describe("extractStreamDeltaText", () => {
  it("возвращает текстовую дельту, пустую строку без content и бросает на ошибке провайдера", async () => {
    const { extractStreamDeltaText } = await loadLlm();
    expect(extractStreamDeltaText(JSON.stringify({ choices: [{ delta: { role: "assistant" } }] }))).toBe("");
    expect(extractStreamDeltaText(JSON.stringify({ choices: [{ delta: { content: "При" } }] }))).toBe("При");
    expect(() => extractStreamDeltaText("{not json")).toThrow(/неразбираемый chunk/);
    expect(() => extractStreamDeltaText(JSON.stringify({ error: { message: "overloaded sk-abcdefghijklmnopqrstuvwxyz" } }))).toThrow(/LLM stream error/);
    expect(() => extractStreamDeltaText(JSON.stringify({ error: { message: "key sk-abcdefghijklmnopqrstuvwxyz" } }))).toThrow(/\[REDACTED\]/);
    expect(() => extractStreamDeltaText(JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0 }] } }] }))).toThrow(/tool_calls/);
  });
});

describe("invokeLLMStream", () => {
  it("шлёт stream:true с alias claude-sonnet и отдаёт дельты по мере чтения", async () => {
    stubWorkerEnv();
    const sse = chunk({ role: "assistant", content: "" }) + chunk({ content: "Прив" }) + chunk({ content: "ет" }) + chunk({}, "stop") + "data: [DONE]\n\n";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(byteStream(sse, 7), { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
    const { invokeLLMStream } = await loadLlm();

    const parts: string[] = [];
    for await (const part of invokeLLMStream({ messages: [{ role: "user", content: "Привет" }] })) parts.push(part);

    expect(parts).toEqual(["Прив", "ет"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tg-proxy.example.workers.dev/openai/v1/chat/completions");
    const body = JSON.parse(String(init?.body));
    expect(body.stream).toBe(true);
    expect(body.model).toBe("claude-sonnet");
    expect(body.max_tokens).toBe(2048);
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer proxy-secret");
  });

  it("при JSON-ответе (fallback Worker без stream) отдаёт content одной дельтой", async () => {
    stubWorkerEnv();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "x", created: 1, model: "llama", choices: [{ index: 0, message: { role: "assistant", content: "Ответ целиком" }, finish_reason: "stop" }] }), {
        status: 200,
        headers: { "content-type": "application/json", "x-koza-fallback": "workers-ai" },
      }),
    );
    const { invokeLLMStream } = await loadLlm();
    const parts: string[] = [];
    for await (const part of invokeLLMStream({ messages: [{ role: "user", content: "x" }] })) parts.push(part);
    expect(parts).toEqual(["Ответ целиком"]);
  });

  it("бросает понятную ошибку при tools и санитизированную при не-2xx", async () => {
    stubWorkerEnv();
    const { invokeLLMStream } = await loadLlm();
    const withTools = invokeLLMStream({
      messages: [{ role: "user", content: "x" }],
      tools: [{ type: "function", function: { name: "f" } }],
    });
    await expect(withTools.next()).rejects.toThrow(/не поддерживает tools/);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key sk-abcdefghijklmnopqrstuvwxyz" } }), { status: 401, statusText: "Unauthorized" }),
    );
    const failing = invokeLLMStream({ messages: [{ role: "user", content: "x" }] });
    await expect(failing.next()).rejects.toThrow(/LLM stream failed: 401/);
    await expect(invokeLLMStream({ messages: [{ role: "user", content: "x" }] }).next()).rejects.not.toThrow(/sk-abcdefghijklmnopqrstuvwxyz/);
  });

  it("прерывается по abort-сигналу вызывающего кода", async () => {
    stubWorkerEnv();
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      }),
    );
    const { invokeLLMStream } = await loadLlm();
    const controller = new AbortController();
    const iterator = invokeLLMStream({ messages: [{ role: "user", content: "x" }], signal: controller.signal });
    const pending = iterator.next();
    controller.abort(new Error("клиент отключился"));
    await expect(pending).rejects.toThrow(/клиент отключился/);
  });
});
