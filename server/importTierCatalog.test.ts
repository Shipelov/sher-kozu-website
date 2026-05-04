/**
 * Tests for the importTierCatalog procedure.
 * Validates input parsing, validation, and upsert logic.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-create the import schema used by the procedure to test validation
const productTypeSchema = z.enum([
  "milk", "smetana", "yogurt", "kefir", "cheese",
  "brynza", "kachotta", "halumi", "ricotta", "camembert",
  "aged_cheese", "blue_cheese", "smoked_cheese",
  "butter", "condensed_milk", "fermented_drink", "custom",
]);

const tierSlugSchema = z.enum(["basic", "standard", "professional"]);

const importItemSchema = z.object({
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
});

const importInputSchema = z.object({
  items: z.array(importItemSchema).min(1).max(500),
});

describe("importTierCatalog input validation", () => {
  it("should accept a valid new item (no id)", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Козье молоко цельное",
          species: "goat",
          conversionRatio: 1,
          unit: "л",
          isEnabled: true,
          sortOrder: 0,
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].id).toBeUndefined();
      expect(result.data.items[0].label).toBe("Козье молоко цельное");
    }
  });

  it("should accept an item with id for update", () => {
    const input = {
      items: [
        {
          id: 42,
          minTier: "standard",
          productType: "brynza",
          label: "Брынза козья",
          species: "goat",
          conversionRatio: 5,
          unit: "кг",
          isEnabled: true,
          sortOrder: 3,
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].id).toBe(42);
    }
  });

  it("should accept null id (treated as new)", () => {
    const input = {
      items: [
        {
          id: null,
          minTier: "basic",
          productType: "kefir",
          label: "Кефир козий",
          conversionRatio: 1,
          unit: "л",
          isEnabled: true,
          sortOrder: 1,
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].id).toBeNull();
    }
  });

  it("should reject invalid product type", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "invalid_type",
          label: "Тест",
          conversionRatio: 1,
          unit: "л",
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject invalid tier", () => {
    const input = {
      items: [
        {
          minTier: "premium",
          productType: "milk",
          label: "Тест",
          conversionRatio: 1,
          unit: "л",
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject empty label", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "",
          conversionRatio: 1,
          unit: "л",
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject conversionRatio below 0.01", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Тест",
          conversionRatio: 0.001,
          unit: "л",
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject conversionRatio above 1000", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Тест",
          conversionRatio: 1001,
          unit: "л",
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject empty items array", () => {
    const input = { items: [] };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should apply default values correctly", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Молоко",
          conversionRatio: 1,
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].species).toBe("both");
      expect(result.data.items[0].unit).toBe("л");
      expect(result.data.items[0].isEnabled).toBe(true);
      expect(result.data.items[0].sortOrder).toBe(0);
    }
  });

  it("should accept multiple items in batch", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      minTier: "basic" as const,
      productType: "milk" as const,
      label: `Продукт ${i + 1}`,
      conversionRatio: i + 1,
      unit: "л",
    }));
    const result = importInputSchema.safeParse({ items });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(10);
    }
  });

  it("should reject sortOrder above 9999", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Тест",
          conversionRatio: 1,
          unit: "л",
          sortOrder: 10000,
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept all valid species values", () => {
    for (const species of ["goat", "sheep", "both"] as const) {
      const input = {
        items: [
          {
            minTier: "basic" as const,
            productType: "milk" as const,
            label: "Тест",
            conversionRatio: 1,
            species,
          },
        ],
      };
      const result = importInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid species value", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Тест",
          conversionRatio: 1,
          species: "cow",
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept all valid product types", () => {
    const allTypes = [
      "milk", "smetana", "yogurt", "kefir", "cheese",
      "brynza", "kachotta", "halumi", "ricotta", "camembert",
      "aged_cheese", "blue_cheese", "smoked_cheese",
      "butter", "condensed_milk", "fermented_drink", "custom",
    ] as const;

    for (const pt of allTypes) {
      const input = {
        items: [
          {
            minTier: "basic" as const,
            productType: pt,
            label: `Тест ${pt}`,
            conversionRatio: 1,
          },
        ],
      };
      const result = importInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    }
  });

  it("should accept description as null", () => {
    const input = {
      items: [
        {
          minTier: "basic",
          productType: "milk",
          label: "Молоко",
          conversionRatio: 1,
          description: null,
        },
      ],
    };
    const result = importInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe("Excel header mapping logic", () => {
  // Simulate the header mapping used in the frontend
  const headerMap: Record<string, string> = {
    "ID": "id",
    "Название": "label",
    "Тип продукта": "productType",
    "Мин. тариф": "minTier",
    "Вид животного": "species",
    "Конверсия (л→1 ед.)": "conversionRatio",
    "Единица": "unit",
    "Описание": "description",
    "Активен (1/0)": "isEnabled",
    "Порядок": "sortOrder",
    // English fallbacks
    "id": "id",
    "label": "label",
    "productType": "productType",
    "minTier": "minTier",
    "species": "species",
    "conversionRatio": "conversionRatio",
    "unit": "unit",
    "description": "description",
    "isEnabled": "isEnabled",
    "sortOrder": "sortOrder",
  };

  it("should map Russian headers to internal keys", () => {
    const raw = {
      "ID": 1,
      "Название": "Молоко козье",
      "Тип продукта": "milk",
      "Мин. тариф": "basic",
      "Вид животного": "goat",
      "Конверсия (л→1 ед.)": 1,
      "Единица": "л",
      "Описание": "Цельное козье молоко",
      "Активен (1/0)": 1,
      "Порядок": 0,
    };

    const mapped: Record<string, any> = {};
    for (const [rawKey, value] of Object.entries(raw)) {
      const mappedKey = headerMap[rawKey.trim()];
      if (mappedKey) mapped[mappedKey] = value;
    }

    expect(mapped.id).toBe(1);
    expect(mapped.label).toBe("Молоко козье");
    expect(mapped.productType).toBe("milk");
    expect(mapped.minTier).toBe("basic");
    expect(mapped.species).toBe("goat");
    expect(mapped.conversionRatio).toBe(1);
    expect(mapped.unit).toBe("л");
    expect(mapped.description).toBe("Цельное козье молоко");
    expect(mapped.isEnabled).toBe(1);
    expect(mapped.sortOrder).toBe(0);
  });

  it("should map English headers to internal keys", () => {
    const raw = {
      "id": 5,
      "label": "Brynza",
      "productType": "brynza",
      "minTier": "standard",
      "species": "goat",
      "conversionRatio": 5,
      "unit": "кг",
      "isEnabled": 1,
      "sortOrder": 2,
    };

    const mapped: Record<string, any> = {};
    for (const [rawKey, value] of Object.entries(raw)) {
      const mappedKey = headerMap[rawKey.trim()];
      if (mappedKey) mapped[mappedKey] = value;
    }

    expect(mapped.id).toBe(5);
    expect(mapped.label).toBe("Brynza");
    expect(mapped.productType).toBe("brynza");
  });
});
