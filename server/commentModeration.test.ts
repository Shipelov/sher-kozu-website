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

  // ── Farming context words — should be ALLOWED ──
  it("allows 'тварь' in animal context", () => {
    expect(moderateComment("Тварь какая милая").approved).toBe(true);
    expect(moderateComment("Божья тварь").approved).toBe(true);
  });

  it("allows 'сука/суки' in animal context", () => {
    expect(moderateComment("Сука родила щенков").approved).toBe(true);
    expect(moderateComment("Какие суки милые").approved).toBe(true);
    expect(moderateComment("Сучка родила щенков").approved).toBe(true);
  });

  // ── Directed insults with context words — should be BLOCKED ──
  it("blocks 'суки вы' as directed insult", () => {
    expect(moderateComment("Суки вы").approved).toBe(false);
  });

  it("blocks 'ты сука' as directed insult", () => {
    expect(moderateComment("Ты сука").approved).toBe(false);
  });

  it("blocks 'вот тварь' as directed insult", () => {
    expect(moderateComment("Вот тварь такая").approved).toBe(false);
    expect(moderateComment("Вот тварь").approved).toBe(false);
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
  it("blocks comments with 3+ URLs", () => {
    const result = moderateComment(
      "Купите тут https://spam1.com и тут https://spam2.com и тут https://spam3.com"
    );
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("ссылок");
  });

  it("allows comments with 2 URLs", () => {
    const result = moderateComment(
      "Сайт https://example.com и https://other.com"
    );
    expect(result.approved).toBe(true);
  });

  it("blocks comments with repeated characters (8+)", () => {
    const result = moderateComment("Привееееееееет это круто");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Повторяющиеся символы");
  });

  it("blocks comments that are mostly uppercase (>30 chars)", () => {
    const result = moderateComment("ЭТО ПОЛНЫЙ БРЕД И ЕРУНДА ПОЛНАЯ ЧУШЬ БРЕД БРЕД");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("заглавных букв");
  });

  it("allows short caps text", () => {
    expect(moderateComment("СУПЕР!").approved).toBe(true);
  });

  // ── Blocked: sanity ──
  it("blocks empty comments", () => {
    const result = moderateComment("   ");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("короткий");
  });

  it("blocks comments exceeding 2000 chars", () => {
    const phrase = "Это нормальное предложение для теста. ";
    const longText = phrase.repeat(100);
    const result = moderateComment(longText);
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("длинный");
  });

  // ── Edge cases ──
  it("approves a comment at exactly 2000 chars", () => {
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
