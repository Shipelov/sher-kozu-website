import { describe, expect, it } from "vitest";
import { buildMashaSystemPrompt } from "./routers/faqChat";

describe("Masha topic-aware system prompt", () => {
  it("keeps a generic request compact while preserving core product and answer rules", () => {
    const prompt = buildMashaSystemPrompt("Как работает ваша ферма?");

    expect(prompt).toContain("AI-управляющая семейной фермой");
    expect(prompt).toContain("## О ферме");
    expect(prompt).toContain("═══ ПРОДУКТЫ ═══");
    expect(prompt).toContain("═══ ПРАВИЛА ОТВЕТОВ ═══");
    expect(prompt).not.toContain("### Зааненская коза (Мира)");
    expect(prompt.length).toBeLessThan(8_000);
  });

  it("selects one specific breed profile instead of every goat and sheep profile", () => {
    const prompt = buildMashaSystemPrompt("Расскажи о козе Мире и зааненской породе");

    expect(prompt).toContain("### Зааненская коза (Мира)");
    expect(prompt).not.toContain("### Англо-нубийская коза (Лола)");
    expect(prompt).not.toContain("### Лакон (Руфа)");
  });

  it("selects nutrition knowledge for milk questions without all breed encyclopedias", () => {
    const prompt = buildMashaSystemPrompt("Чем козье молоко отличается по составу?");

    expect(prompt).toContain("═══ НУТРИЦИОЛОГИЯ МОЛОКА ═══");
    expect(prompt).not.toContain("### Зааненская коза (Мира)");
    expect(prompt).not.toContain("### Лакон (Руфа)");
  });

  it("selects market knowledge only for market-related questions", () => {
    const marketPrompt = buildMashaSystemPrompt("Каков спрос и рынок козьего молока?");
    const genericPrompt = buildMashaSystemPrompt("Как работает ваша ферма?");

    expect(marketPrompt).toContain("═══ РЫНОЧНЫЙ КОНТЕКСТ ═══");
    expect(genericPrompt).not.toContain("═══ РЫНОЧНЫЙ КОНТЕКСТ ═══");
  });

  it("keeps representative topic prompts below the large-payload failure range", () => {
    const prompts = [
      "Расскажи о породах коз",
      "Расскажи о породах овец",
      "Чем козье молоко отличается по составу и усвояемости?",
      "Каков рынок и спрос на овечье молоко?",
      "Расскажи подробно про альпийскую козу",
    ].map(buildMashaSystemPrompt);

    expect(Math.max(...prompts.map((prompt) => prompt.length))).toBeLessThan(18_000);
  });
});
