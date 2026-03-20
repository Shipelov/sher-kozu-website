import { describe, expect, it } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Product Track — Unit Tests
   Tests cover:
   1. Milk conversion logic (litres → product units)
   2. Milk budget enforcement
   3. Delivery schedule generation (equal monthly distribution)
   4. Delivery status transitions
   5. Chat message validation
   ═══════════════════════════════════════════════════════════════ */

/* ── Types (mirroring schema) ── */

type ProductOption = {
  id: number;
  animalId: number;
  productType: string;
  label: string;
  conversionRatio: number;
  unit: string;
  maxAnnualUnits: number;
  isEnabled: number;
  sortOrder: number;
};

type Selection = {
  productOptionId: number;
  annualUnits: number;
};

type EnrichedSelection = {
  productOptionId: number;
  productType: string;
  label: string;
  annualUnits: number;
  unit: string;
  milkUsed: number;
};

type DeliveryItem = {
  productType: string;
  label: string;
  quantity: number;
  unit: string;
};

/* ── Pure functions extracted for testing ── */

/**
 * Calculate milk usage for a set of product selections.
 * This mirrors the server-side calculateMilkUsage logic.
 */
function calculateMilkUsage(
  options: ProductOption[],
  selections: Selection[],
): { totalMilkUsed: number; enrichedSelections: EnrichedSelection[]; errors: string[] } {
  const optionMap = new Map<number, ProductOption>(options.map((o) => [o.id, o]));
  let totalMilkUsed = 0;
  const enrichedSelections: EnrichedSelection[] = [];
  const errors: string[] = [];

  for (const sel of selections) {
    const option = optionMap.get(sel.productOptionId);
    if (!option) {
      errors.push(`Продукт #${sel.productOptionId} не найден.`);
      continue;
    }
    if (!option.isEnabled) {
      errors.push(`Продукт «${option.label}» отключён.`);
      continue;
    }
    if (sel.annualUnits > option.maxAnnualUnits) {
      errors.push(`Превышен лимит для «${option.label}»: макс. ${option.maxAnnualUnits} ${option.unit}/год.`);
      continue;
    }

    const milkUsed = sel.annualUnits * option.conversionRatio;
    totalMilkUsed += milkUsed;

    enrichedSelections.push({
      productOptionId: sel.productOptionId,
      productType: option.productType,
      label: option.label,
      annualUnits: sel.annualUnits,
      unit: option.unit,
      milkUsed,
    });
  }

  return { totalMilkUsed, enrichedSelections, errors };
}

/**
 * Validate that total milk used doesn't exceed owner's budget.
 */
function validateMilkBudget(
  annualMilkLiters: number,
  sharePercent: number,
  totalMilkUsed: number,
): { valid: boolean; budget: number; remaining: number } {
  const budget = Math.floor((annualMilkLiters * sharePercent) / 100);
  return {
    valid: totalMilkUsed <= budget,
    budget,
    remaining: Math.max(0, budget - totalMilkUsed),
  };
}

/**
 * Generate equal monthly delivery schedule.
 * This mirrors the server-side generateDeliverySchedule logic.
 */
function generateMonthlySchedule(
  selections: EnrichedSelection[],
  year: number,
): Array<{ month: number; year: number; items: DeliveryItem[] }> {
  const entries: Array<{ month: number; year: number; items: DeliveryItem[] }> = [];

  for (let month = 1; month <= 12; month++) {
    const items = selections.map((sel) => ({
      productType: sel.productType,
      label: sel.label,
      quantity: Math.round((sel.annualUnits / 12) * 100) / 100,
      unit: sel.unit,
    }));
    entries.push({ month, year, items });
  }

  return entries;
}

/**
 * Validate delivery status transition.
 */
function isValidStatusTransition(
  current: "planned" | "ready" | "delivered",
  next: "planned" | "ready" | "delivered",
): boolean {
  const transitions: Record<string, string[]> = {
    planned: ["ready", "delivered"],
    ready: ["delivered", "planned"],
    delivered: ["planned"],
  };
  return transitions[current]?.includes(next) ?? false;
}

/**
 * Validate chat message.
 */
