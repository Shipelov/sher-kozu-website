/**
 * Tests for enhanced import features:
 * 1. Delete column in catalog import
 * 2. Import history schema
 * 3. Owner plans import validation
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── 1. Catalog import with deleteFlag ──

const productTypeSchema = z.enum([
  "milk", "smetana", "yogurt", "kefir", "cheese",
  "brynza", "kachotta", "halumi", "ricotta", "camembert",
  "aged_cheese", "blue_cheese", "smoked_cheese",
  "butter", "condensed_milk", "fermented_drink", "custom",
]);

const tierSlugSchema = z.enum(["basic", "standard", "professional"]);

const importItemSchemaWithDelete = z.object({
  id: z.number().int().positive().optional().nullable(),
  minTier: tierSlugSchema,
  productType: productTypeSchema,
  label: z.string().min(1).max(160),
  species: z.enum(["goat", "sheep", "both"]).default("both"),
  conversionRatio: z.number().min(0.01).max(1000),
  unit: z.string().min(1).max(16).default("л"),
  description: z.string().max(500).optional().nullable(),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  deleteFlag: z.boolean().default(false),
});

const importInputSchemaWithDelete = z.object({
  items: z.array(importItemSchemaWithDelete).min(1).max(500),
});

describe("Catalog import with deleteFlag", () => {
  it("should accept deleteFlag=true for deletion", () => {
    const input = {
      items: [
        {
          id: 42,
          minTier: "basic",
          productType: "milk",
          label: "Козье молоко",
          conversionRatio: 1,
          unit: "л",
          deleteFlag: true,
        },
      ],
    };
    const result = importInputSchemaWithDelete.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].deleteFlag).toBe(true);
      expect(result.data.items[0].id).toBe(42);
    }
  });

  it("should default deleteFlag to false", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Козье молоко",
          conversionRatio: 1,
        },
      ],
    };
    const result = importInputSchemaWithDelete.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].deleteFlag).toBe(false);
    }
  });

  it("should accept deleteFlag=false explicitly", () => {
    const input = {
      items: [
        {
          id: 10,
          minTier: "standard",
          productType: "cheese",
          label: "Сыр козий",
          conversionRatio: 5,
          unit: "кг",
          deleteFlag: false,
        },
      ],
    };
    const result = importInputSchemaWithDelete.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].deleteFlag).toBe(false);
    }
  });

  it("should handle mixed create/update/delete items", () => {
    const input = {
      items: [
        { minTier: "basic", productType: "milk", label: "Новое молоко", conversionRatio: 1 },
        { id: 5, minTier: "standard", productType: "cheese", label: "Обновить сыр", conversionRatio: 5, unit: "кг" },
        { id: 10, minTier: "basic", productType: "kefir", label: "Удалить кефир", conversionRatio: 1, deleteFlag: true },
      ],
    };
    const result = importInputSchemaWithDelete.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].id).toBeUndefined();
      expect(result.data.items[0].deleteFlag).toBe(false);
      expect(result.data.items[1].id).toBe(5);
      expect(result.data.items[1].deleteFlag).toBe(false);
      expect(result.data.items[2].id).toBe(10);
      expect(result.data.items[2].deleteFlag).toBe(true);
    }
  });

  it("should not require id for delete (but delete without id is a no-op)", () => {
    const input = {
      items: [
        { minTier: "basic", productType: "milk", label: "Тест", conversionRatio: 1, deleteFlag: true },
      ],
    };
    const result = importInputSchemaWithDelete.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].deleteFlag).toBe(true);
      expect(result.data.items[0].id).toBeUndefined();
    }
  });
});

// ── 2. Import history schema validation ──

describe("Import history record schema", () => {
  const historyRecordSchema = z.object({
    adminOpenId: z.string().min(1),
    adminName: z.string().nullable(),
    snapshotJson: z.string().min(2),
    itemsCreated: z.number().int().min(0),
    itemsUpdated: z.number().int().min(0),
    itemsDeleted: z.number().int().min(0),
    totalItems: z.number().int().min(0),
    note: z.string().max(500).optional().nullable(),
  });

  it("should accept valid history record", () => {
    const record = {
      adminOpenId: "admin-123",
      adminName: "Администратор",
      snapshotJson: JSON.stringify([{ id: 1, label: "Молоко" }]),
      itemsCreated: 2,
      itemsUpdated: 3,
      itemsDeleted: 1,
      totalItems: 6,
    };
    const result = historyRecordSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("should accept record with note", () => {
    const record = {
      adminOpenId: "admin-123",
      adminName: null,
      snapshotJson: "[]",
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      totalItems: 0,
      note: "Откат к версии #5",
    };
    const result = historyRecordSchema.safeParse(record);
    expect(result.success).toBe(true);
  });

  it("should reject empty snapshotJson", () => {
    const record = {
      adminOpenId: "admin-123",
      adminName: "Admin",
      snapshotJson: "",
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      totalItems: 0,
    };
    const result = historyRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
  });

  it("should reject missing adminOpenId", () => {
    const record = {
      adminName: "Admin",
      snapshotJson: "[]",
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      totalItems: 0,
    };
    const result = historyRecordSchema.safeParse(record);
    expect(result.success).toBe(false);
  });

  it("should track snapshot as parseable JSON", () => {
    const snapshot = [
      { id: 1, label: "Молоко", minTier: "basic", productType: "milk", conversionRatio: 1, isEnabled: true },
      { id: 2, label: "Сыр", minTier: "standard", productType: "cheese", conversionRatio: 5, isEnabled: true },
    ];
    const snapshotJson = JSON.stringify(snapshot);
    expect(() => JSON.parse(snapshotJson)).not.toThrow();
    const parsed = JSON.parse(snapshotJson);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].label).toBe("Молоко");
  });
});

// ── 3. Owner plans import validation ──

const importOwnerPlansSchema = z.object({
  animalId: z.number().int().positive(),
  plans: z.array(z.object({
    planId: z.number().int().positive(),
    selections: z.array(z.object({
      label: z.string().min(1),
      annualUnits: z.number().int().min(0),
      unit: z.string().min(1).default("л"),
    })).min(1),
    adminNotes: z.string().max(2000).optional().nullable(),
  })).min(1).max(100),
});

describe("Owner plans import validation", () => {
  it("should accept valid plan import", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [
            { label: "Козье молоко", annualUnits: 120, unit: "л" },
            { label: "Сметана", annualUnits: 24, unit: "л" },
          ],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plans).toHaveLength(1);
      expect(result.data.plans[0].selections).toHaveLength(2);
    }
  });

  it("should accept multiple plans", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [{ label: "Молоко", annualUnits: 100, unit: "л" }],
        },
        {
          planId: 20,
          selections: [{ label: "Сыр", annualUnits: 12, unit: "кг" }],
          adminNotes: "Обновлено через импорт",
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plans).toHaveLength(2);
      expect(result.data.plans[1].adminNotes).toBe("Обновлено через импорт");
    }
  });

  it("should reject empty selections", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject empty plans array", () => {
    const input = {
      animalId: 1,
      plans: [],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject negative annualUnits", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [{ label: "Молоко", annualUnits: -5, unit: "л" }],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept zero annualUnits (product removed from plan)", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [{ label: "Молоко", annualUnits: 0, unit: "л" }],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject invalid animalId", () => {
    const input = {
      animalId: 0,
      plans: [
        {
          planId: 10,
          selections: [{ label: "Молоко", annualUnits: 10, unit: "л" }],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject invalid planId", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: -1,
          selections: [{ label: "Молоко", annualUnits: 10, unit: "л" }],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should default unit to 'л'", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [{ label: "Молоко", annualUnits: 100 }],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plans[0].selections[0].unit).toBe("л");
    }
  });

  it("should accept adminNotes as null", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [{ label: "Молоко", annualUnits: 100, unit: "л" }],
          adminNotes: null,
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plans[0].adminNotes).toBeNull();
    }
  });

  it("should reject empty label", () => {
    const input = {
      animalId: 1,
      plans: [
        {
          planId: 10,
          selections: [{ label: "", annualUnits: 100, unit: "л" }],
        },
      ],
    };
    const result = importOwnerPlansSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ── 4. Excel header mapping for plans ──

describe("Plan Excel header mapping", () => {
  const headerMap: Record<string, string> = {
    "ИД плана": "planId",
    "Владелец": "ownerName",
    "Продукт": "label",
    "Кол-во/год": "annualUnits",
    "Ед.": "unit",
    "Заметка админа": "adminNotes",
    "planId": "planId",
    "ownerName": "ownerName",
    "label": "label",
    "annualUnits": "annualUnits",
    "unit": "unit",
    "adminNotes": "adminNotes",
  };

  it("should map Russian plan headers correctly", () => {
    const raw = {
      "ИД плана": 10,
      "Владелец": "Иванов",
      "Продукт": "Козье молоко",
      "Кол-во/год": 120,
      "Ед.": "л",
      "Заметка админа": "Тестовая заметка",
    };

    const mapped: Record<string, any> = {};
    for (const [rawKey, value] of Object.entries(raw)) {
      const mappedKey = headerMap[rawKey.trim()];
      if (mappedKey) mapped[mappedKey] = value;
    }

    expect(mapped.planId).toBe(10);
    expect(mapped.ownerName).toBe("Иванов");
    expect(mapped.label).toBe("Козье молоко");
    expect(mapped.annualUnits).toBe(120);
    expect(mapped.unit).toBe("л");
    expect(mapped.adminNotes).toBe("Тестовая заметка");
  });

  it("should map English plan headers correctly", () => {
    const raw = {
      "planId": 10,
      "ownerName": "Ivanov",
      "label": "Goat milk",
      "annualUnits": 120,
      "unit": "l",
    };

    const mapped: Record<string, any> = {};
    for (const [rawKey, value] of Object.entries(raw)) {
      const mappedKey = headerMap[rawKey.trim()];
      if (mappedKey) mapped[mappedKey] = value;
    }

    expect(mapped.planId).toBe(10);
    expect(mapped.label).toBe("Goat milk");
  });

  it("should handle fill-down logic for merged plan rows", () => {
    // Simulate the fill-down logic from the import handler
    const rows = [
      { "ИД плана": 10, "Владелец": "Иванов", "Продукт": "Молоко", "Кол-во/год": 120, "Ед.": "л" },
      { "Продукт": "Сметана", "Кол-во/год": 24, "Ед.": "л" },
      { "Продукт": "Кефир", "Кол-во/год": 48, "Ед.": "л" },
      { "ИД плана": 20, "Владелец": "Петров", "Продукт": "Молоко", "Кол-во/год": 60, "Ед.": "л" },
    ];

    let currentPlanId: number | null = null;
    let currentOwnerName = "";
    const parsed: Array<{ planId: number; ownerName: string; label: string; annualUnits: number }> = [];

    for (const raw of rows) {
      const row: Record<string, any> = {};
      for (const [rawKey, value] of Object.entries(raw)) {
        const mappedKey = headerMap[rawKey.trim()];
        if (mappedKey) row[mappedKey] = value;
      }

      if (row.planId && !isNaN(parseInt(String(row.planId)))) {
        currentPlanId = parseInt(String(row.planId));
        currentOwnerName = String(row.ownerName ?? "").trim();
      }

      const label = String(row.label ?? "").trim();
      if (!label || !currentPlanId) continue;

      parsed.push({
        planId: currentPlanId,
        ownerName: currentOwnerName,
        label,
        annualUnits: parseInt(String(row.annualUnits ?? "0"), 10),
      });
    }

    expect(parsed).toHaveLength(4);
    // First 3 rows belong to plan 10
    expect(parsed[0].planId).toBe(10);
    expect(parsed[0].ownerName).toBe("Иванов");
    expect(parsed[1].planId).toBe(10);
    expect(parsed[1].label).toBe("Сметана");
    expect(parsed[2].planId).toBe(10);
    expect(parsed[2].label).toBe("Кефир");
    // 4th row belongs to plan 20
    expect(parsed[3].planId).toBe(20);
    expect(parsed[3].ownerName).toBe("Петров");
  });
});

// ── 5. Delete flag Excel mapping ──

describe("Delete flag Excel column mapping", () => {
  it("should parse '1' as deleteFlag=true", () => {
    const rawValue = 1;
    const deleteFlag = rawValue === 1 || rawValue === true || String(rawValue).trim() === "1" || String(rawValue).toLowerCase() === "true" || String(rawValue).toLowerCase() === "да";
    expect(deleteFlag).toBe(true);
  });

  it("should parse 'Да' as deleteFlag=true", () => {
    const rawValue = "Да";
    const deleteFlag = rawValue === 1 || rawValue === true || String(rawValue).trim() === "1" || String(rawValue).toLowerCase() === "true" || String(rawValue).toLowerCase() === "да";
    expect(deleteFlag).toBe(true);
  });

  it("should parse 'true' as deleteFlag=true", () => {
    const rawValue = "true";
    const deleteFlag = rawValue === 1 || rawValue === true || String(rawValue).trim() === "1" || String(rawValue).toLowerCase() === "true" || String(rawValue).toLowerCase() === "да";
    expect(deleteFlag).toBe(true);
  });

  it("should parse 0 as deleteFlag=false", () => {
    const rawValue = 0;
    const deleteFlag = rawValue === 1 || rawValue === true || String(rawValue).trim() === "1" || String(rawValue).toLowerCase() === "true" || String(rawValue).toLowerCase() === "да";
    expect(deleteFlag).toBe(false);
  });

  it("should parse empty string as deleteFlag=false", () => {
    const rawValue = "";
    const deleteFlag = rawValue === 1 || rawValue === true || String(rawValue).trim() === "1" || String(rawValue).toLowerCase() === "true" || String(rawValue).toLowerCase() === "да";
    expect(deleteFlag).toBe(false);
  });
});

// ── 6. Milk calculation for imported plans ──

describe("Milk calculation for imported plans", () => {
  it("should calculate milk usage from catalog conversionRatio", () => {
    const catalog = [
      { id: 1, label: "Козье молоко", conversionRatio: 1, productType: "milk" },
      { id: 2, label: "Сметана", conversionRatio: 2.5, productType: "smetana" },
      { id: 3, label: "Сыр козий", conversionRatio: 8, productType: "cheese" },
    ];

    const catalogByLabel = new Map<string, typeof catalog[0]>();
    for (const item of catalog) {
      catalogByLabel.set(item.label.toLowerCase().trim(), item);
    }

    const selections = [
      { label: "Козье молоко", annualUnits: 120, unit: "л" },
      { label: "Сметана", annualUnits: 24, unit: "л" },
      { label: "Сыр козий", annualUnits: 12, unit: "кг" },
    ];

    const enriched = selections.map(sel => {
      const catalogItem = catalogByLabel.get(sel.label.toLowerCase().trim());
      const conversionRatio = catalogItem?.conversionRatio ?? 1;
      const milkUsed = Math.round(sel.annualUnits * conversionRatio * 100) / 100;
      return { ...sel, milkUsed, catalogItemId: catalogItem?.id ?? null };
    });

    expect(enriched[0].milkUsed).toBe(120);  // 120 * 1
    expect(enriched[1].milkUsed).toBe(60);    // 24 * 2.5
    expect(enriched[2].milkUsed).toBe(96);    // 12 * 8
    expect(enriched[0].catalogItemId).toBe(1);
    expect(enriched[1].catalogItemId).toBe(2);
    expect(enriched[2].catalogItemId).toBe(3);

    const totalMilk = Math.floor(enriched.reduce((sum, s) => sum + s.milkUsed, 0));
    expect(totalMilk).toBe(276);
  });

  it("should use conversionRatio=1 for unknown products", () => {
    const catalogByLabel = new Map<string, { conversionRatio: number }>();
    const sel = { label: "Неизвестный продукт", annualUnits: 50, unit: "шт" };
    const catalogItem = catalogByLabel.get(sel.label.toLowerCase().trim());
    const conversionRatio = catalogItem?.conversionRatio ?? 1;
    const milkUsed = Math.round(sel.annualUnits * conversionRatio * 100) / 100;
    expect(milkUsed).toBe(50);
  });
});
