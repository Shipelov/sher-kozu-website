import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ENV module
vi.mock("./_core/env", () => ({
  ENV: {
    telegramBotToken: "test-token-123",
    builtInForgeApiUrl: "https://test.api.com",
    builtInForgeApiKey: "test-key",
  },
}));

// Mock grammy Bot
vi.mock("grammy", () => {
  const mockBot = {
    api: {
      setWebhook: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      getMe: vi.fn().mockResolvedValue({ id: 123, is_bot: true, first_name: "SherKozu", username: "sherkozu_bot" }),
    },
    on: vi.fn(),
    command: vi.fn(),
    hears: vi.fn(),
    use: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    handleUpdate: vi.fn().mockResolvedValue(undefined),
  };
  return {
    Bot: vi.fn(() => mockBot),
    webhookCallback: vi.fn(() => vi.fn()),
  };
});

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  onDuplicateKeyUpdate: vi.fn().mockReturnThis(),
  set: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../drizzle/schema", () => ({
  users: { openId: "openId", telegramChatId: "telegramChatId" },
  telegramLinkTokens: { token: "token", userOpenId: "userOpenId", expiresAt: "expiresAt" },
  telegramSessions: { chatId: "chatId", state: "state", context: "context", updatedAt: "updatedAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  gt: vi.fn((...args: unknown[]) => ({ type: "gt", args })),
  isNotNull: vi.fn((arg: unknown) => ({ type: "isNotNull", arg })),
}));

describe("Telegram Bot Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBot", () => {
    it("should return a bot instance", async () => {
      const { getBot } = await import("./telegramBot");
      const bot = getBot();
      expect(bot).toBeDefined();
      expect(bot.api).toBeDefined();
    });

    it("should return the same bot instance on multiple calls", async () => {
      const { getBot } = await import("./telegramBot");
      const bot1 = getBot();
      const bot2 = getBot();
      expect(bot1).toBe(bot2);
    });
  });

  describe("getTelegramWebhookHandler", () => {
    it("should return a function", async () => {
      const { getTelegramWebhookHandler } = await import("./telegramBot");
      const handler = getTelegramWebhookHandler();
      expect(typeof handler).toBe("function");
    });
  });

  describe("generateLinkToken", () => {
    it("should generate a token string", async () => {
      const { generateLinkToken } = await import("./telegramBot");
      const token = await generateLinkToken("test-user-open-id");
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(10);
    });

    it("should generate unique tokens for different calls", async () => {
      const { generateLinkToken } = await import("./telegramBot");
      const token1 = await generateLinkToken("user-1");
      const token2 = await generateLinkToken("user-2");
      expect(token1).not.toBe(token2);
    });
  });

  describe("sendTelegramNotification", () => {
    it("should not throw when user has no Telegram linked", async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const { sendTelegramNotification } = await import("./telegramBot");
      // Should not throw, just silently skip
      await expect(sendTelegramNotification("no-tg-user", "Test message")).resolves.not.toThrow();
    });

    it("should attempt to send message when user has Telegram linked", async () => {
      mockDb.limit.mockResolvedValueOnce([{ telegramChatId: "12345" }]);
      const { sendTelegramNotification, getBot } = await import("./telegramBot");
      const bot = getBot();
      await sendTelegramNotification("linked-user", "Test delivery notification");
      expect(bot.api.sendMessage).toHaveBeenCalledWith("12345", "Test delivery notification", expect.any(Object));
    });
  });

  describe("getUserByTelegramChatId", () => {
    it("should return null when no user found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const { getUserByTelegramChatId } = await import("./telegramBot");
      const user = await getUserByTelegramChatId("99999");
      expect(user).toBeNull();
    });

    it("should return user when found", async () => {
      mockDb.limit.mockResolvedValueOnce([{ openId: "test-open-id", telegramChatId: "12345" }]);
      const { getUserByTelegramChatId } = await import("./telegramBot");
      const user = await getUserByTelegramChatId("12345");
      expect(user).toEqual({ openId: "test-open-id", telegramChatId: "12345" });
    });
  });

  describe("splitMessage helper", () => {
    it("should be used internally for long messages", async () => {
      // Test via sendTelegramNotification with a very long message
      mockDb.limit.mockResolvedValueOnce([{ telegramChatId: "12345" }]);
      const { sendTelegramNotification, getBot } = await import("./telegramBot");
      const bot = getBot();
      const longMessage = "A".repeat(5000);
      await sendTelegramNotification("linked-user", longMessage);
      // Should have been called (possibly multiple times for split messages)
      expect(bot.api.sendMessage).toHaveBeenCalled();
    });
  });
});

describe("Telegram Bot - Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle database errors gracefully in sendTelegramNotification", async () => {
    mockDb.limit.mockRejectedValueOnce(new Error("DB connection failed"));
    const { sendTelegramNotification } = await import("./telegramBot");
    // Should not throw, just log warning
    await expect(sendTelegramNotification("user", "test")).resolves.not.toThrow();
  });

  it("should handle bot API errors gracefully in sendTelegramNotification", async () => {
    mockDb.limit.mockResolvedValueOnce([{ telegramChatId: "12345" }]);
    const { sendTelegramNotification, getBot } = await import("./telegramBot");
    const bot = getBot();
    (bot.api.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Telegram API error"));
    // Should not throw
    await expect(sendTelegramNotification("user", "test")).resolves.not.toThrow();
  });
});
