import { describe, expect, it } from "vitest";
import { isOwnLink, renderAssistantLinks } from "../client/src/lib/assistantMarkdown";

const origin = "https://koza.vip";

describe("renderAssistantLinks: ссылки в ответах ассистентов", () => {
  it("оставляет относительные ссылки на свой домен ссылками", () => {
    const text = "Смотрите [каталог](/animals) и [Зою](/nutritionist).";
    expect(renderAssistantLinks(text, origin)).toBe(text);
  });

  it("абсолютную ссылку своего домена превращает в относительную", () => {
    expect(renderAssistantLinks("[Руфа](https://koza.vip/animal/rufa?x=1#y)", origin)).toBe("[Руфа](/animal/rufa?x=1#y)");
  });

  it("внешние ссылки показывает текстом с URL", () => {
    expect(renderAssistantLinks("Источник: [USDA](https://fdc.nal.usda.gov/).", origin)).toBe(
      "Источник: USDA (https://fdc.nal.usda.gov/).",
    );
    expect(renderAssistantLinks("[https://example.org](https://example.org)", origin)).toBe("https://example.org");
  });

  it("небезопасные схемы убирает, оставляя текст", () => {
    expect(renderAssistantLinks("[клик](data:text/html;base64,QUFB)", origin)).toBe("клик");
  });

  it("не трогает текст без ссылок и код", () => {
    const text = "Просто текст с [квадратными] скобками и (скобками).";
    expect(renderAssistantLinks(text, origin)).toBe(text);
  });
});

describe("isOwnLink", () => {
  it("распознаёт свои и чужие адреса", () => {
    expect(isOwnLink("/animals", origin)).toBe(true);
    expect(isOwnLink("#faq", origin)).toBe(true);
    expect(isOwnLink("mailto:hello@example.invalid", origin)).toBe(true);
    expect(isOwnLink("https://koza.vip/pricing", origin)).toBe(true);
    expect(isOwnLink("//evil.invalid/x", origin)).toBe(false);
    expect(isOwnLink("https://evil.invalid/koza.vip", origin)).toBe(false);
  });
});
