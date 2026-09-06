import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeZoyaLLMMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn().mockResolvedValue(null) },
}));

vi.mock("./nutritionistDb", () => ({
  createNutriSession: vi.fn(),
  addNutriMessage: vi.fn(),
  getGuestMessageCount: vi.fn().mockResolvedValue(0),
  getNutriProfile: vi.fn().mockResolvedValue(null),
  determineNutriUserType: vi.fn().mockResolvedValue("guest"),
  getOwnerNutriContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("./prompts/zoyaSystemPrompt", () => ({
  buildZoyaPrompt: vi.fn().mockReturnValue("system prompt"),
}));

vi.mock("./zoyaRag", () => ({
  getZoyaRagEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock("./zoyaSportsMenuAdvisor", () => ({
  buildGroundedSportsMenuReply: vi.fn().mockReturnValue(null),
}));

vi.mock("./zoyaChatRuntime", () => ({
  invokeZoyaLLM: invokeZoyaLLMMock,
  ZOYA_TEMPORARY_UNAVAILABLE_REPLY:
    "Сейчас внешний AI-сервис отвечает слишком долго. Я остановила ожидание, чтобы чат не завис. 🌿",
}));

import { registerZoyaSSE } from "./zoyaSSE";

type Handler = (req: any, res: any) => Promise<void>;

class MockResponse extends EventEmitter {
  headers = new Map<string, string>();
  chunks: string[] = [];
  writableEnded = false;
  destroyed = false;
  statusCode = 200;

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

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
}

function createHandler(): Handler {
  let handler: Handler | null = null;
  registerZoyaSSE({
    post: (_path: string, routeHandler: Handler) => {
      handler = routeHandler;
    },
  } as any);
  if (!handler) throw new Error("SSE handler was not registered");
  return handler;
}

function requestBody() {
  return {
    body: {
      messages: [{ role: "user", content: "Расскажи о козьем молоке" }],
    },
  };
}

describe("Zoya SSE reliability", () => {
  beforeEach(() => {
    invokeZoyaLLMMock.mockReset();
  });

  it("returns a meaningful chunk and [DONE] when the upstream times out", async () => {
    invokeZoyaLLMMock.mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = new MockResponse();

    await createHandler()(requestBody(), res);

    const stream = res.chunks.join("");
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(stream).toContain('"type":"meta"');
    expect(stream).toContain('"type":"chunk"');
    expect(stream).toContain("остановила ожидание");
    expect(stream).toContain("data: [DONE]");
    expect(res.writableEnded).toBe(true);
    errorSpy.mockRestore();
  });

  it("aborts the upstream request when the client closes the response", async () => {
    let upstreamSignal: AbortSignal | undefined;
    invokeZoyaLLMMock.mockImplementation((_messages, options) => {
      upstreamSignal = options.signal;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = new MockResponse();
    const responsePromise = createHandler()(requestBody(), res);

    await vi.waitFor(() => expect(upstreamSignal).toBeDefined());
    res.destroyed = true;
    res.emit("close");
    await responsePromise;

    expect(upstreamSignal?.aborted).toBe(true);
    expect(res.chunks.join("")).not.toContain("остановила ожидание");
    expect(res.writableEnded).toBe(false);
    errorSpy.mockRestore();
  });
});
