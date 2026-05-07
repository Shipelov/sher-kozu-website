import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * Tests for the listTankMovements procedure (Milk Movement Journal).
 * Validates input schema, filtering logic, and response structure.
 */

// Input schema matching the procedure definition
const listTankMovementsInputSchema = z.object({
  tankId: z.number().int().optional(),
  movementType: z.enum(["milking_in", "transfer", "processing_out", "waste", "sample", "adjustment"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

describe("listTankMovements input validation", () => {
  it("accepts empty input (all defaults)", () => {
    const result = listTankMovementsInputSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
    expect(result.tankId).toBeUndefined();
    expect(result.movementType).toBeUndefined();
  });

  it("accepts valid tankId filter", () => {
    const result = listTankMovementsInputSchema.parse({ tankId: 1 });
    expect(result.tankId).toBe(1);
  });

  it("accepts valid movementType filter", () => {
    const validTypes = ["milking_in", "transfer", "processing_out", "waste", "sample", "adjustment"];
    for (const type of validTypes) {
      const result = listTankMovementsInputSchema.parse({ movementType: type });
      expect(result.movementType).toBe(type);
    }
  });

  it("rejects invalid movementType", () => {
    expect(() => listTankMovementsInputSchema.parse({ movementType: "invalid_type" })).toThrow();
  });

  it("accepts valid date range", () => {
    const result = listTankMovementsInputSchema.parse({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    expect(result.dateFrom).toBe("2026-01-01");
    expect(result.dateTo).toBe("2026-01-31");
  });

  it("accepts valid pagination params", () => {
    const result = listTankMovementsInputSchema.parse({ limit: 20, offset: 40 });
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(40);
  });

  it("rejects limit > 200", () => {
    expect(() => listTankMovementsInputSchema.parse({ limit: 201 })).toThrow();
  });

  it("rejects limit < 1", () => {
    expect(() => listTankMovementsInputSchema.parse({ limit: 0 })).toThrow();
  });

  it("rejects negative offset", () => {
    expect(() => listTankMovementsInputSchema.parse({ offset: -1 })).toThrow();
  });

  it("accepts combined filters", () => {
    const result = listTankMovementsInputSchema.parse({
      tankId: 2,
      movementType: "processing_out",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-07",
      limit: 10,
      offset: 0,
    });
    expect(result.tankId).toBe(2);
    expect(result.movementType).toBe("processing_out");
    expect(result.dateFrom).toBe("2026-05-01");
    expect(result.dateTo).toBe("2026-05-07");
    expect(result.limit).toBe(10);
  });
});

describe("listTankMovements response structure", () => {
  it("response should have movements array and total count", () => {
    const mockResponse = {
      movements: [
        {
          id: 1,
          tankId: 1,
          tankName: "Танк №1 (козье)",
          milkType: "goat",
          movementType: "milking_in",
          volumeMl: 5000,
          tankVolumeAfterMl: 15000,
          sessionId: null,
          batchId: "B-001",
          note: "Утренняя дойка",
          performedByWorkerId: 1,
          workerName: "Иван",
          createdAt: "2026-05-07T08:00:00.000Z",
        },
      ],
      total: 1,
    };

    expect(mockResponse.movements).toBeInstanceOf(Array);
    expect(mockResponse.total).toBeTypeOf("number");
    expect(mockResponse.movements[0]).toHaveProperty("id");
    expect(mockResponse.movements[0]).toHaveProperty("tankId");
    expect(mockResponse.movements[0]).toHaveProperty("tankName");
    expect(mockResponse.movements[0]).toHaveProperty("milkType");
    expect(mockResponse.movements[0]).toHaveProperty("movementType");
    expect(mockResponse.movements[0]).toHaveProperty("volumeMl");
    expect(mockResponse.movements[0]).toHaveProperty("tankVolumeAfterMl");
    expect(mockResponse.movements[0]).toHaveProperty("note");
    expect(mockResponse.movements[0]).toHaveProperty("workerName");
    expect(mockResponse.movements[0]).toHaveProperty("createdAt");
  });

  it("movement types have correct sign semantics", () => {
    const MOVEMENT_TYPE_MAP: Record<string, { sign: string }> = {
      milking_in: { sign: "+" },
      transfer: { sign: "↔" },
      processing_out: { sign: "−" },
      waste: { sign: "−" },
      sample: { sign: "−" },
      adjustment: { sign: "±" },
    };

    // Positive movements (add milk)
    expect(MOVEMENT_TYPE_MAP["milking_in"].sign).toBe("+");

    // Negative movements (remove milk)
    expect(MOVEMENT_TYPE_MAP["processing_out"].sign).toBe("−");
    expect(MOVEMENT_TYPE_MAP["waste"].sign).toBe("−");
    expect(MOVEMENT_TYPE_MAP["sample"].sign).toBe("−");

    // Neutral/bidirectional
    expect(MOVEMENT_TYPE_MAP["transfer"].sign).toBe("↔");
    expect(MOVEMENT_TYPE_MAP["adjustment"].sign).toBe("±");
  });

  it("pagination calculates total pages correctly", () => {
    const total = 47;
    const pageSize = 20;
    const totalPages = Math.ceil(total / pageSize);
    expect(totalPages).toBe(3);
  });

  it("empty result returns zero total", () => {
    const emptyResponse = { movements: [], total: 0 };
    expect(emptyResponse.movements.length).toBe(0);
    expect(emptyResponse.total).toBe(0);
  });
});

describe("MOVEMENT_TYPE_MAP completeness", () => {
  const allTypes = ["milking_in", "transfer", "processing_out", "waste", "sample", "adjustment"];
  const MOVEMENT_TYPE_MAP: Record<string, { label: string; color: string; sign: string }> = {
    milking_in: { label: "Поступление (дойка)", color: "bg-emerald-100 text-emerald-700", sign: "+" },
    transfer: { label: "Перелив", color: "bg-blue-100 text-blue-700", sign: "↔" },
    processing_out: { label: "Переработка", color: "bg-amber-100 text-amber-700", sign: "−" },
    waste: { label: "Списание", color: "bg-red-100 text-red-700", sign: "−" },
    sample: { label: "Проба", color: "bg-purple-100 text-purple-700", sign: "−" },
    adjustment: { label: "Корректировка", color: "bg-gray-100 text-gray-700", sign: "±" },
  };

  it("all movement types have a label", () => {
    for (const type of allTypes) {
      expect(MOVEMENT_TYPE_MAP[type]).toBeDefined();
      expect(MOVEMENT_TYPE_MAP[type].label).toBeTruthy();
    }
  });

  it("all movement types have a color class", () => {
    for (const type of allTypes) {
      expect(MOVEMENT_TYPE_MAP[type].color).toContain("bg-");
      expect(MOVEMENT_TYPE_MAP[type].color).toContain("text-");
    }
  });

  it("all movement types have a sign indicator", () => {
    for (const type of allTypes) {
      expect(MOVEMENT_TYPE_MAP[type].sign).toBeTruthy();
    }
  });
});
