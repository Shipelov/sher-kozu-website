/**
 * Tests for cow product integration:
 * 1. Extended enum validation (cow species, none tier)
 * 2. Farm-only product filtering logic
 * 3. Catalog upsert with new enum values
 * 4. Import schema accepts cow/none values
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-create the schemas as used in productTrack.ts
const productTypeSchema = z.enum([
  "milk", "smetana", "yogurt", "kefir", "cheese",
  "brynza", "kachotta", "halumi", "ricotta", "camembert",
  "aged_cheese", "blue_cheese", "smoked_cheese",
  "butter", "condensed_milk", "fermented_drink", "custom",
]);

const tierSlugSchema = z.enum(["basic", "standard", "professional"]);
const catalogTierSchema = z.enum(["none", "basic", "standard", "professional"]);
const catalogSpeciesSchema = z.enum(["goat", "sheep", "both", "cow"]);

const upsertItemSchema = z.object({
  id: z.number().int().positive().optional(),
  minTier: catalogTierSchema,
  productType: productTypeSchema,
  label: z.string().min(1).max(160),
  species: catalogSpeciesSchema.default("both"),
  conversionRatio: z.number().min(0.1).max(100),
  unit: z.string().min(1).max(16).default("л"),
  description: z.string().max(500).optional().nullable(),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

const importItemSchema = z.object({
  id: z.number().int().positive().optional().nullable(),
  minTier: catalogTierSchema,
  productType: productTypeSchema,
  label: z.string().min(1).max(160),
  species: catalogSpeciesSchema.default("both"),
  conversionRatio: z.number().min(0.01).max(1000),
  unit: z.string().min(1).max(16).default("л"),
  description: z.string().max(500).optional().nullable(),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  deleteFlag: z.boolean().default(false),
});

const importInputSchema = z.object({
  items: z.array(importItemSchema).min(1).max(500),
});

// Helper: simulate the isFarmOnlyProduct function from frontend
const isFarmOnlyProduct = (item: { species: string; minTier: string }) =>
  item.species === "cow" || item.minTier === "none";

// Helper: simulate the getTierCatalogForOwner filtering logic
const TIER_HIERARCHY = ["basic", "standard", "professional"] as const;

function filterCatalogForOwner(
  items: Array<{ species: string; minTier: string; isEnabled: number }>,
  tierSlug: string,
  species?: string,
) {
  const tierIndex = TIER_HIERARCHY.indexOf(tierSlug as any);
  const allowedTiers = TIER_HIERARCHY.slice(0, tierIndex + 1);

  return items.filter((item) => {
    if (item.isEnabled !== 1) return false;
    if (!allowedTiers.includes(item.minTier as any)) return false;
    // Exclude cow products
    if (item.species === "cow") return false;
    // Exclude farm-only products (minTier = "none")
    if (item.minTier === "none") return false;
    // Species filtering
    if (species && species !== "both") {
      if (item.species !== species && item.species !== "both") return false;
    }
    return true;
  });
}

describe("Extended enum validation — catalogTierSchema", () => {
  it("should accept 'none' as a valid tier", () => {
    expect(catalogTierSchema.parse("none")).toBe("none");
  });

  it("should accept 'basic' as a valid tier", () => {
    expect(catalogTierSchema.parse("basic")).toBe("basic");
  });

  it("should accept 'standard' as a valid tier", () => {
    expect(catalogTierSchema.parse("standard")).toBe("standard");
  });

  it("should accept 'professional' as a valid tier", () => {
    expect(catalogTierSchema.parse("professional")).toBe("professional");
  });

  it("should reject invalid tier values", () => {
    expect(() => catalogTierSchema.parse("premium")).toThrow();
    expect(() => catalogTierSchema.parse("")).toThrow();
  });

  it("original tierSlugSchema should NOT accept 'none'", () => {
    expect(() => tierSlugSchema.parse("none")).toThrow();
  });
});

describe("Extended enum validation — catalogSpeciesSchema", () => {
  it("should accept 'cow' as a valid species", () => {
    expect(catalogSpeciesSchema.parse("cow")).toBe("cow");
  });

  it("should accept 'goat' as a valid species", () => {
    expect(catalogSpeciesSchema.parse("goat")).toBe("goat");
  });

  it("should accept 'sheep' as a valid species", () => {
    expect(catalogSpeciesSchema.parse("sheep")).toBe("sheep");
  });

  it("should accept 'both' as a valid species", () => {
    expect(catalogSpeciesSchema.parse("both")).toBe("both");
  });

  it("should reject invalid species values", () => {
    expect(() => catalogSpeciesSchema.parse("horse")).toThrow();
    expect(() => catalogSpeciesSchema.parse("")).toThrow();
  });
});

describe("Upsert schema — cow product creation", () => {
  it("should accept a cow product with minTier=none", () => {
    const input = {
      minTier: "none",
      productType: "cheese",
      label: "Сыр из коровьего молока",
      species: "cow",
      conversionRatio: 8,
      unit: "кг",
      isEnabled: true,
      sortOrder: 100,
    };
    const result = upsertItemSchema.parse(input);
    expect(result.minTier).toBe("none");
    expect(result.species).toBe("cow");
    expect(result.label).toBe("Сыр из коровьего молока");
  });

  it("should accept a cow product with minTier=none and no species (defaults to both)", () => {
    const input = {
      minTier: "none",
      productType: "milk",
      label: "Коровье молоко цельное",
      conversionRatio: 1,
    };
    const result = upsertItemSchema.parse(input);
    expect(result.species).toBe("both");
  });

  it("should accept updating an existing cow product (with id)", () => {
    const input = {
      id: 42,
      minTier: "none",
      productType: "butter",
      label: "Масло коровье",
      species: "cow",
      conversionRatio: 20,
      unit: "кг",
    };
    const result = upsertItemSchema.parse(input);
    expect(result.id).toBe(42);
    expect(result.minTier).toBe("none");
    expect(result.species).toBe("cow");
  });
});

describe("Import schema — cow product import", () => {
  it("should accept import with cow products", () => {
    const input = {
      items: [
        {
          minTier: "none",
          productType: "cheese",
          label: "Качотта из коровьего молока",
          species: "cow",
          conversionRatio: 7,
          unit: "кг",
          isEnabled: true,
          sortOrder: 50,
        },
        {
          minTier: "basic",
          productType: "milk",
          label: "Козье молоко",
          species: "goat",
          conversionRatio: 1,
          unit: "л",
          isEnabled: true,
          sortOrder: 1,
        },
      ],
    };
    const result = importInputSchema.parse(input);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].species).toBe("cow");
    expect(result.items[0].minTier).toBe("none");
    expect(result.items[1].species).toBe("goat");
    expect(result.items[1].minTier).toBe("basic");
  });

  it("should accept import with cow product deletion", () => {
    const input = {
      items: [
        {
          id: 99,
          minTier: "none",
          productType: "cheese",
          label: "Старый коровий сыр",
          species: "cow",
          conversionRatio: 8,
          deleteFlag: true,
        },
      ],
    };
    const result = importInputSchema.parse(input);
    expect(result.items[0].deleteFlag).toBe(true);
    expect(result.items[0].species).toBe("cow");
  });
});

describe("isFarmOnlyProduct helper", () => {
  it("should return true for cow species", () => {
    expect(isFarmOnlyProduct({ species: "cow", minTier: "none" })).toBe(true);
    expect(isFarmOnlyProduct({ species: "cow", minTier: "basic" })).toBe(true);
  });

  it("should return true for none tier", () => {
    expect(isFarmOnlyProduct({ species: "both", minTier: "none" })).toBe(true);
    expect(isFarmOnlyProduct({ species: "goat", minTier: "none" })).toBe(true);
  });

  it("should return false for standard owner products", () => {
    expect(isFarmOnlyProduct({ species: "goat", minTier: "basic" })).toBe(false);
    expect(isFarmOnlyProduct({ species: "sheep", minTier: "standard" })).toBe(false);
    expect(isFarmOnlyProduct({ species: "both", minTier: "professional" })).toBe(false);
  });
});

describe("Owner plan filtering — cow products excluded", () => {
  const sampleCatalog = [
    { species: "goat", minTier: "basic", isEnabled: 1, label: "Козье молоко" },
    { species: "sheep", minTier: "basic", isEnabled: 1, label: "Овечье молоко" },
    { species: "both", minTier: "standard", isEnabled: 1, label: "Сметана" },
    { species: "cow", minTier: "none", isEnabled: 1, label: "Коровий сыр" },
    { species: "cow", minTier: "none", isEnabled: 1, label: "Коровье масло" },
    { species: "both", minTier: "none", isEnabled: 1, label: "Фермерский творог" },
    { species: "goat", minTier: "professional", isEnabled: 1, label: "Камамбер козий" },
    { species: "goat", minTier: "basic", isEnabled: 0, label: "Отключённый продукт" },
  ];

  it("should exclude all cow products from owner catalog", () => {
    const result = filterCatalogForOwner(sampleCatalog, "professional");
    const cowProducts = result.filter(i => i.species === "cow");
    expect(cowProducts).toHaveLength(0);
  });

  it("should exclude all none-tier products from owner catalog", () => {
    const result = filterCatalogForOwner(sampleCatalog, "professional");
    const noneProducts = result.filter(i => i.minTier === "none");
    expect(noneProducts).toHaveLength(0);
  });

  it("should include goat and sheep products for professional tier", () => {
    const result = filterCatalogForOwner(sampleCatalog, "professional");
    expect(result.map(i => i.label)).toContain("Козье молоко");
    expect(result.map(i => i.label)).toContain("Овечье молоко");
    expect(result.map(i => i.label)).toContain("Сметана");
    expect(result.map(i => i.label)).toContain("Камамбер козий");
  });

  it("should exclude disabled products", () => {
    const result = filterCatalogForOwner(sampleCatalog, "professional");
    expect(result.map(i => i.label)).not.toContain("Отключённый продукт");
  });

  it("should filter by species for goat owner", () => {
    const result = filterCatalogForOwner(sampleCatalog, "professional", "goat");
    expect(result.map(i => i.label)).toContain("Козье молоко");
    expect(result.map(i => i.label)).toContain("Сметана"); // species=both
    expect(result.map(i => i.label)).not.toContain("Овечье молоко");
    expect(result.map(i => i.label)).not.toContain("Коровий сыр");
  });

  it("should filter by species for sheep owner", () => {
    const result = filterCatalogForOwner(sampleCatalog, "basic", "sheep");
    expect(result.map(i => i.label)).toContain("Овечье молоко");
    expect(result.map(i => i.label)).not.toContain("Козье молоко");
    expect(result.map(i => i.label)).not.toContain("Коровий сыр");
  });

  it("basic tier should not see standard/professional products", () => {
    const result = filterCatalogForOwner(sampleCatalog, "basic");
    expect(result.map(i => i.label)).not.toContain("Сметана"); // standard tier
    expect(result.map(i => i.label)).not.toContain("Камамбер козий"); // professional tier
  });

  it("standard tier should see basic+standard but not professional", () => {
    const result = filterCatalogForOwner(sampleCatalog, "standard");
    expect(result.map(i => i.label)).toContain("Козье молоко"); // basic
    expect(result.map(i => i.label)).toContain("Сметана"); // standard
    expect(result.map(i => i.label)).not.toContain("Камамбер козий"); // professional
  });

  it("empty catalog should return empty array", () => {
    const result = filterCatalogForOwner([], "professional");
    expect(result).toHaveLength(0);
  });

  it("catalog with only cow products should return empty for owner", () => {
    const cowOnly = [
      { species: "cow", minTier: "none", isEnabled: 1, label: "Коровий сыр" },
      { species: "cow", minTier: "none", isEnabled: 1, label: "Коровье масло" },
    ];
    const result = filterCatalogForOwner(cowOnly, "professional");
    expect(result).toHaveLength(0);
  });
});

describe("Cheesemaker catalog — cow products included", () => {
  // The cheesemaker sees ALL enabled products (no tier/species filtering)
  const sampleCatalog = [
    { species: "goat", minTier: "basic", isEnabled: 1, label: "Козье молоко" },
    { species: "cow", minTier: "none", isEnabled: 1, label: "Коровий сыр" },
    { species: "cow", minTier: "none", isEnabled: 0, label: "Отключённый коровий" },
  ];

  function filterForCheesemaker(items: typeof sampleCatalog) {
    return items.filter(i => i.isEnabled === 1);
  }

  it("should include cow products for cheesemaker", () => {
    const result = filterForCheesemaker(sampleCatalog);
    expect(result.map(i => i.label)).toContain("Коровий сыр");
  });

  it("should include goat products for cheesemaker", () => {
    const result = filterForCheesemaker(sampleCatalog);
    expect(result.map(i => i.label)).toContain("Козье молоко");
  });

  it("should exclude disabled products for cheesemaker", () => {
    const result = filterForCheesemaker(sampleCatalog);
    expect(result.map(i => i.label)).not.toContain("Отключённый коровий");
  });
});
