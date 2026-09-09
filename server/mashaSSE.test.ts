import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runMashaChatMock = vi.hoisted(() => vi.fn());
const recordMashaTurnMock = vi.hoisted(() => vi.fn());
const checkChatRateLimitMock = vi.hoisted(() => vi.fn());
const authenticateRequestMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: authenticateRequestMock },
}));

vi.mock("./assistants/mashaChat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./assistants/mashaChat")>();
  return { ...actual, runMashaChat: runMashaChatMock };
});

vi.mock("./assistants/mashaAnalytics", () => ({
  recordMashaTurn: recordMashaTurnMock,
}));

vi.mock("./assistants/mashaRateLimit", () => ({
  checkChatRateLimit: checkChatRateLimitMock,
}));

import { MASHA_SSE_PATH, registerMashaSSE } from "./mashaSSE";

type Handler = (req: unknown, res: MockResponse) => Promise<unknown>;

class MockResponse extends EventEmitter {
  headers = new Map<string, string>();
  chunks: string[] = [];
  writableEnded = false;
  destroyed = false;
  statusCode = 200;

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }
  flushHeaders() {}
  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }
  end() {
    this.writableEnded = true;
  }
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(value: unknown) {
    this.chunks.push(JSON.stringify(value));
    this.writableEnded = true;
    return this;
  }
  events(): Array<Record<string, unknown> | "[DONE]"> {
    return this.chunks
      .filter((chunk) => chunk.startsWith("data: "))
      .map((chunk) => {
        const data = chunk.slice(6).trim();
        return data === "[DONE]" ? "[DONE]" : (JSON.parse(data) as Record<string, unknown>);
      });
  }
}

function createHandler(): { handler: Handler; path: string } {
  let handler: Handler | null = null;
  let path = "";
  registerMashaSSE({
    post: (routePath: string, routeHandler: Handler) => {
      path = routePath;
      handler = routeHandler;
    },
  } as unknown as Parameters<typeof registerMashaSSE>[0]);
  if (!handler) throw new Error("handler not registered");
  return { handler, path };
}

const request = (body: unknown) => ({ body, ip: "203.0.113.9" });

