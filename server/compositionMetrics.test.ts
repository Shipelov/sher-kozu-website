import { describe, it, expect } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Composition Snapshots & Monthly Metrics — Unit Tests
   Tests cover:
   1. Composition snapshot data validation
   2. Monthly metric data validation & conversion
   3. transformApiToSummary mapping for composition & metrics
   4. Public tracker data structure
   5. Admin CRUD input validation
   ═══════════════════════════════════════════════════════════════ */

/* ── Types (mirroring schema) ── */

type CompositionSnapshot = {
  id: number;
  animalSlug: string;
  ownerOpenId: string;
  label: string;
  value: string;
  note: string;
  sortOrder: number;
};

type MonthlyMetric = {
  id: number;
  animalSlug: string;
  ownerOpenId: string;
  monthLabel: string;
  milkVolumeLiters: number;
  proteinPercentTenth: number;
  fatPercentTenth: number;
  sortOrder: number;
};

/* ── Pure functions for testing ── */

/** Validate composition snapshot input */
function validateCompositionInput(input: {
  label?: string;
  value?: string;
  note?: string;
  sortOrder?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.label || input.label.trim().length === 0) {
    errors.push("Label is required");
  }
  if (input.label && input.label.length > 120) {
    errors.push("Label must be 120 characters or less");
  }
  if (!input.value || input.value.trim().length === 0) {
    errors.push("Value is required");
  }
  if (input.value && input.value.length > 120) {
    errors.push("Value must be 120 characters or less");
  }
  if (input.note && input.note.length > 255) {
    errors.push("Note must be 255 characters or less");
  }
  if (input.sortOrder !== undefined && (input.sortOrder < 0 || input.sortOrder > 9999)) {
    errors.push("Sort order must be between 0 and 9999");
  }
  return { valid: errors.length === 0, errors };
}

/** Validate monthly metric input */
function validateMonthlyMetricInput(input: {
  monthLabel?: string;
  milkVolumeLiters?: number;
  proteinPercentTenth?: number;
  fatPercentTenth?: number;
  sortOrder?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.monthLabel || input.monthLabel.trim().length === 0) {
    errors.push("Month label is required");
  }
  if (input.monthLabel && input.monthLabel.length > 32) {
    errors.push("Month label must be 32 characters or less");
  }
  if (input.milkVolumeLiters === undefined || input.milkVolumeLiters < 0) {
    errors.push("Milk volume must be non-negative");
  }
  if (input.milkVolumeLiters !== undefined && input.milkVolumeLiters > 100_000) {
    errors.push("Milk volume must be 100000 or less");
  }
  if (input.proteinPercentTenth !== undefined && (input.proteinPercentTenth < 0 || input.proteinPercentTenth > 1000)) {
    errors.push("Protein percent tenth must be between 0 and 1000");
  }
  if (input.fatPercentTenth !== undefined && (input.fatPercentTenth < 0 || input.fatPercentTenth > 1000)) {
    errors.push("Fat percent tenth must be between 0 and 1000");
  }
  if (input.sortOrder !== undefined && (input.sortOrder < 0 || input.sortOrder > 9999)) {
    errors.push("Sort order must be between 0 and 9999");
  }
  return { valid: errors.length === 0, errors };
}

/** Convert protein/fat from tenths to display percentage */
function formatPercentFromTenth(tenth: number): string {
  return (tenth / 10).toFixed(1) + "%";
}

/** Transform raw composition snapshots to UI-ready items */
function transformCompositionToUI(snapshots: CompositionSnapshot[]): Array<{
  label: string;
  value: number;
  max: number;
  unit: string;
}> {
  return snapshots.map((s) => {
    const numVal = parseFloat(s.value) || 0;
    return {
      label: s.label,
      value: numVal,
      max: Math.max(numVal * 1.5, 10),
      unit: s.note,
    };
  });
}

/** Transform raw monthly metrics to UI-ready items */
function transformMetricsToUI(metrics: MonthlyMetric[]): Array<{
  month: string;
  liters: number;
}> {
  return metrics.map((m) => ({
    month: m.monthLabel,
    liters: m.milkVolumeLiters,
  }));
}

/** Calculate total annual milk volume from monthly metrics */
function calculateAnnualVolume(metrics: MonthlyMetric[]): number {
  return metrics.reduce((sum, m) => sum + m.milkVolumeLiters, 0);
}