function validateChatMessage(text: string | null, hasPhoto: boolean): { valid: boolean; error?: string } {
  if (!text && !hasPhoto) {
    return { valid: false, error: "Сообщение не может быть пустым." };
  }
  if (text && text.length > 5000) {
    return { valid: false, error: "Текст сообщения не может превышать 5000 символов." };
  }
  return { valid: true };
}

/* ── Test Data ── */

const sampleOptions: ProductOption[] = [
  {
    id: 1,
    animalId: 1,
    productType: "milk",
    label: "Свежее козье молоко",
    conversionRatio: 1,
    unit: "л",
    maxAnnualUnits: 200,
    isEnabled: 1,
    sortOrder: 1,
  },
  {
    id: 2,
    animalId: 1,
    productType: "cheese",
    label: "Мягкий козий сыр",
    conversionRatio: 8,
    unit: "кг",
    maxAnnualUnits: 20,
    isEnabled: 1,
    sortOrder: 2,
  },
  {
    id: 3,
    animalId: 1,
    productType: "yogurt",
    label: "Натуральный йогурт",
    conversionRatio: 1.5,
    unit: "л",
    maxAnnualUnits: 100,
    isEnabled: 1,
    sortOrder: 3,
  },
  {
    id: 4,
    animalId: 1,
    productType: "kefir",
    label: "Кефир (отключён)",
    conversionRatio: 1.2,
    unit: "л",
    maxAnnualUnits: 50,
    isEnabled: 0,
    sortOrder: 4,
  },
];

/* ═══ Tests ═══ */

describe("Milk conversion logic", () => {
  it("calculates milk usage for a single product correctly", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 1, annualUnits: 50 },
    ]);

    expect(result.errors).toHaveLength(0);
    expect(result.totalMilkUsed).toBe(50); // 50 * 1 = 50 litres
    expect(result.enrichedSelections).toHaveLength(1);
    expect(result.enrichedSelections[0]).toMatchObject({
      productOptionId: 1,
      label: "Свежее козье молоко",
      annualUnits: 50,
      milkUsed: 50,
    });
  });

  it("calculates milk usage for multiple products correctly", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 1, annualUnits: 30 },  // 30 * 1 = 30 litres
      { productOptionId: 2, annualUnits: 5 },    // 5 * 8 = 40 litres
      { productOptionId: 3, annualUnits: 20 },   // 20 * 1.5 = 30 litres
    ]);

    expect(result.errors).toHaveLength(0);
    expect(result.totalMilkUsed).toBe(100); // 30 + 40 + 30 = 100
    expect(result.enrichedSelections).toHaveLength(3);
  });

  it("applies conversion ratio correctly for cheese (8:1)", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 2, annualUnits: 10 },
    ]);

    expect(result.totalMilkUsed).toBe(80); // 10 * 8 = 80 litres of milk for 10kg cheese
    expect(result.enrichedSelections[0]?.milkUsed).toBe(80);
  });

  it("applies conversion ratio correctly for yogurt (1.5:1)", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 3, annualUnits: 40 },
    ]);

    expect(result.totalMilkUsed).toBe(60); // 40 * 1.5 = 60
  });

  it("returns error for non-existent product", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 999, annualUnits: 10 },
    ]);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("не найден");
  });

  it("returns error for disabled product", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 4, annualUnits: 10 },
    ]);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("отключён");
  });

  it("returns error when exceeding max annual units", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 2, annualUnits: 25 }, // max is 20
    ]);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("лимит");
  });

  it("handles zero units gracefully", () => {
    const result = calculateMilkUsage(sampleOptions, [
      { productOptionId: 1, annualUnits: 0 },
    ]);

    expect(result.errors).toHaveLength(0);
    expect(result.totalMilkUsed).toBe(0);
  });

  it("handles empty selections", () => {
    const result = calculateMilkUsage(sampleOptions, []);

    expect(result.errors).toHaveLength(0);
    expect(result.totalMilkUsed).toBe(0);
    expect(result.enrichedSelections).toHaveLength(0);
  });
});

