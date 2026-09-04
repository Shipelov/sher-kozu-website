import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLM, requestZoyaFallback } = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  requestZoyaFallback: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM,
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockRejectedValue(new Error("anonymous")),
  },
}));

vi.mock("./nutritionistDb", () => ({
  createNutriSession: vi.fn().mockResolvedValue({ id: 1 }),
  addNutriMessage: vi.fn().mockResolvedValue(undefined),
  getGuestMessageCount: vi.fn().mockResolvedValue(0),
  getNutriProfile: vi.fn().mockResolvedValue(null),
  searchKnowledge: vi.fn().mockResolvedValue([]),
  determineNutriUserType: vi.fn().mockResolvedValue("guest"),
  getOwnerNutriContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./prompts/zoyaSystemPrompt", () => ({
  buildZoyaPrompt: vi.fn().mockReturnValue("system prompt"),
  extractSearchKeywords: vi.fn().mockReturnValue([]),
}));

vi.mock("./aiFallback", () => ({
  requestZoyaFallback,
  shouldUseAiFallback: vi.fn().mockReturnValue(true),
}));

import { registerZoyaSSE } from "./zoyaSSE";

type Handler = (req: any, res: any) => Promise<void>;

function createHandler(): Handler {
  let handler: Handler | undefined;
  const app = {
    post: vi.fn((_path: string, value: Handler) => {
      handler = value;
    }),
  };
  registerZoyaSSE(app as any);
  if (!handler) throw new Error("Zoya SSE handler was not registered");
  return handler;
}

function createResponse() {
  const chunks: string[] = [];
  return {
    chunks,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    write: vi.fn((chunk: string) => {
      chunks.push(chunk);
      return true;
    }),
    end: vi.fn(),
  };
}

describe("Zoya SSE remote fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeLLM.mockRejectedValue(new Error("local LLM unavailable"));
  });

  it("streams the remote Zoya reply and terminates with DONE", async () => {
    requestZoyaFallback.mockResolvedValue({
      reply: "Зоя снова работает",
      userType: "guest",
      limitReached: false,
    });
    const handler = createHandler();
    const res = createResponse();

    await handler(
      {
        headers: {},
        body: {
          messages: [{ role: "user", content: "Привет" }],
          fingerprint: "test-fingerprint",
        },
      },
      res,
    );

    const output = res.chunks.join("");
    expect(output).toContain('"type":"meta"');
    expect(output).toContain('"type":"chunk"');
    expect(output).toContain("Зоя сно");
    expect(output).toContain("data: [DONE]");
    expect(output).not.toContain('"type":"error"');
    expect(res.end).toHaveBeenCalledOnce();
  });

  it("returns a terminal error event when local and remote AI are unavailable", async () => {
    requestZoyaFallback.mockResolvedValue(null);
    const handler = createHandler();
    const res = createResponse();

    await handler(
      {
        headers: {},
        body: {
          messages: [{ role: "user", content: "Привет" }],
          fingerprint: "test-fingerprint",
        },
      },
      res,
    );

    const output = res.chunks.join("");
    expect(output).toContain('"type":"error"');
    expect(output).toContain("data: [DONE]");
    expect(res.end).toHaveBeenCalledOnce();
  });
});
