import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const diagnoseLLMConnection = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    source: "cloudflare-openai",
    model: "gpt-4o-mini",
    endpointHost: "tg-proxy.example.workers.dev",
    endpointPath: "/openai/v1/chat/completions",
    status: 200,
    latencyMs: 120,
  }),
);

const diagnoseLLMPayload = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: false,
    source: "cloudflare-openai",
    model: "gpt-4o-mini",
    endpointHost: "tg-proxy.example.workers.dev",
    endpointPath: "/openai/v1/chat/completions",
    status: 502,
    latencyMs: 1200,
    error: {
      type: "workers_ai_error",
      code: "workers_ai_failed",
      message: "sanitized worker error",
    },
    request: {
      messageCount: 2,
      contentCharacters: 28000,
      maxTokens: 1024,
    },
  }),
);

vi.mock("./_core/llm", () => ({ diagnoseLLMConnection, diagnoseLLMPayload }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));

import { systemRouter } from "./_core/systemRouter";

function context(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-open-id`,
      name: role,
      email: `${role}@test.local`,
      role,
    } as any,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as any,
  };
}

describe("system.aiDiagnostics", () => {
  it("returns safe diagnostics to an administrator", async () => {
    const result = await systemRouter.createCaller(context("admin")).aiDiagnostics();
    expect(result).toMatchObject({
      ok: true,
      source: "cloudflare-openai",
      status: 200,
    });
    expect(diagnoseLLMConnection).toHaveBeenCalledOnce();
  });

  it("rejects a non-admin user", async () => {
    await expect(
      systemRouter.createCaller(context("user")).aiDiagnostics(),
    ).rejects.toThrow();
  });

  it("diagnoses Masha's real payload for an administrator without returning prompt text", async () => {
    const result = await systemRouter
      .createCaller(context("admin"))
      .mashaAiDiagnostics();

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      request: {
        messageCount: 2,
        contentCharacters: 28000,
        maxTokens: 1024,
      },
    });
    expect(JSON.stringify(result)).not.toContain("Диагностический запрос");
    expect(diagnoseLLMPayload).toHaveBeenCalledOnce();
  });

  it("rejects a non-admin user for Masha payload diagnostics", async () => {
    await expect(
      systemRouter.createCaller(context("user")).mashaAiDiagnostics(),
    ).rejects.toThrow();
  });
});
