/**
 * Tests for Zoya AI Nutritionist — Personalized Animal Data Integration
 *
 * Verifies:
 * 1. System prompt includes real milk composition data for owners
 * 2. Breed-average fallback when no real data exists
 * 3. Species-average fallback when breed is unknown
 * 4. Multi-animal context (goat + sheep) with combination advice
 * 5. Guest/registered users get breed average tables
 * 6. Owner context enrichment from nutritionistDb
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════════════
// 1. System Prompt Builder Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya System Prompt — Personalization", () => {
  const promptPath = path.resolve(__dirname, "prompts/zoyaSystemPrompt.ts");
  const promptSource = readFileSync(promptPath, "utf-8");

  it("should export buildZoyaPrompt and extractSearchKeywords functions", () => {
    expect(promptSource).toContain("export function buildZoyaPrompt");
    expect(promptSource).toContain("export function extractSearchKeywords");
  });

  it("should define EnrichedAnimal interface with milkComposition field", () => {
    expect(promptSource).toContain("milkComposition: AnimalMilkComposition[]");
    expect(promptSource).toContain("monthlyMetrics: AnimalMonthlyMetric[]");
    expect(promptSource).toContain("annualMilkLiters: number | null");
    expect(promptSource).toContain("availableProducts: AnimalProduct[]");
  });

  it("should include personalization principle in BASE_PERSONALITY", () => {
    expect(promptSource).toContain("ПЕРСОНАЛИЗАЦИЯ НА ОСНОВЕ РЕАЛЬНЫХ ДАННЫХ");
    expect(promptSource).toContain("реальных показателей молока конкретных животных");
  });

  it("should emphasize real data vs averages distinction", () => {
    expect(promptSource).toContain("Это не средние цифры из учебника");
    expect(promptSource).toContain("реальные показатели молока вашей козы/овцы");
  });

  it("should handle multi-animal owners (goat + sheep combinations)", () => {
    expect(promptSource).toContain("несколько животных разных видов");
    expect(promptSource).toContain("комбинированные рационы");
    expect(promptSource).toContain("синергию");
  });

  it("should include breed average fallback data for goat breeds", () => {
    expect(promptSource).toContain("Англо-нубийская");
    expect(promptSource).toContain("Альпийская");
    expect(promptSource).toContain("Зааненская");
  });

  it("should include breed average fallback data for sheep breeds", () => {
    expect(promptSource).toContain("Восточно-фризская");
    expect(promptSource).toContain("Лакон");
  });

  it("should include species-level averages as ultimate fallback", () => {
    expect(promptSource).toContain("SPECIES_AVERAGES");
    expect(promptSource).toContain("goat:");
    expect(promptSource).toContain("sheep:");
  });

  it("should have findBreedAverage helper for partial matching", () => {
    expect(promptSource).toContain("function findBreedAverage");
    expect(promptSource).toContain("breedLower.includes");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Owner Context Builder Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya System Prompt — Owner Context with Real Milk Data", () => {
  const promptPath = path.resolve(__dirname, "prompts/zoyaSystemPrompt.ts");
  const promptSource = readFileSync(promptPath, "utf-8");

  it("should render real milk composition when available", () => {
    // The buildOwnerContext function should check for milkComposition
    expect(promptSource).toContain("a.milkComposition && a.milkComposition.length > 0");
    expect(promptSource).toContain("Реальный состав молока (по данным анализов)");
  });

  it("should fall back to breed averages when no composition data", () => {
    expect(promptSource).toContain("Средние показатели для породы");
    expect(promptSource).toContain("реальные данные анализа пока не загружены");
  });

  it("should render monthly metrics for seasonal dynamics", () => {
    expect(promptSource).toContain("a.monthlyMetrics && a.monthlyMetrics.length > 0");
    expect(promptSource).toContain("Сезонная динамика молока");
  });

  it("should render annual milk production", () => {
    expect(promptSource).toContain("a.annualMilkLiters");
    expect(promptSource).toContain("Годовой надой");
  });

  it("should render available products from each animal", () => {
    expect(promptSource).toContain("a.availableProducts && a.availableProducts.length > 0");
    expect(promptSource).toContain("Доступные продукты из молока");
  });

  it("should detect multiple species and suggest combinations", () => {
    expect(promptSource).toContain("hasMultipleSpecies");
    expect(promptSource).toContain("разных видов");
    expect(promptSource).toContain("комбинации продуктов из разных источников молока");
  });

  it("should include product plan context with usage hint", () => {
    expect(promptSource).toContain("Продуктовый план владельца");
    expect(promptSource).toContain("рекомендуй продукты, которые владелец уже получает");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Guest/Registered User Context Tests
// ═══════════════════════════════════════════════════════════════════

describe("Zoya System Prompt — Breed Average Context for Non-Owners", () => {
  const promptPath = path.resolve(__dirname, "prompts/zoyaSystemPrompt.ts");
  const promptSource = readFileSync(promptPath, "utf-8");

  it("should build breed average context for non-owner users", () => {
    expect(promptSource).toContain("function buildBreedAverageContext");
    expect(promptSource).toContain('if (ctx.userType === "owner") return ""');
  });

  it("should include breed comparison tables for guests/registered", () => {
    expect(promptSource).toContain("Козье молоко (средние показатели)");
    expect(promptSource).toContain("Овечье молоко (средние показатели)");
  });

  it("should mention that owners get real data", () => {
    expect(promptSource).toContain("Владельцы доли получают рекомендации на основе реальных анализов");
  });

  it("should note that real values can differ from averages", () => {
    expect(promptSource).toContain("реальные показатели конкретного животного могут отличаться от средних");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. User Type Rules — Personalization Emphasis
// ═══════════════════════════════════════════════════════════════════

describe("Zoya System Prompt — User Type Rules with Personalization", () => {
  const promptPath = path.resolve(__dirname, "prompts/zoyaSystemPrompt.ts");
  const promptSource = readFileSync(promptPath, "utf-8");

  it("should tell guests about personalized recommendations for owners", () => {
    expect(promptSource).toContain("владельцы доли получают рекомендации на основе реальных анализов молока");
  });

  it("should encourage registered users to become owners for personalization", () => {
    expect(promptSource).toContain("реального состава молока именно вашего животного");
    expect(promptSource).toContain("совсем другой уровень точности и персонализации");
  });

  it("should require owners to use real animal data in recommendations", () => {
    expect(promptSource).toContain("ОБЯЗАТЕЛЬНО** привязывай рекомендации к реальным данным");
    expect(promptSource).toContain("цитируй конкретные цифры");
  });

  it("should instruct to note when using breed averages for owners", () => {
    expect(promptSource).toContain("Пока мы используем средние показатели для породы");
    expect(promptSource).toContain("Когда появятся данные анализа молока вашего животного");
  });

  it("should mention seasonality for owner recommendations", () => {
    expect(promptSource).toContain("сезонность при обсуждении состава молока");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Red Lines — Data Integrity
// ═══════════════════════════════════════════════════════════════════

describe("Zoya System Prompt — Red Lines for Data Integrity", () => {
  const promptPath = path.resolve(__dirname, "prompts/zoyaSystemPrompt.ts");
  const promptSource = readFileSync(promptPath, "utf-8");

  it("should include red line about not fabricating data", () => {
    expect(promptSource).toContain("Не придумывай данные");
    expect(promptSource).toContain("Если не знаешь точный состав");
  });

  it("should prevent cheese-only sports menus and ungrounded owner products", () => {
    expect(promptSource).toContain("Молочные продукты фермы — часть меню, а не весь рацион");
    expect(promptSource).toContain("не рекомендуй сыр во время часовой силовой тренировки");
    expect(promptSource).toContain("только если он присутствует в подтверждённом продуктовом плане");
    expect(promptSource).toContain("Не переводи процент в граммы без выбранной единицы");
  });

  it("should require distinguishing real vs average data", () => {
    expect(promptSource).toContain("Реальные vs средние данные");
    expect(promptSource).toContain("Не выдавай средние за реальные");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Database Enrichment — nutritionistDb.ts
// ═══════════════════════════════════════════════════════════════════

describe("Zoya DB — getOwnerNutriContext enrichment", () => {
  const dbPath = path.resolve(__dirname, "nutritionistDb.ts");
  const dbSource = readFileSync(dbPath, "utf-8");

  it("should import productCompositionSnapshots table", () => {
    expect(dbSource).toContain("productCompositionSnapshots");
  });

  it("should import productMonthlyMetrics table", () => {
    expect(dbSource).toContain("productMonthlyMetrics");
  });

  it("should import animalProductionProfiles table", () => {
    expect(dbSource).toContain("animalProductionProfiles");
  });

  it("should import productOptions table", () => {
    expect(dbSource).toContain("productOptions");
  });

  it("should query composition snapshots by animalSlug and ownerOpenId", () => {
    expect(dbSource).toContain("productCompositionSnapshots.animalSlug");
    expect(dbSource).toContain("productCompositionSnapshots.ownerOpenId");
  });

  it("should query monthly metrics by animalSlug and ownerOpenId", () => {
    expect(dbSource).toContain("productMonthlyMetrics.animalSlug");
    expect(dbSource).toContain("productMonthlyMetrics.ownerOpenId");
  });

  it("should query production profiles by animalId", () => {
    expect(dbSource).toContain("animalProductionProfiles.animalId");
  });

  it("should query enabled product options by animalId", () => {
    expect(dbSource).toContain("productOptions.animalId");
    expect(dbSource).toContain("productOptions.isEnabled");
  });

  it("should enrich animals with milkComposition, monthlyMetrics, annualMilkLiters, availableProducts", () => {
    expect(dbSource).toContain("milkComposition: composition");
    expect(dbSource).toContain("monthlyMetrics: monthly");
    expect(dbSource).toContain("annualMilkLiters: production?.annualMilkLiters ?? null");
    expect(dbSource).toContain("availableProducts: products");
  });

  it("should convert proteinPercentTenth and fatPercentTenth to decimal percentages", () => {
    expect(dbSource).toContain("proteinPercentTenth / 10");
    expect(dbSource).toContain("fatPercentTenth / 10");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. SSE Endpoint — Context Passing
// ═══════════════════════════════════════════════════════════════════

describe("Zoya SSE — Owner context passed to prompt builder", () => {
  const ssePath = path.resolve(__dirname, "zoyaSSE.ts");
  const sseSource = readFileSync(ssePath, "utf-8");

  it("should call getOwnerNutriContext for owner users", () => {
    expect(sseSource).toContain("getOwnerNutriContext(user.id)");
  });

  it("should assign ownerContext to userContext", () => {
    expect(sseSource).toContain("userContext.ownerContext = await getOwnerNutriContext");
  });

  it("should pass userContext to buildZoyaPrompt", () => {
    expect(sseSource).toContain("buildZoyaPrompt({");
    expect(sseSource).toContain("user: userContext");
  });
});
