import { describe, it, expect } from "vitest";
import { moderateComment } from "./commentModeration";

describe("moderateComment", () => {
  // ── Approved comments ──
  it("approves a normal comment", () => {
    const result = moderateComment("Отличный пост! Спасибо за новости с фермы.");
    expect(result.approved).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("approves a short valid comment", () => {
    const result = moderateComment("Спасибо!");
    expect(result.approved).toBe(true);
  });

  it("approves a comment with one URL but cleans it", () => {
    const result = moderateComment("Посмотрите https://example.com для деталей");
    expect(result.approved).toBe(true);
    expect(result.cleaned).toBe(true);
    expect(result.cleanedText).toContain("[ссылка удалена]");
    expect(result.cleanedText).not.toContain("https://");
  });

  // ── Blocked: profanity ──
  it("blocks comments with Russian profanity", () => {
    const result = moderateComment("Это полный пиздец какой-то");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("недопустимые выражения");
  });

  it("blocks comments with English profanity", () => {
    const result = moderateComment("What the fuck is this");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("недопустимые выражения");
  });

  // ── Blocked: spam ──
  it("blocks comments with multiple URLs", () => {
    const result = moderateComment("Купите тут https://spam1.com и тут https://spam2.com");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("ссылок");
  });

  it("blocks comments with repeated characters", () => {
    const result = moderateComment("Ааааааааааааааа это круто");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Повторяющиеся символы");
  });

  it("blocks comments that are mostly uppercase (>20 chars)", () => {
    const result = moderateComment("ЭТО ОЧЕНЬ ПЛОХОЙ ПОСТ И Я ТАК СЧИТАЮ ВСЕГДА");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("заглавных букв");
  });

  // ── Blocked: sanity ──
  it("blocks empty comments", () => {
    const result = moderateComment("   ");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("короткий");
  });

  it("blocks comments exceeding 2000 chars", () => {
    const longText = "А".repeat(2001);
    const result = moderateComment(longText);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("длинный");
  });

  // ── Edge cases ──
  it("approves a comment at exactly 2000 chars", () => {
    // Use a realistic long text that doesn't trigger spam filters
    const phrase = "Отличный пост о ферме. ";
    const text = phrase.repeat(Math.ceil(2000 / phrase.length)).slice(0, 2000);
    const result = moderateComment(text);
    expect(result.approved).toBe(true);
  });

  it("approves a comment with some caps but under threshold", () => {
    const result = moderateComment("Это ХОРОШАЯ новость для всех нас!");
    expect(result.approved).toBe(true);
  });
});