describe("Milk budget validation", () => {
  it("validates budget for 10% share of 500L animal", () => {
    const result = validateMilkBudget(500, 10, 40);
    expect(result.budget).toBe(50);
    expect(result.valid).toBe(true);
    expect(result.remaining).toBe(10);
  });

  it("rejects when usage exceeds budget", () => {
    const result = validateMilkBudget(500, 10, 60);
    expect(result.budget).toBe(50);
    expect(result.valid).toBe(false);
  });

  it("allows exact budget usage", () => {
    const result = validateMilkBudget(500, 10, 50);
    expect(result.valid).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("calculates budget correctly for 30% share of 800L", () => {
    const result = validateMilkBudget(800, 30, 200);
    expect(result.budget).toBe(240);
    expect(result.valid).toBe(true);
    expect(result.remaining).toBe(40);
  });

  it("floors budget to whole litres", () => {
    const result = validateMilkBudget(333, 10, 33);
    expect(result.budget).toBe(33); // Math.floor(333 * 10 / 100) = 33
    expect(result.valid).toBe(true);
  });
});

describe("Delivery schedule generation", () => {
  const selections: EnrichedSelection[] = [
    {
      productOptionId: 1,
      productType: "milk",
      label: "Свежее козье молоко",
      annualUnits: 120,
      unit: "л",
      milkUsed: 120,
    },
    {
      productOptionId: 2,
      productType: "cheese",
      label: "Мягкий козий сыр",
      annualUnits: 12,
      unit: "кг",
      milkUsed: 96,
    },
  ];

  it("generates exactly 12 monthly entries", () => {
    const schedule = generateMonthlySchedule(selections, 2026);
    expect(schedule).toHaveLength(12);
  });

  it("distributes products equally across months", () => {
    const schedule = generateMonthlySchedule(selections, 2026);

    // 120 litres / 12 months = 10 litres per month
    expect(schedule[0]?.items[0]?.quantity).toBe(10);
    // 12 kg / 12 months = 1 kg per month
    expect(schedule[0]?.items[1]?.quantity).toBe(1);
  });

  it("includes all products in each month", () => {
    const schedule = generateMonthlySchedule(selections, 2026);

    for (const entry of schedule) {
      expect(entry.items).toHaveLength(2);
      expect(entry.items[0]?.label).toBe("Свежее козье молоко");
      expect(entry.items[1]?.label).toBe("Мягкий козий сыр");
    }
  });

  it("sets correct year for all entries", () => {
    const schedule = generateMonthlySchedule(selections, 2026);
    for (const entry of schedule) {
      expect(entry.year).toBe(2026);
    }
  });

  it("months are numbered 1 through 12", () => {
    const schedule = generateMonthlySchedule(selections, 2026);
    const months = schedule.map((e) => e.month);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("handles non-divisible quantities with rounding", () => {
    const oddSelections: EnrichedSelection[] = [
      {
        productOptionId: 1,
        productType: "milk",
        label: "Молоко",
        annualUnits: 100,
        unit: "л",
        milkUsed: 100,
      },
    ];

    const schedule = generateMonthlySchedule(oddSelections, 2026);
    // 100 / 12 = 8.333... → rounded to 8.33
    expect(schedule[0]?.items[0]?.quantity).toBe(8.33);
  });

  it("handles single product selection", () => {
    const singleSelection: EnrichedSelection[] = [
      {
        productOptionId: 1,
        productType: "cheese",
        label: "Сыр",
        annualUnits: 24,
        unit: "кг",
        milkUsed: 192,
      },
    ];

    const schedule = generateMonthlySchedule(singleSelection, 2026);
    expect(schedule).toHaveLength(12);
    for (const entry of schedule) {
      expect(entry.items).toHaveLength(1);
      expect(entry.items[0]?.quantity).toBe(2); // 24 / 12 = 2
    }
  });

  it("handles empty selections", () => {
    const schedule = generateMonthlySchedule([], 2026);
    expect(schedule).toHaveLength(12);
    for (const entry of schedule) {
      expect(entry.items).toHaveLength(0);
    }
  });
});

describe("Delivery status transitions", () => {
  it("allows planned → ready", () => {
    expect(isValidStatusTransition("planned", "ready")).toBe(true);
  });

  it("allows planned → delivered (skip ready)", () => {
    expect(isValidStatusTransition("planned", "delivered")).toBe(true);
  });

  it("allows ready → delivered", () => {
    expect(isValidStatusTransition("ready", "delivered")).toBe(true);
  });

  it("allows ready → planned (rollback)", () => {
    expect(isValidStatusTransition("ready", "planned")).toBe(true);
  });

  it("allows delivered → planned (admin reset)", () => {
    expect(isValidStatusTransition("delivered", "planned")).toBe(true);
  });

  it("does not allow same status transition", () => {
    expect(isValidStatusTransition("planned", "planned")).toBe(false);
    expect(isValidStatusTransition("ready", "ready")).toBe(false);
    expect(isValidStatusTransition("delivered", "delivered")).toBe(false);
  });
});

describe("Chat message validation", () => {
  it("accepts text-only message", () => {
    const result = validateChatMessage("Привет!", false);
    expect(result.valid).toBe(true);
  });

  it("accepts photo-only message", () => {
    const result = validateChatMessage(null, true);
    expect(result.valid).toBe(true);
  });

  it("accepts text + photo message", () => {
    const result = validateChatMessage("Вот фото продукции", true);
    expect(result.valid).toBe(true);
  });

  it("rejects empty message (no text, no photo)", () => {
    const result = validateChatMessage(null, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("пустым");
  });

  it("rejects empty string text without photo", () => {
    const result = validateChatMessage("", false);
    expect(result.valid).toBe(false);
  });

  it("rejects text exceeding 5000 characters", () => {
    const longText = "а".repeat(5001);
    const result = validateChatMessage(longText, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("5000");
  });

  it("accepts text at exactly 5000 characters", () => {
    const maxText = "а".repeat(5000);
    const result = validateChatMessage(maxText, false);
    expect(result.valid).toBe(true);
  });
});

describe("Full flow: selections → budget → schedule", () => {
  it("complete owner flow: select products, validate budget, generate schedule", () => {
    // Step 1: Owner selects products
    const selections: Selection[] = [
      { productOptionId: 1, annualUnits: 24 },  // 24L milk
      { productOptionId: 2, annualUnits: 3 },    // 3kg cheese = 24L milk
    ];

    // Step 2: Calculate milk usage
    const milkResult = calculateMilkUsage(sampleOptions, selections);
    expect(milkResult.errors).toHaveLength(0);
    expect(milkResult.totalMilkUsed).toBe(48); // 24 + 24

    // Step 3: Validate against budget (animal: 500L/year, owner: 10% = 50L)
    const budgetResult = validateMilkBudget(500, 10, milkResult.totalMilkUsed);
    expect(budgetResult.valid).toBe(true);
    expect(budgetResult.remaining).toBe(2);

    // Step 4: Generate delivery schedule
    const schedule = generateMonthlySchedule(milkResult.enrichedSelections, 2026);
    expect(schedule).toHaveLength(12);

    // Each month: 2L milk + 0.25kg cheese
    expect(schedule[0]?.items[0]?.quantity).toBe(2);    // 24 / 12
    expect(schedule[0]?.items[1]?.quantity).toBe(0.25);  // 3 / 12
  });

  it("rejects plan that exceeds milk budget", () => {
    const selections: Selection[] = [
      { productOptionId: 1, annualUnits: 100 },  // 100L milk
      { productOptionId: 2, annualUnits: 10 },   // 10kg cheese = 80L milk
    ];

    const milkResult = calculateMilkUsage(sampleOptions, selections);
    expect(milkResult.totalMilkUsed).toBe(180); // 100 + 80

    // 10% of 500L = 50L budget → should fail
    const budgetResult = validateMilkBudget(500, 10, milkResult.totalMilkUsed);
    expect(budgetResult.valid).toBe(false);
  });

  it("handles large share (50%) with generous budget", () => {
    const selections: Selection[] = [
      { productOptionId: 1, annualUnits: 100 },  // 100L
      { productOptionId: 2, annualUnits: 15 },   // 120L
      { productOptionId: 3, annualUnits: 20 },   // 30L
    ];

    const milkResult = calculateMilkUsage(sampleOptions, selections);
    expect(milkResult.totalMilkUsed).toBe(250);

    const budgetResult = validateMilkBudget(600, 50, milkResult.totalMilkUsed);
    expect(budgetResult.budget).toBe(300);
    expect(budgetResult.valid).toBe(true);
    expect(budgetResult.remaining).toBe(50);
  });
});
