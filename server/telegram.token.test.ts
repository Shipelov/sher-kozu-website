import { describe, it, expect } from "vitest";

describe("Telegram Bot Token", () => {
  it("should have TELEGRAM_BOT_TOKEN set in environment", () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
    // Telegram tokens have format: <bot_id>:<hash>
    expect(token).toMatch(/^\d+:[A-Za-z0-9_-]+$/);
  });

  it("should validate token against Telegram API (getMe)", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    expect(token).toBeDefined();

    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();

    expect(data.ok).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.is_bot).toBe(true);
    expect(data.result.username).toBeDefined();
    console.log(`Bot validated: @${data.result.username}`);
  });
});
