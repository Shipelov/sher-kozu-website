/**
 * Tests for Zoya AI Nutritionist — Personalized Animal Data Integration
 *
 * Verifies (source-level):
 * 1. Owner context enrichment from nutritionistDb (real milk data, fallbacks)
 * 2. Zoya SSE passes the assembled owner context to the structured orchestrator
 *
 * Проверки текста prompts/zoyaSystemPrompt.ts удалены вместе с файлом:
 * runtime его не использовал, живые промпты — в zoyaOrchestrator.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

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

describe("Zoya SSE — assembled owner context passed to structured orchestrator", () => {
  const ssePath = path.resolve(__dirname, "zoyaSSE.ts");
  const sseSource = readFileSync(ssePath, "utf-8");

  it("should assemble profile, owner products and RAG through the shared context layer", () => {
    expect(sseSource).toContain("assembleZoyaContext({");
    expect(sseSource).toContain("userType,");
  });

  it("should gate incomplete or unconfirmed personal profiles before AI", () => {
    expect(sseSource).toContain("buildZoyaProfileGateReply(assembledContext)");
    expect(sseSource).toContain("profileContext");
  });

  it("should pass the verified assembled context to the structured orchestrator", () => {
    expect(sseSource).toContain("runZoyaOrchestrator(assembledContext, messages");
    expect(sseSource).toContain("buildZoyaSessionState(assembledContext)");
  });
});