beforeEach(() => {
  vi.clearAllMocks();
  authenticateRequestMock.mockResolvedValue(null);
  checkChatRateLimitMock.mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/masha/chat/stream", () => {
  it("регистрируется по контрактному пути", () => {
    expect(createHandler().path).toBe(MASHA_SSE_PATH);
    expect(MASHA_SSE_PATH).toBe("/api/masha/chat/stream");
  });

  it("стримит meta → tool → chunk → done → [DONE] и пишет аналитику с toolTrace", async () => {
    runMashaChatMock.mockImplementation(async ({ onChunk, onToolCall, userOpenId }) => {
      onToolCall("list_animals");
      onChunk("У нас ");
      onChunk("две овцы.");
      return {
        text: "У нас две овцы.",
        reply: "У нас две овцы.",
        outcome: "ok",
        toolTrace: [{ name: "list_animals", args: {}, ok: true, latencyMs: 12 }],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, llmCalls: 2 },
        rounds: 2,
        finishedBy: "model",
        userOpenId,
      };
    });
    const { handler } = createHandler();
    const res = new MockResponse();

    await handler(request({ messages: [{ role: "user", content: "сколько овец" }], sessionId: "s1", source: "floating" }), res);

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    expect(res.events()).toEqual([
      { type: "meta", authenticated: false },
      { type: "tool", name: "list_animals" },
      { type: "chunk", content: "У нас " },
      { type: "chunk", content: "две овцы." },
      { type: "done", outcome: "ok", uncertain: false },
      "[DONE]",
    ]);
    expect(res.writableEnded).toBe(true);
    expect(recordMashaTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "сколько овец",
        answer: "У нас две овцы.",
        sessionId: "s1",
        source: "floating",
        outcome: "ok",
        toolTrace: [expect.objectContaining({ name: "list_animals" })],
      }),
    );
    const call = runMashaChatMock.mock.calls[0][0] as { userOpenId: string | null; input: { messages: unknown[] } };
    expect(call.userOpenId).toBeNull();
    expect(call.input.messages).toHaveLength(1);
  });

  it("передаёт openId авторизованного пользователя", async () => {
    authenticateRequestMock.mockResolvedValue({ openId: "owner-1", deletedAt: null });
    runMashaChatMock.mockImplementation(async ({ onChunk }) => {
      onChunk("ок");
      return { text: "ок", reply: "ок", outcome: "ok", toolTrace: [], usage: {}, rounds: 1, finishedBy: "model" };
    });
    const { handler } = createHandler();
    const res = new MockResponse();
    await handler(request({ messages: [{ role: "user", content: "мои животные" }] }), res);
    expect(res.events()[0]).toEqual({ type: "meta", authenticated: true });
    expect((runMashaChatMock.mock.calls[0][0] as { userOpenId: string }).userOpenId).toBe("owner-1");
  });

  it("отвечает 400 на некорректное тело и 429 при превышении лимита", async () => {
    const { handler } = createHandler();
    const bad = new MockResponse();
    await handler(request({ messages: [] }), bad);
    expect(bad.statusCode).toBe(400);
    expect(runMashaChatMock).not.toHaveBeenCalled();

    checkChatRateLimitMock.mockReturnValue(false);
    const limited = new MockResponse();
    await handler(request({ messages: [{ role: "user", content: "привет" }] }), limited);
    expect(limited.statusCode).toBe(429);
    expect(checkChatRateLimitMock).toHaveBeenCalledWith("203.0.113.9");
    expect(runMashaChatMock).not.toHaveBeenCalled();
  });

  it("при ошибке ассистента отдаёт fallback-текст и закрывает поток", async () => {
    runMashaChatMock.mockRejectedValue(new Error("LLM down"));
    const { handler } = createHandler();
    const res = new MockResponse();
    await handler(request({ messages: [{ role: "user", content: "привет" }], sessionId: "s2" }), res);

    const events = res.events();
    expect(events[1]).toEqual({ type: "error" });
    expect(events[2]).toMatchObject({ type: "chunk" });
    expect(String((events[2] as Record<string, unknown>).content)).toContain("пошло не так");
    expect(events[3]).toEqual({ type: "done", outcome: "error", uncertain: false });
    expect(events[4]).toBe("[DONE]");
    expect(recordMashaTurnMock).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error", sessionId: "s2" }));
  });

  it("при пустом ответе модели шлёт fallback чанком", async () => {
    runMashaChatMock.mockResolvedValue({ text: "", reply: "Простите, технические трудности", outcome: "error", toolTrace: [], usage: {}, rounds: 1, finishedBy: "model" });
    const { handler } = createHandler();
    const res = new MockResponse();
    await handler(request({ messages: [{ role: "user", content: "привет" }] }), res);
    expect(res.events()).toContainEqual({ type: "chunk", content: "Простите, технические трудности" });
  });

  it("прерывает работу ассистента при закрытии соединения", async () => {
    let capturedSignal: AbortSignal | undefined;
    runMashaChatMock.mockImplementation(async ({ signal }) => {
      capturedSignal = signal;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { text: "поздно", reply: "поздно", outcome: "ok", toolTrace: [], usage: {}, rounds: 1, finishedBy: "model" };
    });
    const { handler } = createHandler();
    const res = new MockResponse();
    const pending = handler(request({ messages: [{ role: "user", content: "привет" }] }), res);
    await new Promise((resolve) => setTimeout(resolve, 5));
    res.emit("close");
    await pending;
    expect(capturedSignal?.aborted).toBe(true);
    expect(res.events()).not.toContainEqual({ type: "chunk", content: "поздно" });
    expect(recordMashaTurnMock).not.toHaveBeenCalled();
  });
});