/** Get average protein and fat percentages */
function calculateAverages(metrics: MonthlyMetric[]): { avgProtein: number; avgFat: number } {
  if (metrics.length === 0) return { avgProtein: 0, avgFat: 0 };
  const totalProtein = metrics.reduce((sum, m) => sum + m.proteinPercentTenth, 0);
  const totalFat = metrics.reduce((sum, m) => sum + m.fatPercentTenth, 0);
  return {
    avgProtein: totalProtein / metrics.length / 10,
    avgFat: totalFat / metrics.length / 10,
  };
}

const MONTH_LABELS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/* ═══════════════════════════════════════════════════════════════
   Test Suites
   ═══════════════════════════════════════════════════════════════ */

describe("Composition Snapshot Validation", () => {
  it("accepts valid composition input", () => {
    const result = validateCompositionInput({
      label: "Жирность",
      value: "4.2%",
      note: "процент",
      sortOrder: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty label", () => {
    const result = validateCompositionInput({
      label: "",
      value: "4.2%",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Label is required");
  });

  it("rejects empty value", () => {
    const result = validateCompositionInput({
      label: "Жирность",
      value: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Value is required");
  });

  it("rejects label over 120 chars", () => {
    const result = validateCompositionInput({
      label: "A".repeat(121),
      value: "4.2%",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Label must be 120 characters or less");
  });

  it("rejects value over 120 chars", () => {
    const result = validateCompositionInput({
      label: "Жирность",
      value: "V".repeat(121),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Value must be 120 characters or less");
  });

  it("rejects note over 255 chars", () => {
    const result = validateCompositionInput({
      label: "Жирность",
      value: "4.2%",
      note: "N".repeat(256),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Note must be 255 characters or less");
  });

  it("rejects negative sortOrder", () => {
    const result = validateCompositionInput({
      label: "Жирность",
      value: "4.2%",
      sortOrder: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Sort order must be between 0 and 9999");
  });

  it("rejects sortOrder over 9999", () => {
    const result = validateCompositionInput({
      label: "Жирность",
      value: "4.2%",
      sortOrder: 10000,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Sort order must be between 0 and 9999");
  });

  it("accepts composition without note", () => {
    const result = validateCompositionInput({
      label: "Белок",
      value: "3.1%",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts composition without sortOrder", () => {
    const result = validateCompositionInput({
      label: "Лактоза",
      value: "4.8%",
      note: "г/100мл",
    });
    expect(result.valid).toBe(true);
  });
});

describe("Monthly Metric Validation", () => {
  it("accepts valid monthly metric input", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "Январь",
      milkVolumeLiters: 120,
      proteinPercentTenth: 32,
      fatPercentTenth: 45,
      sortOrder: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty month label", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "",
      milkVolumeLiters: 120,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Month label is required");
  });

  it("rejects month label over 32 chars", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "M".repeat(33),
      milkVolumeLiters: 120,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Month label must be 32 characters or less");
  });

  it("rejects negative milk volume", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "Январь",
      milkVolumeLiters: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Milk volume must be non-negative");
  });

  it("rejects milk volume over 100000", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "Январь",
      milkVolumeLiters: 100001,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Milk volume must be 100000 or less");
  });

  it("rejects protein percent tenth over 1000", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "Январь",
      milkVolumeLiters: 120,
      proteinPercentTenth: 1001,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Protein percent tenth must be between 0 and 1000");
  });

  it("rejects negative fat percent tenth", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "Январь",
      milkVolumeLiters: 120,
      fatPercentTenth: -1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Fat percent tenth must be between 0 and 1000");
  });

  it("accepts zero milk volume (dry month)", () => {
    const result = validateMonthlyMetricInput({
      monthLabel: "Декабрь",
      milkVolumeLiters: 0,
      proteinPercentTenth: 0,
      fatPercentTenth: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts all valid month labels", () => {
    for (const month of MONTH_LABELS) {
      const result = validateMonthlyMetricInput({
        monthLabel: month,
        milkVolumeLiters: 100,
      });
      expect(result.valid).toBe(true);
    }
  });
});

describe("Percent Formatting", () => {
  it("converts tenths to percentage string", () => {
    expect(formatPercentFromTenth(32)).toBe("3.2%");
    expect(formatPercentFromTenth(45)).toBe("4.5%");
    expect(formatPercentFromTenth(100)).toBe("10.0%");
    expect(formatPercentFromTenth(0)).toBe("0.0%");
    expect(formatPercentFromTenth(5)).toBe("0.5%");
  });

  it("handles large values", () => {
    expect(formatPercentFromTenth(999)).toBe("99.9%");
    expect(formatPercentFromTenth(1000)).toBe("100.0%");
  });
});

describe("Composition Transform to UI", () => {
  it("transforms snapshots to UI items", () => {
    const snapshots: CompositionSnapshot[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", label: "Жирность", value: "4.2", note: "%", sortOrder: 0 },
      { id: 2, animalSlug: "mira", ownerOpenId: "owner1", label: "Белок", value: "3.1", note: "%", sortOrder: 1 },
    ];
    const result = transformCompositionToUI(snapshots);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ label: "Жирность", value: 4.2, max: 10, unit: "%" });
    expect(result[1]).toEqual({ label: "Белок", value: 3.1, max: 10, unit: "%" });
  });

  it("handles non-numeric values gracefully", () => {
    const snapshots: CompositionSnapshot[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", label: "Цвет", value: "белый", note: "", sortOrder: 0 },
    ];
    const result = transformCompositionToUI(snapshots);
    expect(result[0].value).toBe(0);
    expect(result[0].max).toBe(10);
  });

  it("handles empty array", () => {
    const result = transformCompositionToUI([]);
    expect(result).toHaveLength(0);
  });

  it("calculates max correctly for large values", () => {
    const snapshots: CompositionSnapshot[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", label: "Жирность", value: "12.5", note: "%", sortOrder: 0 },
    ];
    const result = transformCompositionToUI(snapshots);
    expect(result[0].max).toBe(18.75); // 12.5 * 1.5
  });
});

describe("Monthly Metrics Transform to UI", () => {
  it("transforms metrics to UI items", () => {
    const metrics: MonthlyMetric[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Январь", milkVolumeLiters: 120, proteinPercentTenth: 32, fatPercentTenth: 45, sortOrder: 0 },
      { id: 2, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Февраль", milkVolumeLiters: 110, proteinPercentTenth: 30, fatPercentTenth: 42, sortOrder: 1 },
    ];
    const result = transformMetricsToUI(metrics);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ month: "Январь", liters: 120 });
    expect(result[1]).toEqual({ month: "Февраль", liters: 110 });
  });

  it("handles empty array", () => {
    const result = transformMetricsToUI([]);
    expect(result).toHaveLength(0);
  });
});

describe("Annual Volume Calculation", () => {
  it("sums all monthly volumes", () => {
    const metrics: MonthlyMetric[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Январь", milkVolumeLiters: 120, proteinPercentTenth: 32, fatPercentTenth: 45, sortOrder: 0 },
      { id: 2, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Февраль", milkVolumeLiters: 110, proteinPercentTenth: 30, fatPercentTenth: 42, sortOrder: 1 },
      { id: 3, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Март", milkVolumeLiters: 130, proteinPercentTenth: 31, fatPercentTenth: 44, sortOrder: 2 },
    ];
    expect(calculateAnnualVolume(metrics)).toBe(360);
  });

  it("returns 0 for empty array", () => {
    expect(calculateAnnualVolume([])).toBe(0);
  });

  it("handles single month", () => {
    const metrics: MonthlyMetric[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Январь", milkVolumeLiters: 150, proteinPercentTenth: 32, fatPercentTenth: 45, sortOrder: 0 },
    ];
    expect(calculateAnnualVolume(metrics)).toBe(150);
  });

  it("handles zero-volume months", () => {
    const metrics: MonthlyMetric[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Январь", milkVolumeLiters: 120, proteinPercentTenth: 32, fatPercentTenth: 45, sortOrder: 0 },
      { id: 2, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Декабрь", milkVolumeLiters: 0, proteinPercentTenth: 0, fatPercentTenth: 0, sortOrder: 11 },
    ];
    expect(calculateAnnualVolume(metrics)).toBe(120);
  });
});

describe("Average Calculations", () => {
  it("calculates average protein and fat", () => {
    const metrics: MonthlyMetric[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Январь", milkVolumeLiters: 120, proteinPercentTenth: 30, fatPercentTenth: 40, sortOrder: 0 },
      { id: 2, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Февраль", milkVolumeLiters: 110, proteinPercentTenth: 34, fatPercentTenth: 50, sortOrder: 1 },
    ];
    const { avgProtein, avgFat } = calculateAverages(metrics);
    expect(avgProtein).toBe(3.2); // (30 + 34) / 2 / 10
    expect(avgFat).toBe(4.5); // (40 + 50) / 2 / 10
  });

  it("returns 0 for empty array", () => {
    const { avgProtein, avgFat } = calculateAverages([]);
    expect(avgProtein).toBe(0);
    expect(avgFat).toBe(0);
  });

  it("handles single metric", () => {
    const metrics: MonthlyMetric[] = [
      { id: 1, animalSlug: "mira", ownerOpenId: "owner1", monthLabel: "Март", milkVolumeLiters: 130, proteinPercentTenth: 35, fatPercentTenth: 48, sortOrder: 0 },
    ];
    const { avgProtein, avgFat } = calculateAverages(metrics);
    expect(avgProtein).toBe(3.5);
    expect(avgFat).toBe(4.8);
  });
});

describe("Data Structure Integrity", () => {
  it("composition snapshot has all required fields", () => {
    const snapshot: CompositionSnapshot = {
      id: 1,
      animalSlug: "mira",
      ownerOpenId: "owner-123",
      label: "Жирность",
      value: "4.2%",
      note: "процент",
      sortOrder: 0,
    };
    expect(snapshot.id).toBeGreaterThan(0);
    expect(snapshot.animalSlug).toBeTruthy();
    expect(snapshot.ownerOpenId).toBeTruthy();
    expect(snapshot.label).toBeTruthy();
    expect(snapshot.value).toBeTruthy();
    expect(typeof snapshot.sortOrder).toBe("number");
  });

  it("monthly metric has all required fields", () => {
    const metric: MonthlyMetric = {
      id: 1,
      animalSlug: "mira",
      ownerOpenId: "owner-123",
      monthLabel: "Январь",
      milkVolumeLiters: 120,
      proteinPercentTenth: 32,
      fatPercentTenth: 45,
      sortOrder: 0,
    };
    expect(metric.id).toBeGreaterThan(0);
    expect(metric.animalSlug).toBeTruthy();
    expect(metric.monthLabel).toBeTruthy();
    expect(metric.milkVolumeLiters).toBeGreaterThanOrEqual(0);
    expect(metric.proteinPercentTenth).toBeGreaterThanOrEqual(0);
    expect(metric.fatPercentTenth).toBeGreaterThanOrEqual(0);
  });

  it("composition data is per-animal not per-owner", () => {
    // Two snapshots for the same animal but different owners should be treated as same dataset
    const snapshot1: CompositionSnapshot = {
      id: 1, animalSlug: "mira", ownerOpenId: "owner-a", label: "Жирность", value: "4.2%", note: "%", sortOrder: 0,
    };
    const snapshot2: CompositionSnapshot = {
      id: 2, animalSlug: "mira", ownerOpenId: "owner-b", label: "Белок", value: "3.1%", note: "%", sortOrder: 1,
    };
    // Both belong to the same animal
    expect(snapshot1.animalSlug).toBe(snapshot2.animalSlug);
    // The key grouping field is animalSlug, not ownerOpenId
    expect(snapshot1.animalSlug).toBe("mira");
  });

  it("monthly metrics data is per-animal not per-owner", () => {
    const metric1: MonthlyMetric = {
      id: 1, animalSlug: "rufa", ownerOpenId: "owner-a", monthLabel: "Январь", milkVolumeLiters: 120, proteinPercentTenth: 32, fatPercentTenth: 45, sortOrder: 0,
    };
    const metric2: MonthlyMetric = {
      id: 2, animalSlug: "rufa", ownerOpenId: "owner-b", monthLabel: "Февраль", milkVolumeLiters: 110, proteinPercentTenth: 30, fatPercentTenth: 42, sortOrder: 1,
    };
    expect(metric1.animalSlug).toBe(metric2.animalSlug);
    expect(metric1.animalSlug).toBe("rufa");
  });
});

describe("transformApiToSummary — Composition & Metrics Mapping", () => {
  /** Mirrors the transformApiToSummary function from ProductTracker.tsx */
  function transformApiToSummary(raw: any) {
    if (!raw) return undefined;
    if (raw.headline && raw.stats && raw.composition) return raw;

    const batches = raw.productBatches ?? [];
    const snapshots = raw.compositionSnapshots ?? [];
    const metrics = raw.monthlyMetrics ?? [];
    const rawDeliveries = raw.deliveries ?? [];
    const animal = raw.currentAnimal;
    const animalName = animal?.name ?? "вашего животного";
    const totalLiters = metrics.reduce((s: number, m: any) => s + (m.milkVolumeLiters ?? 0), 0);

    const composition = snapshots.map((s: any) => {
      const numVal = parseFloat(s.value) || 0;
      return { label: s.label ?? "—", value: numVal, max: Math.max(numVal * 1.5, 10), unit: s.note ?? "" };
    });

    const monthlyData = metrics.map((m: any) => ({
      month: m.monthLabel ?? "—",
      liters: m.milkVolumeLiters ?? 0,
    }));

    return { composition, monthlyData, totalLiters, animalName };
  }

  it("maps composition snapshots to UI items", () => {
    const raw = {
      productBatches: [],
      compositionSnapshots: [
        { label: "Жирность", value: "4.2", note: "%" },
        { label: "Белок", value: "3.1", note: "%" },
      ],
      monthlyMetrics: [],
      deliveries: [],
      currentAnimal: { name: "Мира", slug: "mira" },
    };
    const result = transformApiToSummary(raw);
    expect(result?.composition).toHaveLength(2);
    expect(result?.composition[0].label).toBe("Жирность");
    expect(result?.composition[0].value).toBe(4.2);
    expect(result?.composition[1].label).toBe("Белок");
    expect(result?.composition[1].value).toBe(3.1);
  });

  it("maps monthly metrics to UI items", () => {
    const raw = {
      productBatches: [],
      compositionSnapshots: [],
      monthlyMetrics: [
        { monthLabel: "Январь", milkVolumeLiters: 120 },
        { monthLabel: "Февраль", milkVolumeLiters: 110 },
      ],
      deliveries: [],
      currentAnimal: { name: "Руфа", slug: "rufa" },
    };
    const result = transformApiToSummary(raw);
    expect(result?.monthlyData).toHaveLength(2);
    expect(result?.monthlyData[0]).toEqual({ month: "Январь", liters: 120 });
    expect(result?.totalLiters).toBe(230);
  });

  it("handles empty composition and metrics", () => {
    const raw = {
      productBatches: [],
      compositionSnapshots: [],
      monthlyMetrics: [],
      deliveries: [],
      currentAnimal: { name: "Злата", slug: "zlata" },
    };
    const result = transformApiToSummary(raw);
    expect(result?.composition).toHaveLength(0);
    expect(result?.monthlyData).toHaveLength(0);
    expect(result?.totalLiters).toBe(0);
  });

  it("handles null/undefined raw data", () => {
    expect(transformApiToSummary(null)).toBeUndefined();
    expect(transformApiToSummary(undefined)).toBeUndefined();
  });

  it("handles missing compositionSnapshots field", () => {
    const raw = {
      productBatches: [],
      monthlyMetrics: [{ monthLabel: "Март", milkVolumeLiters: 130 }],
      deliveries: [],
      currentAnimal: null,
    };
    const result = transformApiToSummary(raw);
    expect(result?.composition).toHaveLength(0);
    expect(result?.monthlyData).toHaveLength(1);
  });

  it("handles non-numeric composition values", () => {
    const raw = {
      productBatches: [],
      compositionSnapshots: [{ label: "Цвет", value: "белый", note: "" }],
      monthlyMetrics: [],
      deliveries: [],
      currentAnimal: null,
    };
    const result = transformApiToSummary(raw);
    expect(result?.composition[0].value).toBe(0);
  });

  it("uses animal name in output", () => {
    const raw = {
      productBatches: [],
      compositionSnapshots: [],
      monthlyMetrics: [],
      deliveries: [],
      currentAnimal: { name: "Мира", slug: "mira" },
    };
    const result = transformApiToSummary(raw);
    expect(result?.animalName).toBe("Мира");
  });

  it("uses fallback animal name when no animal", () => {
    const raw = {
      productBatches: [],
      compositionSnapshots: [],
      monthlyMetrics: [],
      deliveries: [],
      currentAnimal: null,
    };
    const result = transformApiToSummary(raw);
    expect(result?.animalName).toBe("вашего животного");
  });
});

describe("Month Labels", () => {
  it("has exactly 12 months", () => {
    expect(MONTH_LABELS).toHaveLength(12);
  });

  it("starts with Январь and ends with Декабрь", () => {
    expect(MONTH_LABELS[0]).toBe("Январь");
    expect(MONTH_LABELS[11]).toBe("Декабрь");
  });

  it("all months are non-empty strings", () => {
    for (const month of MONTH_LABELS) {
      expect(month.length).toBeGreaterThan(0);
    }
  });
});
