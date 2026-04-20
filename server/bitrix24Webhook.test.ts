import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV module before importing the webhook handler
vi.mock("./_core/env", () => ({
  ENV: {
    bitrix24OutboundWebhookToken: "t3iub0hik3xv6y3egu6ric7b70dq9u4f",
    bitrix24BaseUrl: "https://test.bitrix24.ru",
    bitrix24RestUserId: "1",
    bitrix24WebhookToken: "test-token",
  },
}));

// Mock db functions to avoid DB dependency
vi.mock("./db", () => ({
  isBitrixConfigured: () => true,
  getBitrixWebhookBaseUrl: () => "https://test.bitrix24.ru/rest/1/test-token",
  createIntegrationAudit: vi.fn().mockResolvedValue(undefined),
  recalculateAnimalStatus: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn(),
}));

vi.mock("./bitrix24", () => ({
  isBitrixConfigured: () => true,
  getBitrixWebhookBaseUrl: () => "https://test.bitrix24.ru/rest/1/test-token",
}));

// We test the verifyBitrixToken logic by importing the module and testing the route handler
// Since verifyBitrixToken is not exported, we test it through the Express route behavior

describe("Bitrix24 Webhook Token Verification", () => {
  it("should have BITRIX24_OUTBOUND_WEBHOOK_TOKEN configured in ENV", async () => {
    const { ENV } = await import("./_core/env");
    expect(ENV.bitrix24OutboundWebhookToken).toBeDefined();
    expect(ENV.bitrix24OutboundWebhookToken.length).toBeGreaterThan(0);
  });

  it("should reject requests with missing token", async () => {
    // Import the module to get the route handler
    const { registerBitrix24WebhookRoutes } = await import("./bitrix24Webhook");

    // Create a mock Express app to capture the route handler
    let capturedHandler: Function | null = null;
    const mockApp = {
      post: (path: string, handler: Function) => {
        if (path === "/api/bitrix24/webhook") {
          capturedHandler = handler;
        }
      },
      get: vi.fn(),
    };

    registerBitrix24WebhookRoutes(mockApp as any);
    expect(capturedHandler).not.toBeNull();

    // Test with no token in body
    const mockReq = {
      body: {
        event: "ONCRMDEALUPDATE",
        data: { FIELDS: { ID: "123" } },
        // no auth.application_token
      },
    };
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await capturedHandler!(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ ok: false, error: "invalid_token" });
  });

  it("should reject requests with wrong token", async () => {
    const { registerBitrix24WebhookRoutes } = await import("./bitrix24Webhook");

    let capturedHandler: Function | null = null;
    const mockApp = {
      post: (path: string, handler: Function) => {
        if (path === "/api/bitrix24/webhook") {
          capturedHandler = handler;
        }
      },
      get: vi.fn(),
    };

    registerBitrix24WebhookRoutes(mockApp as any);

    const mockReq = {
      body: {
        event: "ONCRMDEALUPDATE",
        data: { FIELDS: { ID: "123" } },
        auth: { application_token: "wrong-token-value" },
      },
    };
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await capturedHandler!(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ ok: false, error: "invalid_token" });
  });

  it("should accept requests with correct token", async () => {
    // Mock fetch for the Bitrix24 round-trip call
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: {
            ID: "123",
            CATEGORY_ID: "99", // wrong category so it skips processing
            STAGE_ID: "C99:NEW",
            TITLE: "Test deal",
          },
        }),
    });

    const { registerBitrix24WebhookRoutes } = await import("./bitrix24Webhook");

    let capturedHandler: Function | null = null;
    const mockApp = {
      post: (path: string, handler: Function) => {
        if (path === "/api/bitrix24/webhook") {
          capturedHandler = handler;
        }
      },
      get: vi.fn(),
    };

    registerBitrix24WebhookRoutes(mockApp as any);

    const mockReq = {
      body: {
        event: "ONCRMDEALUPDATE",
        data: { FIELDS: { ID: "123" } },
        auth: { application_token: "t3iub0hik3xv6y3egu6ric7b70dq9u4f" },
      },
    };
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await capturedHandler!(mockReq, mockRes);

    // Should NOT return 403 — token is valid
    const statusCalls = mockRes.status.mock.calls;
    const hasRejection = statusCalls.some((call: number[]) => call[0] === 403);
    expect(hasRejection).toBe(false);

    // Should return 200 with skipped (wrong category)
    expect(mockRes.status).toHaveBeenCalledWith(200);

    globalThis.fetch = originalFetch;
  });
});
