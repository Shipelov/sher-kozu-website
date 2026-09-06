import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assembleZoyaContextMock = vi.hoisted(() => vi.fn());
const buildZoyaProfileGateReplyMock = vi.hoisted(() => vi.fn());
const runZoyaOrchestratorMock = vi.hoisted(() => vi.fn());
const saveNutriConversationMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn().mockResolvedValue(null) },
}));

vi.mock("./nutritionistDb", () => ({
  getGuestMessageCount: vi.fn().mockResolvedValue(0),
  determineNutriUserType: vi.fn().mockResolvedValue("guest"),
  saveNutriConversation: saveNutriConversationMock,
}));

vi.mock("./zoyaContextAssembler", () => ({
  assembleZoyaContext: assembleZoyaContextMock,
  buildZoyaSessionState: vi.fn().mockReturnValue({ intent: "general_information", collected: {} }),
}));

vi.mock("./zoyaProfileGate", () => ({
  buildZoyaProfileGateMeta: vi.fn((context) => ({ status: context.status })),
  buildZoyaProfileGateReply: buildZoyaProfileGateReplyMock,
}));

vi.mock("./zoyaOrchestrator", () => ({
  runZoyaOrchestrator: runZoyaOrchestratorMock,
  buildZoyaValidationFallback: vi.fn().mockReturnValue("Ответ не прошёл проверку фактов."),
}));

vi.mock("./zoyaChatRuntime", () => ({
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

function requestBody(content = "Расскажи о козьем молоке") {
  return {
    body: {
      messages: [{ role: "user", content }],
      fingerprint: "sse-test-fingerprint",
    },
  };
}

const assembledContext = {
  status: "ready",
  intent: "general_information",
  originalQuery: "Расскажи о козьем молоке",
  effectiveQuery: "Расскажи о козьем молоке",
  requiresPersonalization: false,
  profileConfirmed: false,
  profile: null,
  profileRequirements: null,
  pendingClarifications: [],
  confirmedProducts: [],
  availableProductVariants: [],
  ownerContext: null,
  ragEntries: [],
  evidence: [],
  calculationTargets: {
    calorieTarget: null,
    calorieTargetSource: "unavailable",
    calorieRange: null,
    proteinRangeG: null,
    requestedDairyShare: null,
    assumptions: [],
  },
};

describe("Zoya SSE reliability", () => {
  beforeEach(() => {
    assembleZoyaContextMock.mockReset().mockResolvedValue(assembledContext);
    buildZoyaProfileGateReplyMock.mockReset().mockReturnValue(null);
    runZoyaOrchestratorMock.mockReset();
    saveNutriConversationMock.mockReset().mockResolvedValue(77);
  });

  it("returns a profile/request clarification before any external AI call", async () => {
    const clarification = "Уточните, что означает 30%: доля калорийности, массы еды или поставки.";
    buildZoyaProfileGateReplyMock.mockReturnValue(clarification);
    const res = new MockResponse();

    await createHandler()(requestBody("Сделай меню с 30% моей продукции"), res);

    const stream = res.chunks.join("");
    expect(stream).toContain(clarification);
    expect(stream).toContain('"type":"session","sessionId":77');
    expect(stream).toContain("data: [DONE]");
    expect(runZoyaOrchestratorMock).not.toHaveBeenCalled();
    expect(res.writableEnded).toBe(true);
  });

  it("streams a validated orchestrator answer and returns sessionId", async () => {
    runZoyaOrchestratorMock.mockResolvedValue({ markdown: "## Проверенный ответ" });
    const res = new MockResponse();

    await createHandler()(requestBody(), res);

    const stream = res.chunks.join("");
    const streamedContent = stream
      .split("\n")
      .filter((line) => line.startsWith("data: {") && line.includes('"type":"chunk"'))
      .map((line) => JSON.parse(line.slice(6)).content)
      .join("");
    expect(stream).toContain('"type":"meta"');
    expect(stream).toContain('"type":"session","sessionId":77');
    expect(streamedContent).toContain("Проверенный ответ");
    expect(stream).toContain("data: [DONE]");
  });

  it("returns a meaningful chunk and [DONE] when the orchestrator times out", async () => {
    runZoyaOrchestratorMock.mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
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

  it("aborts the orchestrator when the client closes the response", async () => {
    let upstreamSignal: AbortSignal | undefined;
    runZoyaOrchestratorMock.mockImplementation((_context, _messages, options) => {
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
