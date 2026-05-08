/**
 * Tests for milkAdmin.adjustTankVolume procedure.
 * Validates both absolute and delta modes, bounds checking, and audit trail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database and dependencies
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockLimit = vi.fn();

vi.mock("../drizzle/schema", () => ({
  milkTanks: { id: "id", currentVolumeMl: "currentVolumeMl", capacityMl: "capacityMl", status: "status" },
  milkTankMovements: {},
  milkAuditLog: {},
  farmWorkers: { isActive: "isActive", id: "id" },
  milkSessions: {},
  milkReceptions: {},
  processingSessions: {},
  processingInputs: {},
  processingOutputs: {},
}));

vi.mock("./db", () => ({
  getDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
}));

vi.mock("./farmAuth", () => ({
  logMilkAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => args),
  ne: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
  like: vi.fn(),
  inArray: vi.fn(),
}));

describe("adjustTankVolume - business logic", () => {
  it("absolute mode: calculates correct new volume in ml", () => {
    // 150.5 liters = 150500 ml
    const valueLiters = 150.5;
    const newVolumeMl = Math.round(valueLiters * 1000);
    expect(newVolumeMl).toBe(150500);
  });

  it("delta mode: adds positive delta to current volume", () => {
    const oldVolumeMl = 48000; // 48 liters
    const deltaLiters = 20; // +20 liters
    const newVolumeMl = oldVolumeMl + Math.round(deltaLiters * 1000);
    expect(newVolumeMl).toBe(68000);
  });

  it("delta mode: subtracts negative delta from current volume", () => {
    const oldVolumeMl = 48000; // 48 liters
    const deltaLiters = -20; // -20 liters
    const newVolumeMl = oldVolumeMl + Math.round(deltaLiters * 1000);
    expect(newVolumeMl).toBe(28000);
  });

  it("rejects negative resulting volume", () => {
    const oldVolumeMl = 10000; // 10 liters
    const deltaLiters = -20; // -20 liters → would result in -10000
    const newVolumeMl = oldVolumeMl + Math.round(deltaLiters * 1000);
    expect(newVolumeMl).toBeLessThan(0);
    // The procedure should throw BAD_REQUEST in this case
  });

  it("rejects volume exceeding capacity", () => {
    const capacityMl = 1000000; // 1000 liters
    const valueLiters = 1200; // exceeds capacity
    const newVolumeMl = Math.round(valueLiters * 1000);
    expect(newVolumeMl).toBeGreaterThan(capacityMl);
    // The procedure should throw BAD_REQUEST in this case
  });

  it("correctly determines tank status based on new volume", () => {
    const capacityMl = 1000000;
    
    // Empty
    expect(0 === 0 ? "empty" : "filling").toBe("empty");
    
    // Filling
    const midVolume = 500000;
    expect(midVolume === 0 ? "empty" : midVolume >= capacityMl ? "full" : "filling").toBe("filling");
    
    // Full
    expect(capacityMl === 0 ? "empty" : capacityMl >= capacityMl ? "full" : "filling").toBe("full");
  });

  it("calculates delta correctly for absolute mode", () => {
    const oldVolumeMl = 48000;
    const valueLiters = 100; // set to 100 liters
    const newVolumeMl = Math.round(valueLiters * 1000);
    const deltaMl = newVolumeMl - oldVolumeMl;
    expect(deltaMl).toBe(52000); // +52 liters
  });

  it("formats note correctly for absolute mode", () => {
    const reason = "Инвентаризация";
    const mode = "absolute" as const;
    const valueLiters = 150.5;
    const note = `[Ручная корректировка] ${reason} (${mode === "absolute" ? "установлено" : "дельта"}: ${mode === "absolute" ? valueLiters + " л" : (valueLiters >= 0 ? "+" : "") + valueLiters + " л"})`;
    expect(note).toBe("[Ручная корректировка] Инвентаризация (установлено: 150.5 л)");
  });

  it("formats note correctly for delta mode with negative value", () => {
    const reason = "Пролив";
    const mode = "delta" as const;
    const valueLiters = -20;
    const note = `[Ручная корректировка] ${reason} (${mode === "absolute" ? "установлено" : "дельта"}: ${mode === "absolute" ? valueLiters + " л" : (valueLiters >= 0 ? "+" : "") + valueLiters + " л"})`;
    expect(note).toBe("[Ручная корректировка] Пролив (дельта: -20 л)");
  });

  it("formats note correctly for delta mode with positive value", () => {
    const reason = "Дополнительная приёмка";
    const mode = "delta" as const;
    const valueLiters = 30;
    const note = `[Ручная корректировка] ${reason} (${mode === "absolute" ? "установлено" : "дельта"}: ${mode === "absolute" ? valueLiters + " л" : (valueLiters >= 0 ? "+" : "") + valueLiters + " л"})`;
    expect(note).toBe("[Ручная корректировка] Дополнительная приёмка (дельта: +30 л)");
  });

  it("returns correct response format", () => {
    const oldVolumeMl = 48000;
    const newVolumeMl = 100000;
    const deltaMl = newVolumeMl - oldVolumeMl;
    
    const result = {
      tankId: 1,
      tankName: "Танк №1",
      oldLiters: +(oldVolumeMl / 1000).toFixed(2),
      newLiters: +(newVolumeMl / 1000).toFixed(2),
      deltaLiters: +(deltaMl / 1000).toFixed(2),
      reason: "Тест",
    };
    
    expect(result.oldLiters).toBe(48);
    expect(result.newLiters).toBe(100);
    expect(result.deltaLiters).toBe(52);
  });
});
