import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "./_core/llm";

const invokeLLMMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({
  invokeLLM: invokeLLMMock,
}));

import {
  compactZoyaMessages,
  invokeZoyaLLM,
  ZOYA_MAX_HISTORY_MESSAGES,
} from "./zoyaChatRuntime";

function conversation(messageCount = 20): Message[] {
  return [
    { role: "system", content: "Системный prompt Зои" },
    ...Array.from({ length: messageCount }, (_, index) => ({
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      content: `Сообщение ${index} ${"x".repeat(120)}`,
    })),
  ];
}

describe("compactZoyaMessages", () => {
  it("always keeps the system prompt and only the newest bounded history", () => {
    const compacted = compactZoyaMessages(conversation(30));

    expect(compacted[0]).toEqual({ role: "system", content: "Системный prompt Зои" });
    expect(compacted).toHaveLength(ZOYA_MAX_HISTORY_MESSAGES + 1);
    expect(compacted.at(-1)?.content).toContain("Сообщение 29");
    expect(compacted.some((message) => String(message.content).includes("Сообщение 0 "))).toBe(false);
  });

  it("keeps the current user message even when it exceeds the history char budget", () => {
    const oversized: Message[] = [
      { role: "system", content: "system" },
      { role: "assistant", content: "old" },
      { role: "user", content: "x".repeat(8_000) },
    ];

    const compacted = compactZoyaMessages(oversized, { maxHistoryChars: 1_000 });

    expect(compacted).toHaveLength(2);
    expect(compacted.at(-1)?.content).toHaveLength(8_000);
  });
});

describe("invokeZoyaLLM", () => {
  beforeEach(() => {
    invokeLLMMock.mockReset();
  });

  it("uses one compacted request on success", async () => {
    invokeLLMMock.mockResolvedValue({ choices: [{ message: { content: "ok" } }] });

    const result = await invokeZoyaLLM(conversation(30));

    expect(result.choices[0].message.content).toBe("ok");
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
    expect(invokeLLMMock.mock.calls[0][0].messages).toHaveLength(13);
  });

  it("retries once with a smaller history after a transient upstream error", async () => {
    invokeLLMMock
      .mockRejectedValueOnce(new Error("LLM invoke failed (503): upstream unavailable"))
      .mockResolvedValueOnce({ choices: [{ message: { content: "recovered" } }] });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await invokeZoyaLLM(conversation(30));

    expect(result.choices[0].message.content).toBe("recovered");
    expect(invokeLLMMock).toHaveBeenCalledTimes(2);
    expect(invokeLLMMock.mock.calls[0][0].messages).toHaveLength(13);
    expect(invokeLLMMock.mock.calls[1][0].messages).toHaveLength(7);
    expect(errorSpy).toHaveBeenCalledWith(
      "[Zoya LLM] Primary attempt failed",
      expect.objectContaining({ attempt: 1, upstreamStatus: "503" }),
    );
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("upstream unavailable");
    errorSpy.mockRestore();
  });

  it("propagates the second failure to the existing route-level fallback", async () => {
    invokeLLMMock.mockRejectedValue(new Error("LLM invoke failed (503)"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(invokeZoyaLLM(conversation(4))).rejects.toThrow("503");
    expect(invokeLLMMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it("does not retry permanent authorization errors", async () => {
    invokeLLMMock.mockRejectedValue(new Error("LLM invoke failed (401)"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(invokeZoyaLLM(conversation(4))).rejects.toThrow("401");
    expect(invokeLLMMock).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe("Zoya sports-menu runtime wiring", () => {
  const trpcSource = readFileSync(path.resolve(__dirname, "routers/nutritionist.ts"), "utf8");
  const sseSource = readFileSync(path.resolve(__dirname, "zoyaSSE.ts"), "utf8");
  const clientSource = readFileSync(
    path.resolve(__dirname, "../client/src/components/ZoyaChat.tsx"),
    "utf8",
  );

  it("uses the same deterministic advisor in tRPC and SSE before LLM fallback", () => {
    expect(trpcSource).toContain("buildGroundedSportsMenuReply(input.messages, userContext)");
    expect(sseSource).toContain("buildGroundedSportsMenuReply(messages, userContext)");
  });

  it("uses the same resilient LLM runtime in tRPC and SSE", () => {
    expect(trpcSource).toContain("invokeZoyaLLM(llmMessages)");
    expect(sseSource).toContain("invokeZoyaLLM(llmMessages)");
  });

  it("bounds client-side history before sending the SSE request", () => {
    expect(clientSource).toContain("const REQUEST_HISTORY_LIMIT = 12");
    expect(clientSource).toContain(".slice(-REQUEST_HISTORY_LIMIT)");
  });
});
