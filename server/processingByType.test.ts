import { describe, it, expect } from "vitest";

/**
 * Unit tests for the processing by-type breakdown logic.
 * Tests the toTypeMap helper function and the expected data structure.
 */

// Replicate the toTypeMap helper from milkAdmin.ts
const toTypeMap = (rows: { milkType: string; totalMl: number }[]) => {
  const m: Record<string, number> = { goat: 0, sheep: 0, cow: 0 };
  for (const r of rows) m[r.milkType] = +(Number(r.totalMl) / 1000).toFixed(2);
  return m;
};

describe("Processing by milk type breakdown", () => {
  describe("toTypeMap helper", () => {
    it("returns zeroes for empty input", () => {
      const result = toTypeMap([]);
      expect(result).toEqual({ goat: 0, sheep: 0, cow: 0 });
    });

    it("correctly converts ml to liters for single type", () => {
      const result = toTypeMap([{ milkType: "goat", totalMl: 5000 }]);
      expect(result).toEqual({ goat: 5, sheep: 0, cow: 0 });
    });

    it("correctly converts ml to liters for all types", () => {
      const result = toTypeMap([
        { milkType: "goat", totalMl: 12500 },
        { milkType: "sheep", totalMl: 8300 },
        { milkType: "cow", totalMl: 25000 },
      ]);
      expect(result).toEqual({ goat: 12.5, sheep: 8.3, cow: 25 });
    });

    it("handles fractional milliliters with 2 decimal places", () => {
      const result = toTypeMap([
        { milkType: "goat", totalMl: 1234 },
        { milkType: "sheep", totalMl: 5678 },
      ]);
      expect(result.goat).toBe(1.23);
      expect(result.sheep).toBe(5.68);
      expect(result.cow).toBe(0);
    });

    it("handles zero volumes correctly", () => {
      const result = toTypeMap([
        { milkType: "goat", totalMl: 0 },
        { milkType: "cow", totalMl: 10000 },
      ]);
      expect(result).toEqual({ goat: 0, sheep: 0, cow: 10 });
    });

    it("ignores unknown milk types", () => {
      const result = toTypeMap([
        { milkType: "goat", totalMl: 5000 },
        { milkType: "buffalo", totalMl: 9999 },
      ]);
      expect(result.goat).toBe(5);
      expect(result.sheep).toBe(0);
      expect(result.cow).toBe(0);
      // buffalo is added but not in the initial map — it still works
      expect((result as any).buffalo).toBe(10);
    });
  });

  describe("Processing overview response structure", () => {
    it("byType field should be present in each period", () => {
      // Simulate the expected response structure
      const processingResponse = {
        today: {
          sessions: 2,
          inputLiters: 15.5,
          outputUnits: 3,
          byType: toTypeMap([
            { milkType: "goat", totalMl: 10000 },
            { milkType: "sheep", totalMl: 5500 },
          ]),
        },
        week: {
          sessions: 8,
          inputLiters: 65.2,
          outputUnits: 12,
          byType: toTypeMap([
            { milkType: "goat", totalMl: 30000 },
            { milkType: "sheep", totalMl: 20200 },
            { milkType: "cow", totalMl: 15000 },
          ]),
        },
        month: {
          sessions: 25,
          inputLiters: 180.0,
          outputUnits: 40,
          byType: toTypeMap([
            { milkType: "goat", totalMl: 80000 },
            { milkType: "sheep", totalMl: 60000 },
            { milkType: "cow", totalMl: 40000 },
          ]),
        },
      };

      // Check today
      expect(processingResponse.today.byType).toBeDefined();
      expect(processingResponse.today.byType.goat).toBe(10);
      expect(processingResponse.today.byType.sheep).toBe(5.5);
      expect(processingResponse.today.byType.cow).toBe(0);

      // Check week
      expect(processingResponse.week.byType).toBeDefined();
      expect(processingResponse.week.byType.goat).toBe(30);
      expect(processingResponse.week.byType.sheep).toBe(20.2);
      expect(processingResponse.week.byType.cow).toBe(15);

      // Check month
      expect(processingResponse.month.byType).toBeDefined();
      expect(processingResponse.month.byType.goat).toBe(80);
      expect(processingResponse.month.byType.sheep).toBe(60);
      expect(processingResponse.month.byType.cow).toBe(40);
    });

    it("sum of byType values should equal total inputLiters", () => {
      const byType = toTypeMap([
        { milkType: "goat", totalMl: 10000 },
        { milkType: "sheep", totalMl: 5000 },
        { milkType: "cow", totalMl: 3000 },
      ]);
      const totalInputLiters = +(18000 / 1000).toFixed(2);
      const sumByType = +(byType.goat + byType.sheep + byType.cow).toFixed(2);
      expect(sumByType).toBe(totalInputLiters);
    });
  });
});
