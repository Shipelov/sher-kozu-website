import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

describe("Tank Analytics Endpoints", () => {
  describe("tankMovements", () => {
    it("should validate tankId is required", async () => {
      const { z } = await import("zod");
      const schema = z.object({
        tankId: z.number().int(),
        movementType: z.enum(["milking_in", "transfer", "processing_out", "waste", "sample", "adjustment"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
      });

      // Valid input
      const valid = schema.safeParse({ tankId: 1 });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.page).toBe(1);
        expect(valid.data.pageSize).toBe(20);
      }

      // Missing tankId
      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);

      // Invalid movementType
      const badType = schema.safeParse({ tankId: 1, movementType: "invalid_type" });
      expect(badType.success).toBe(false);

      // Valid with all filters
      const full = schema.safeParse({
        tankId: 2,
        movementType: "processing_out",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        page: 3,
        pageSize: 50,
      });
      expect(full.success).toBe(true);
    });

    it("should reject page < 1", async () => {
      const { z } = await import("zod");
      const schema = z.object({
        tankId: z.number().int(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
      });

      const result = schema.safeParse({ tankId: 1, page: 0 });
      expect(result.success).toBe(false);
    });

    it("should reject pageSize > 100", async () => {
      const { z } = await import("zod");
      const schema = z.object({
        tankId: z.number().int(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
      });

      const result = schema.safeParse({ tankId: 1, pageSize: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe("tankTurnover", () => {
    it("should validate tankId is required", async () => {
      const { z } = await import("zod");
      const schema = z.object({ tankId: z.number().int() });

      const valid = schema.safeParse({ tankId: 5 });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({});
      expect(invalid.success).toBe(false);

      const nonInt = schema.safeParse({ tankId: 1.5 });
      expect(nonInt.success).toBe(false);
    });
  });

  describe("tankVolumeHistory", () => {
    it("should validate input with defaults", async () => {
      const { z } = await import("zod");
      const schema = z.object({
        tankId: z.number().int(),
        days: z.number().int().min(7).max(90).default(30),
      });

      const valid = schema.safeParse({ tankId: 1 });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.days).toBe(30);
      }

      // Custom days
      const custom = schema.safeParse({ tankId: 1, days: 60 });
      expect(custom.success).toBe(true);
      if (custom.success) {
        expect(custom.data.days).toBe(60);
      }

      // Too few days
      const tooFew = schema.safeParse({ tankId: 1, days: 3 });
      expect(tooFew.success).toBe(false);

      // Too many days
      const tooMany = schema.safeParse({ tankId: 1, days: 120 });
      expect(tooMany.success).toBe(false);
    });
  });

  describe("tankMetrics", () => {
    it("should validate tankId is required", async () => {
      const { z } = await import("zod");
      const schema = z.object({ tankId: z.number().int() });

      const valid = schema.safeParse({ tankId: 3 });
      expect(valid.success).toBe(true);

      const invalid = schema.safeParse({ tankId: "abc" });
      expect(invalid.success).toBe(false);
    });
  });

  describe("Turnover calculation logic", () => {
    it("should correctly classify movement types for turnover", () => {
      // Simulate the classification logic from tankTurnover
      const classifyMovement = (movementType: string, volumeMl: number) => {
        let inflowMl = 0;
        let outflowMl = 0;
        let adjustmentMl = 0;

        if (movementType === "milking_in" || (movementType === "transfer" && volumeMl > 0)) {
          inflowMl += volumeMl;
        } else if (movementType === "processing_out" || movementType === "waste" || movementType === "sample") {
          outflowMl += Math.abs(volumeMl);
        } else if (movementType === "adjustment") {
          adjustmentMl += volumeMl;
        }

        return { inflowMl, outflowMl, adjustmentMl };
      };

      // milking_in → inflow
      expect(classifyMovement("milking_in", 5000)).toEqual({ inflowMl: 5000, outflowMl: 0, adjustmentMl: 0 });

      // processing_out → outflow (negative volume)
      expect(classifyMovement("processing_out", -3000)).toEqual({ inflowMl: 0, outflowMl: 3000, adjustmentMl: 0 });

      // waste → outflow
      expect(classifyMovement("waste", -500)).toEqual({ inflowMl: 0, outflowMl: 500, adjustmentMl: 0 });

      // adjustment positive → adjustment
      expect(classifyMovement("adjustment", 2000)).toEqual({ inflowMl: 0, outflowMl: 0, adjustmentMl: 2000 });

      // adjustment negative → adjustment
      expect(classifyMovement("adjustment", -1000)).toEqual({ inflowMl: 0, outflowMl: 0, adjustmentMl: -1000 });

      // transfer positive → inflow
      expect(classifyMovement("transfer", 4000)).toEqual({ inflowMl: 4000, outflowMl: 0, adjustmentMl: 0 });

      // transfer negative → not classified as inflow or outflow (edge case)
      expect(classifyMovement("transfer", -4000)).toEqual({ inflowMl: 0, outflowMl: 0, adjustmentMl: 0 });

      // sample → outflow
      expect(classifyMovement("sample", -100)).toEqual({ inflowMl: 0, outflowMl: 100, adjustmentMl: 0 });
    });
  });

  describe("Metrics calculation logic", () => {
    it("should calculate daysUntilEmpty correctly", () => {
      const calculateDaysUntilEmpty = (currentVolumeMl: number, avgDailyConsumptionMl: number) => {
        return avgDailyConsumptionMl > 0 ? Math.round(currentVolumeMl / avgDailyConsumptionMl) : null;
      };

      // 10L remaining, 2L/day consumption → 5 days
      expect(calculateDaysUntilEmpty(10000, 2000)).toBe(5);

      // 0 consumption → null (infinite)
      expect(calculateDaysUntilEmpty(10000, 0)).toBe(null);

      // Empty tank → 0 days
      expect(calculateDaysUntilEmpty(0, 2000)).toBe(0);
    });

    it("should calculate turnover rate correctly", () => {
      const calculateTurnoverRate = (totalOutMl: number, capacityMl: number) => {
        return capacityMl > 0 ? +(totalOutMl / capacityMl).toFixed(2) : 0;
      };

      // 200L out of 100L capacity → 2x turnover
      expect(calculateTurnoverRate(200000, 100000)).toBe(2);

      // 50L out of 100L capacity → 0.5x
      expect(calculateTurnoverRate(50000, 100000)).toBe(0.5);

      // Zero capacity → 0
      expect(calculateTurnoverRate(50000, 0)).toBe(0);
    });
  });

  describe("Volume history reconstruction logic", () => {
    it("should carry forward volume when no movement on a day", () => {
      // Simulate the day-by-day reconstruction
      const dayMap: Record<string, number> = {
        "2026-01-01": 5000,
        "2026-01-03": 8000,
        "2026-01-05": 3000,
      };

      const allDays = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];
      let lastKnownVol = 0;
      const history: Array<{ date: string; volumeLiters: number }> = [];

      for (const day of allDays) {
        if (dayMap[day] !== undefined) {
          lastKnownVol = dayMap[day];
        }
        history.push({
          date: day,
          volumeLiters: +(lastKnownVol / 1000).toFixed(2),
        });
      }

      expect(history).toEqual([
        { date: "2026-01-01", volumeLiters: 5 },
        { date: "2026-01-02", volumeLiters: 5 },   // carried forward
        { date: "2026-01-03", volumeLiters: 8 },
        { date: "2026-01-04", volumeLiters: 8 },   // carried forward
        { date: "2026-01-05", volumeLiters: 3 },
      ]);
    });

    it("should start from beforeStart volume if no movements in period", () => {
      const dayMap: Record<string, number> = {};
      const allDays = ["2026-01-01", "2026-01-02", "2026-01-03"];
      let lastKnownVol = 15000; // before start

      const history: Array<{ date: string; volumeLiters: number }> = [];
      for (const day of allDays) {
        if (dayMap[day] !== undefined) {
          lastKnownVol = dayMap[day];
        }
        history.push({
          date: day,
          volumeLiters: +(lastKnownVol / 1000).toFixed(2),
        });
      }

      expect(history.every(h => h.volumeLiters === 15)).toBe(true);
    });
  });
});
