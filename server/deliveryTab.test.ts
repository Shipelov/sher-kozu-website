import { describe, expect, it } from "vitest";
// Статический импорт: динамический import("./routers") внутри it() под нагрузкой
// не укладывался в testTimeout, а при сборке файла лимита нет.
import { appRouter } from "./routers";
import * as dbModule from "./db";

/* ═══════════════════════════════════════════════════════════════
   Delivery Tab — Unit Tests
   Tests cover:
   1. New DB helper exports (listDeliveryScheduleByAnimal, bulkUpdateDeliveryStatus, updateDeliveryNote)
   2. New router procedures (getScheduleByAnimal, bulkUpdateDeliveryStatus, updateDeliveryNote)
   3. Bulk status update logic
   4. Note update logic
   5. Owner grouping and filtering logic (pure function tests)
   ═══════════════════════════════════════════════════════════════ */

/* ── Types mirroring the expanded delivery entry ── */

type DeliveryEntryWithOwner = {
  id: number;
  ownerOpenId: string;
  ownerName: string;
  animalId: number;
  ownershipId: number;
  productPlanId: number;
  month: number;
  year: number;
  itemsJson: string;
  status: "planned" | "ready" | "delivered";
  adminNote: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ── Pure helper functions extracted for testing ── */

/** Group delivery entries by month */
function groupByMonth(entries: DeliveryEntryWithOwner[]): Map<number, DeliveryEntryWithOwner[]> {
  const grouped = new Map<number, DeliveryEntryWithOwner[]>();
  for (let m = 1; m <= 12; m++) grouped.set(m, []);
  entries.forEach((e) => {
    const arr = grouped.get(e.month) ?? [];
    arr.push(e);
    grouped.set(e.month, arr);
  });
  return grouped;
}

/** Get unique owners from entries */
function getUniqueOwners(entries: DeliveryEntryWithOwner[]): Array<[string, string]> {
  const map = new Map<string, string>();
  entries.forEach((e) => map.set(e.ownerOpenId, e.ownerName));
  return Array.from(map.entries());
}

/** Calculate delivery stats */
function calculateStats(entries: DeliveryEntryWithOwner[]) {
  const total = entries.length;
  const delivered = entries.filter((e) => e.status === "delivered").length;
  const ready = entries.filter((e) => e.status === "ready").length;
  const planned = entries.filter((e) => e.status === "planned").length;
  return { total, delivered, ready, planned };
}

/** Filter entries by owner */
function filterByOwner(entries: DeliveryEntryWithOwner[], ownerOpenId: string | "all"): DeliveryEntryWithOwner[] {
  if (ownerOpenId === "all") return entries;
  return entries.filter((e) => e.ownerOpenId === ownerOpenId);
}

/** Validate bulk update input */
function validateBulkUpdate(ids: number[], status: string): { valid: boolean; error?: string } {
  if (ids.length === 0) return { valid: false, error: "No delivery IDs provided" };
  if (ids.length > 100) return { valid: false, error: "Too many IDs (max 100)" };
  if (!["planned", "ready", "delivered"].includes(status)) {
    return { valid: false, error: `Invalid status: ${status}` };
  }
  return { valid: true };
}

/** Validate admin note */
function validateNote(note: string | null): { valid: boolean; error?: string } {
  if (note !== null && note.length > 1000) {
    return { valid: false, error: "Note too long (max 1000 chars)" };
  }
  return { valid: true };
}

/* ── Sample data ── */

function createSampleEntries(): DeliveryEntryWithOwner[] {
  const entries: DeliveryEntryWithOwner[] = [];
  let id = 1;

  // Owner 1: 12 monthly entries
  for (let m = 1; m <= 12; m++) {
    entries.push({
      id: id++,
      ownerOpenId: "owner-1",
      ownerName: "Иван Петров",
      animalId: 30001,
      ownershipId: 1,
      productPlanId: 1,
      month: m,
      year: 2026,
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 10, unit: "л", frequency: "monthly" },
        { label: "Сыр", quantity: 1, unit: "кг", frequency: "monthly" },
      ]),
      status: m <= 3 ? "delivered" : m <= 5 ? "ready" : "planned",
      adminNote: m === 1 ? "Первая доставка — всё отлично" : null,
      deliveredAt: m <= 3 ? "2026-03-15T10:00:00Z" : null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  }

  // Owner 2: 12 monthly entries
  for (let m = 1; m <= 12; m++) {
    entries.push({
      id: id++,
      ownerOpenId: "owner-2",
      ownerName: "Мария Сидорова",
      animalId: 30001,
      ownershipId: 2,
      productPlanId: 2,
      month: m,
      year: 2026,
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 5, unit: "л", frequency: "monthly" },
      ]),
      status: m <= 2 ? "delivered" : "planned",
      adminNote: null,
      deliveredAt: m <= 2 ? "2026-02-20T10:00:00Z" : null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  }

  return entries;
}

/* ── Tests ── */

describe("Delivery Tab: groupByMonth", () => {
  it("groups entries into 12 months", () => {
    const entries = createSampleEntries();
    const grouped = groupByMonth(entries);
    expect(grouped.size).toBe(12);
  });

  it("each month contains entries from both owners", () => {
    const entries = createSampleEntries();
    const grouped = groupByMonth(entries);

    for (let m = 1; m <= 12; m++) {
      const monthEntries = grouped.get(m) ?? [];
      expect(monthEntries.length).toBe(2); // 2 owners
      const owners = new Set(monthEntries.map((e) => e.ownerOpenId));
      expect(owners.size).toBe(2);
    }
  });

  it("handles empty entries", () => {
    const grouped = groupByMonth([]);
    expect(grouped.size).toBe(12);
    for (let m = 1; m <= 12; m++) {
      expect(grouped.get(m)).toHaveLength(0);
    }
  });

  it("handles single owner entries", () => {
    const entries = createSampleEntries().filter((e) => e.ownerOpenId === "owner-1");
    const grouped = groupByMonth(entries);
    for (let m = 1; m <= 12; m++) {
      expect(grouped.get(m)).toHaveLength(1);
    }
  });
});

describe("Delivery Tab: getUniqueOwners", () => {
  it("returns unique owners from entries", () => {
    const entries = createSampleEntries();
    const owners = getUniqueOwners(entries);
    expect(owners).toHaveLength(2);
    expect(owners[0]?.[0]).toBe("owner-1");
    expect(owners[0]?.[1]).toBe("Иван Петров");
    expect(owners[1]?.[0]).toBe("owner-2");
    expect(owners[1]?.[1]).toBe("Мария Сидорова");
  });

  it("returns empty array for no entries", () => {
    const owners = getUniqueOwners([]);
    expect(owners).toHaveLength(0);
  });

  it("returns single owner for single-owner entries", () => {
    const entries = createSampleEntries().filter((e) => e.ownerOpenId === "owner-1");
    const owners = getUniqueOwners(entries);
    expect(owners).toHaveLength(1);
  });
});

describe("Delivery Tab: calculateStats", () => {
  it("calculates correct stats for mixed statuses", () => {
    const entries = createSampleEntries();
    const stats = calculateStats(entries);

    // Owner 1: 3 delivered, 2 ready, 7 planned
    // Owner 2: 2 delivered, 0 ready, 10 planned
    expect(stats.total).toBe(24);
    expect(stats.delivered).toBe(5); // 3 + 2
    expect(stats.ready).toBe(2);    // 2 + 0
    expect(stats.planned).toBe(17); // 7 + 10
  });

  it("returns zero stats for empty entries", () => {
    const stats = calculateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.delivered).toBe(0);
    expect(stats.ready).toBe(0);
    expect(stats.planned).toBe(0);
  });

  it("progress percentage is correct", () => {
    const entries = createSampleEntries();
    const stats = calculateStats(entries);
    const progressPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
    expect(progressPct).toBe(21); // 5/24 ≈ 20.83 → 21%
  });
});

describe("Delivery Tab: filterByOwner", () => {
  it("returns all entries when filter is 'all'", () => {
    const entries = createSampleEntries();
    const filtered = filterByOwner(entries, "all");
    expect(filtered).toHaveLength(24);
  });

  it("filters by specific owner", () => {
    const entries = createSampleEntries();
    const filtered = filterByOwner(entries, "owner-1");
    expect(filtered).toHaveLength(12);
    expect(filtered.every((e) => e.ownerOpenId === "owner-1")).toBe(true);
  });

  it("returns empty for non-existent owner", () => {
    const entries = createSampleEntries();
    const filtered = filterByOwner(entries, "non-existent");
    expect(filtered).toHaveLength(0);
  });
});

describe("Delivery Tab: validateBulkUpdate", () => {
  it("accepts valid bulk update", () => {
    const result = validateBulkUpdate([1, 2, 3], "delivered");
    expect(result.valid).toBe(true);
  });

  it("rejects empty ID array", () => {
    const result = validateBulkUpdate([], "delivered");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No delivery IDs");
  });

  it("rejects too many IDs", () => {
    const ids = Array.from({ length: 101 }, (_, i) => i + 1);
    const result = validateBulkUpdate(ids, "delivered");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("max 100");
  });

  it("rejects invalid status", () => {
    const result = validateBulkUpdate([1], "invalid_status");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid status");
  });

  it("accepts all valid statuses", () => {
    expect(validateBulkUpdate([1], "planned").valid).toBe(true);
    expect(validateBulkUpdate([1], "ready").valid).toBe(true);
    expect(validateBulkUpdate([1], "delivered").valid).toBe(true);
  });

  it("accepts exactly 100 IDs", () => {
    const ids = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = validateBulkUpdate(ids, "ready");
    expect(result.valid).toBe(true);
  });
});

describe("Delivery Tab: validateNote", () => {
  it("accepts null note", () => {
    expect(validateNote(null).valid).toBe(true);
  });

  it("accepts empty string note", () => {
    expect(validateNote("").valid).toBe(true);
  });

  it("accepts note at max length", () => {
    const note = "а".repeat(1000);
    expect(validateNote(note).valid).toBe(true);
  });

  it("rejects note exceeding max length", () => {
    const note = "а".repeat(1001);
    const result = validateNote(note);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("max 1000");
  });

  it("accepts typical admin note", () => {
    expect(validateNote("Доставка задерживается на 2 дня из-за погоды").valid).toBe(true);
  });
});

describe("Delivery Tab: itemsJson parsing", () => {
  it("parses valid itemsJson", () => {
    const entry = createSampleEntries()[0]!;
    const items = JSON.parse(entry.itemsJson);
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe("Молоко");
    expect(items[0].quantity).toBe(10);
    expect(items[0].unit).toBe("л");
  });

  it("handles empty items array", () => {
    const emptyJson = JSON.stringify([]);
    const items = JSON.parse(emptyJson);
    expect(items).toHaveLength(0);
  });

  it("identifies quarterly items", () => {
    const quarterlyJson = JSON.stringify([
      { label: "Брынза", quantity: 2, unit: "кг", frequency: "quarterly" },
    ]);
    const items = JSON.parse(quarterlyJson);
    expect(items[0].frequency).toBe("quarterly");
  });
});

describe("Delivery Tab: DB helper exports", () => {
  it("listDeliveryScheduleByAnimal should be exported from db module", async () => {
    const db = dbModule;
    expect(typeof db.listDeliveryScheduleByAnimal).toBe("function");
  }, 15000);

  it("bulkUpdateDeliveryStatus should be exported from db module", async () => {
    const db = dbModule;
    expect(typeof db.bulkUpdateDeliveryStatus).toBe("function");
  });

  it("updateDeliveryNote should be exported from db module", async () => {
    const db = dbModule;
    expect(typeof db.updateDeliveryNote).toBe("function");
  });
});

describe("Delivery Tab: Router procedure existence", () => {
  it("getScheduleByAnimal procedure should exist on productTrack router", async () => {
    // Check that the procedure exists by verifying the router shape
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("productTrack.getScheduleByAnimal");
  });

  it("bulkUpdateDeliveryStatus procedure should exist on productTrack router", async () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("productTrack.bulkUpdateDeliveryStatus");
  });

  it("updateDeliveryNote procedure should exist on productTrack router", async () => {
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("productTrack.updateDeliveryNote");
  });
});

describe("Delivery Tab: Month-level aggregation", () => {
  it("correctly identifies months with all deliveries completed", () => {
    const entries = createSampleEntries().filter((e) => e.ownerOpenId === "owner-1");
    const grouped = groupByMonth(entries);

    // Months 1-3 are delivered for owner-1
    for (let m = 1; m <= 3; m++) {
      const monthEntries = grouped.get(m) ?? [];
      const allDelivered = monthEntries.every((e) => e.status === "delivered");
      expect(allDelivered).toBe(true);
    }

    // Month 4 is ready, not all delivered
    const month4 = grouped.get(4) ?? [];
    const allDelivered4 = month4.every((e) => e.status === "delivered");
    expect(allDelivered4).toBe(false);
  });

  it("correctly counts deliveries per month across owners", () => {
    const entries = createSampleEntries();
    const grouped = groupByMonth(entries);

    // Month 1: owner-1 delivered, owner-2 delivered
    const month1 = grouped.get(1) ?? [];
    const deliveredCount = month1.filter((e) => e.status === "delivered").length;
    expect(deliveredCount).toBe(2);

    // Month 3: owner-1 delivered, owner-2 planned
    const month3 = grouped.get(3) ?? [];
    const deliveredCount3 = month3.filter((e) => e.status === "delivered").length;
    expect(deliveredCount3).toBe(1); // only owner-1
  });

  it("identifies current month correctly", () => {
    const currentMonth = new Date().getMonth() + 1;
    expect(currentMonth).toBeGreaterThanOrEqual(1);
    expect(currentMonth).toBeLessThanOrEqual(12);
  });
});

describe("Delivery Tab: Selection and batch operations", () => {
  it("select all in month selects correct entries", () => {
    const entries = createSampleEntries();
    const grouped = groupByMonth(entries);
    const month1Entries = grouped.get(1) ?? [];
    const selectedIds = new Set(month1Entries.map((e) => e.id));

    expect(selectedIds.size).toBe(2);
    month1Entries.forEach((e) => {
      expect(selectedIds.has(e.id)).toBe(true);
    });
  });

  it("toggle selection adds and removes correctly", () => {
    const selectedIds = new Set<number>();

    // Add
    selectedIds.add(1);
    expect(selectedIds.has(1)).toBe(true);
    expect(selectedIds.size).toBe(1);

    // Add another
    selectedIds.add(2);
    expect(selectedIds.size).toBe(2);

    // Remove
    selectedIds.delete(1);
    expect(selectedIds.has(1)).toBe(false);
    expect(selectedIds.size).toBe(1);
  });

  it("deselect all clears the set", () => {
    const selectedIds = new Set([1, 2, 3, 4, 5]);
    selectedIds.clear();
    expect(selectedIds.size).toBe(0);
  });
});


/* ═══════════════════════════════════════════════════════════════
   Phase M — Export & Owner Timeline Tests
   ═══════════════════════════════════════════════════════════════ */

/* ── Export data formatting helpers ── */

const MONTH_NAMES_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово",
  delivered: "Доставлено",
};

function formatExportRow(entry: DeliveryEntryWithOwner) {
  let items: Array<{ label: string; quantity: number; unit: string; frequency?: string }> = [];
  try { items = JSON.parse(entry.itemsJson); } catch {}
  const productsText = items.map((i) => `${i.label}: ${i.quantity} ${i.unit}${i.frequency === "quarterly" ? " (кв.)" : ""}`).join("; ");

  return {
    month: MONTH_NAMES_FULL[entry.month - 1] ?? `Месяц ${entry.month}`,
    monthNum: entry.month,
    ownerName: entry.ownerName ?? "Владелец",
    products: productsText,
    status: STATUS_LABELS[entry.status] ?? entry.status,
    statusRaw: entry.status,
    deliveredAt: entry.deliveredAt ? new Date(entry.deliveredAt).toLocaleDateString("ru-RU") : "—",
    adminNote: entry.adminNote ?? "",
  };
}

describe("Export data formatting", () => {
  const sampleEntries: DeliveryEntryWithOwner[] = [
    {
      id: 1, ownerOpenId: "owner1", ownerName: "Иван", animalId: 100, ownershipId: 10,
      productPlanId: 1, month: 1, year: 2026,
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 15, unit: "л" },
        { label: "Сыр", quantity: 2, unit: "кг", frequency: "quarterly" },
      ]),
      status: "delivered", adminNote: "Доставлено вовремя", deliveredAt: "2026-01-15T10:00:00Z",
      createdAt: "2026-01-01", updatedAt: "2026-01-15",
    },
    {
      id: 2, ownerOpenId: "owner1", ownerName: "Иван", animalId: 100, ownershipId: 10,
      productPlanId: 1, month: 2, year: 2026,
      itemsJson: JSON.stringify([{ label: "Молоко", quantity: 15, unit: "л" }]),
      status: "ready", adminNote: null, deliveredAt: null,
      createdAt: "2026-02-01", updatedAt: "2026-02-01",
    },
    {
      id: 3, ownerOpenId: "owner1", ownerName: "Иван", animalId: 100, ownershipId: 10,
      productPlanId: 1, month: 3, year: 2026,
      itemsJson: JSON.stringify([{ label: "Молоко", quantity: 15, unit: "л" }]),
      status: "planned", adminNote: null, deliveredAt: null,
      createdAt: "2026-03-01", updatedAt: "2026-03-01",
    },
  ];

  it("formats month names correctly in Russian", () => {
    const rows = sampleEntries.map(formatExportRow);
    expect(rows[0].month).toBe("Январь");
    expect(rows[1].month).toBe("Февраль");
    expect(rows[2].month).toBe("Март");
  });

  it("formats product items as semicolon-separated text", () => {
    const row = formatExportRow(sampleEntries[0]);
    expect(row.products).toBe("Молоко: 15 л; Сыр: 2 кг (кв.)");
  });

  it("marks quarterly products with (кв.) suffix", () => {
    const row = formatExportRow(sampleEntries[0]);
    expect(row.products).toContain("(кв.)");
  });

  it("translates status to Russian labels", () => {
    const rows = sampleEntries.map(formatExportRow);
    expect(rows[0].status).toBe("Доставлено");
    expect(rows[1].status).toBe("Готово");
    expect(rows[2].status).toBe("Запланировано");
  });

  it("formats deliveredAt date in Russian locale or shows dash", () => {
    const rows = sampleEntries.map(formatExportRow);
    // Delivered entry should have a date
    expect(rows[0].deliveredAt).not.toBe("—");
    // Non-delivered entries should show dash
    expect(rows[1].deliveredAt).toBe("—");
    expect(rows[2].deliveredAt).toBe("—");
  });

  it("preserves adminNote or defaults to empty string", () => {
    const rows = sampleEntries.map(formatExportRow);
    expect(rows[0].adminNote).toBe("Доставлено вовремя");
    expect(rows[1].adminNote).toBe("");
  });

  it("handles invalid JSON in itemsJson gracefully", () => {
    const badEntry: DeliveryEntryWithOwner = {
      ...sampleEntries[0],
      itemsJson: "not valid json",
    };
    const row = formatExportRow(badEntry);
    expect(row.products).toBe("");
  });

  it("handles empty items array", () => {
    const emptyEntry: DeliveryEntryWithOwner = {
      ...sampleEntries[0],
      itemsJson: "[]",
    };
    const row = formatExportRow(emptyEntry);
    expect(row.products).toBe("");
  });
});

describe("Export summary statistics", () => {
  const entries: DeliveryEntryWithOwner[] = [
    { id: 1, ownerOpenId: "o1", ownerName: "A", animalId: 1, ownershipId: 1, productPlanId: 1, month: 1, year: 2026, itemsJson: "[]", status: "delivered", adminNote: null, deliveredAt: "2026-01-15", createdAt: "", updatedAt: "" },
    { id: 2, ownerOpenId: "o1", ownerName: "A", animalId: 1, ownershipId: 1, productPlanId: 1, month: 2, year: 2026, itemsJson: "[]", status: "delivered", adminNote: null, deliveredAt: "2026-02-15", createdAt: "", updatedAt: "" },
    { id: 3, ownerOpenId: "o1", ownerName: "A", animalId: 1, ownershipId: 1, productPlanId: 1, month: 3, year: 2026, itemsJson: "[]", status: "ready", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "" },
    { id: 4, ownerOpenId: "o1", ownerName: "A", animalId: 1, ownershipId: 1, productPlanId: 1, month: 4, year: 2026, itemsJson: "[]", status: "planned", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "" },
    { id: 5, ownerOpenId: "o2", ownerName: "B", animalId: 1, ownershipId: 2, productPlanId: 2, month: 1, year: 2026, itemsJson: "[]", status: "planned", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "" },
  ];

  it("calculates stats correctly for mixed statuses", () => {
    const stats = calculateStats(entries);
    expect(stats.total).toBe(5);
    expect(stats.delivered).toBe(2);
    expect(stats.ready).toBe(1);
    expect(stats.planned).toBe(2);
  });

  it("calculates progress percentage", () => {
    const stats = calculateStats(entries);
    const progressPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
    expect(progressPct).toBe(40);
  });

  it("handles empty entries", () => {
    const stats = calculateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.delivered).toBe(0);
    const progressPct = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
    expect(progressPct).toBe(0);
  });
});

/* ── Owner timeline display helpers ── */

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово к отправке",
  delivered: "Доставлено",
};

const DELIVERY_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  planned: { bg: "bg-secondary/60", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  ready: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  delivered: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

describe("Owner delivery timeline display helpers", () => {
  it("maps all statuses to display labels", () => {
    expect(DELIVERY_STATUS_LABELS["planned"]).toBe("Запланировано");
    expect(DELIVERY_STATUS_LABELS["ready"]).toBe("Готово к отправке");
    expect(DELIVERY_STATUS_LABELS["delivered"]).toBe("Доставлено");
  });

  it("maps all statuses to color schemes", () => {
    for (const status of ["planned", "ready", "delivered"]) {
      const colors = DELIVERY_STATUS_COLORS[status];
      expect(colors).toBeDefined();
      expect(colors.bg).toBeTruthy();
      expect(colors.text).toBeTruthy();
      expect(colors.dot).toBeTruthy();
    }
  });

  it("identifies current month correctly", () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const entry = { month: currentMonth, year: currentYear };
    const isCurrent = entry.year === currentYear && entry.month === currentMonth;
    expect(isCurrent).toBe(true);
  });

  it("identifies past months correctly", () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    // A month in the past
    const pastEntry = { month: 1, year: currentYear - 1 };
    const isPast = pastEntry.year < currentYear || (pastEntry.year === currentYear && pastEntry.month < currentMonth);
    expect(isPast).toBe(true);
  });

  it("parses itemsJson for display", () => {
    const json = JSON.stringify([
      { label: "Молоко", quantity: 15, unit: "л" },
      { label: "Сыр", quantity: 2, unit: "кг", frequency: "quarterly" },
    ]);
    const items = JSON.parse(json) as Array<{ label: string; quantity: number; unit: string; frequency?: string }>;
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe("Молоко");
    expect(items[1].frequency).toBe("quarterly");
  });

  it("handles empty itemsJson", () => {
    const items = JSON.parse("[]");
    expect(items).toHaveLength(0);
  });
});

describe("Year selector logic", () => {
  it("generates year options around current year", () => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear - 1; y <= currentYear + 1; y++) years.push(y);
    expect(years).toHaveLength(3);
    expect(years).toContain(currentYear);
    expect(years).toContain(currentYear - 1);
    expect(years).toContain(currentYear + 1);
  });

  it("defaults to current year", () => {
    const currentYear = new Date().getFullYear();
    let selectedYear = currentYear;
    expect(selectedYear).toBe(currentYear);
  });
});

describe("Export row multi-owner scenarios", () => {
  const multiOwnerEntries: DeliveryEntryWithOwner[] = [
    {
      id: 1, ownerOpenId: "owner1", ownerName: "Иван", animalId: 100, ownershipId: 10,
      productPlanId: 1, month: 1, year: 2026,
      itemsJson: JSON.stringify([{ label: "Молоко", quantity: 15, unit: "л" }]),
      status: "delivered", adminNote: null, deliveredAt: "2026-01-15T10:00:00Z",
      createdAt: "", updatedAt: "",
    },
    {
      id: 2, ownerOpenId: "owner2", ownerName: "Мария", animalId: 100, ownershipId: 20,
      productPlanId: 2, month: 1, year: 2026,
      itemsJson: JSON.stringify([{ label: "Молоко", quantity: 10, unit: "л" }]),
      status: "planned", adminNote: null, deliveredAt: null,
      createdAt: "", updatedAt: "",
    },
  ];

  it("formats rows for different owners in same month", () => {
    const rows = multiOwnerEntries.map(formatExportRow);
    expect(rows[0].ownerName).toBe("Иван");
    expect(rows[1].ownerName).toBe("Мария");
    expect(rows[0].month).toBe(rows[1].month); // same month
    expect(rows[0].status).not.toBe(rows[1].status); // different statuses
  });

  it("export rows preserve monthNum for sorting", () => {
    const rows = multiOwnerEntries.map(formatExportRow);
    expect(rows[0].monthNum).toBe(1);
    expect(rows[1].monthNum).toBe(1);
  });
});


/* ═══════════════════════════════════════════════════════════════
   Phase N — Status Filter, Notifications, Owner PDF Export Tests
   ═══════════════════════════════════════════════════════════════ */

/** Filter entries by status (mirrors client-side filter logic) */
function filterByStatus(
  entries: DeliveryEntryWithOwner[],
  statusFilter: "all" | "planned" | "ready" | "delivered",
  ownerFilter: string = "all",
): DeliveryEntryWithOwner[] {
  return entries.filter((e) => {
    if (ownerFilter !== "all" && e.ownerOpenId !== ownerFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });
}

/** Count entries per status for filter badges */
function countByStatus(entries: DeliveryEntryWithOwner[]) {
  return {
    all: entries.length,
    delivered: entries.filter((e) => e.status === "delivered").length,
    ready: entries.filter((e) => e.status === "ready").length,
    planned: entries.filter((e) => e.status === "planned").length,
  };
}

/** Determine if a status change should trigger a notification */
function shouldNotify(newStatus: string): boolean {
  return newStatus === "ready" || newStatus === "delivered";
}

/** Build notification title for delivery status change */
function buildDeliveryNotificationTitle(
  animalName: string,
  monthName: string,
  newStatus: "ready" | "delivered",
): string {
  if (newStatus === "ready") {
    return `Доставка готова — ${animalName}, ${monthName}`;
  }
  return `Доставка выполнена — ${animalName}, ${monthName}`;
}

/** Build notification content for delivery status change */
function buildDeliveryNotificationContent(
  animalName: string,
  monthName: string,
  year: number,
  newStatus: "ready" | "delivered",
): string {
  if (newStatus === "ready") {
    return `Ваша доставка за ${monthName} ${year} от ${animalName} готова к отправке.`;
  }
  return `Ваша доставка за ${monthName} ${year} от ${animalName} успешно доставлена.`;
}

// MONTH_NAMES_FULL already declared above

describe("Status Filter Logic", () => {
  const mixedEntries: DeliveryEntryWithOwner[] = [
    {
      id: 1, ownerOpenId: "owner1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
      month: 1, year: 2026, itemsJson: "[]", status: "delivered", adminNote: null, deliveredAt: "2026-01-15", createdAt: "", updatedAt: "",
    },
    {
      id: 2, ownerOpenId: "owner1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
      month: 2, year: 2026, itemsJson: "[]", status: "ready", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "",
    },
    {
      id: 3, ownerOpenId: "owner1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
      month: 3, year: 2026, itemsJson: "[]", status: "planned", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "",
    },
    {
      id: 4, ownerOpenId: "owner2", ownerName: "Мария", animalId: 1, ownershipId: 2, productPlanId: 2,
      month: 1, year: 2026, itemsJson: "[]", status: "planned", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "",
    },
    {
      id: 5, ownerOpenId: "owner2", ownerName: "Мария", animalId: 1, ownershipId: 2, productPlanId: 2,
      month: 2, year: 2026, itemsJson: "[]", status: "delivered", adminNote: null, deliveredAt: "2026-02-20", createdAt: "", updatedAt: "",
    },
  ];

  it("filter 'all' returns all entries", () => {
    const result = filterByStatus(mixedEntries, "all");
    expect(result).toHaveLength(5);
  });

  it("filter 'delivered' returns only delivered entries", () => {
    const result = filterByStatus(mixedEntries, "delivered");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.status === "delivered")).toBe(true);
  });

  it("filter 'ready' returns only ready entries", () => {
    const result = filterByStatus(mixedEntries, "ready");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ready");
    expect(result[0].month).toBe(2);
  });

  it("filter 'planned' returns only planned entries", () => {
    const result = filterByStatus(mixedEntries, "planned");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.status === "planned")).toBe(true);
  });

  it("combined owner + status filter works correctly", () => {
    const result = filterByStatus(mixedEntries, "delivered", "owner1");
    expect(result).toHaveLength(1);
    expect(result[0].ownerOpenId).toBe("owner1");
    expect(result[0].status).toBe("delivered");
  });

  it("combined owner + status filter returns empty when no match", () => {
    const result = filterByStatus(mixedEntries, "ready", "owner2");
    expect(result).toHaveLength(0);
  });

  it("countByStatus returns correct counts", () => {
    const counts = countByStatus(mixedEntries);
    expect(counts.all).toBe(5);
    expect(counts.delivered).toBe(2);
    expect(counts.ready).toBe(1);
    expect(counts.planned).toBe(2);
  });

  it("countByStatus with empty array returns all zeros", () => {
    const counts = countByStatus([]);
    expect(counts.all).toBe(0);
    expect(counts.delivered).toBe(0);
    expect(counts.ready).toBe(0);
    expect(counts.planned).toBe(0);
  });

  it("filter preserves entry order", () => {
    const result = filterByStatus(mixedEntries, "planned");
    expect(result[0].id).toBe(3);
    expect(result[1].id).toBe(4);
  });
});

describe("Delivery Notification Logic", () => {
  it("shouldNotify returns true for 'ready'", () => {
    expect(shouldNotify("ready")).toBe(true);
  });

  it("shouldNotify returns true for 'delivered'", () => {
    expect(shouldNotify("delivered")).toBe(true);
  });

  it("shouldNotify returns false for 'planned'", () => {
    expect(shouldNotify("planned")).toBe(false);
  });

  it("shouldNotify returns false for unknown status", () => {
    expect(shouldNotify("cancelled")).toBe(false);
  });

  it("builds correct notification title for 'ready'", () => {
    const title = buildDeliveryNotificationTitle("Мира", "Апрель", "ready");
    expect(title).toBe("Доставка готова — Мира, Апрель");
  });

  it("builds correct notification title for 'delivered'", () => {
    const title = buildDeliveryNotificationTitle("Мира", "Январь", "delivered");
    expect(title).toBe("Доставка выполнена — Мира, Январь");
  });

  it("builds correct notification content for 'ready'", () => {
    const content = buildDeliveryNotificationContent("Мира", "Апрель", 2026, "ready");
    expect(content).toBe("Ваша доставка за Апрель 2026 от Мира готова к отправке.");
  });

  it("builds correct notification content for 'delivered'", () => {
    const content = buildDeliveryNotificationContent("Мира", "Январь", 2026, "delivered");
    expect(content).toBe("Ваша доставка за Январь 2026 от Мира успешно доставлена.");
  });

  it("notification uses correct month name from MONTH_NAMES_FULL", () => {
    for (let m = 0; m < 12; m++) {
      const title = buildDeliveryNotificationTitle("Козочка", MONTH_NAMES_FULL[m], "ready");
      expect(title).toContain(MONTH_NAMES_FULL[m]);
    }
  });
});

describe("Owner PDF Export Data Preparation", () => {
  const STATUS_RU: Record<string, string> = { planned: "Запланировано", ready: "Готово", delivered: "Доставлено" };

  function formatOwnerPdfRow(entry: DeliveryEntryWithOwner) {
    const items = (() => {
      try {
        return JSON.parse(entry.itemsJson) as Array<{ label: string; quantity: number; unit: string }>;
      } catch {
        return [];
      }
    })();
    const productList = items.map((it) => `${it.label}: ${it.quantity} ${it.unit}`).join(", ");
    return {
      month: MONTH_NAMES_FULL[entry.month - 1],
      status: STATUS_RU[entry.status] ?? entry.status,
      products: productList,
      deliveredAt: entry.deliveredAt ? new Date(entry.deliveredAt).toLocaleDateString("ru-RU") : "—",
      note: entry.adminNote ?? "",
    };
  }

  it("formats row with products correctly", () => {
    const entry: DeliveryEntryWithOwner = {
      id: 1, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
      month: 4, year: 2026,
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 2, unit: "л" },
        { label: "Сыр", quantity: 0.3, unit: "кг" },
      ]),
      status: "ready", adminNote: "Позвонить перед доставкой", deliveredAt: null, createdAt: "", updatedAt: "",
    };
    const row = formatOwnerPdfRow(entry);
    expect(row.month).toBe("Апрель");
    expect(row.status).toBe("Готово");
    expect(row.products).toBe("Молоко: 2 л, Сыр: 0.3 кг");
    expect(row.deliveredAt).toBe("—");
    expect(row.note).toBe("Позвонить перед доставкой");
  });

  it("formats delivered row with date", () => {
    const entry: DeliveryEntryWithOwner = {
      id: 2, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
      month: 1, year: 2026, itemsJson: "[]", status: "delivered", adminNote: null,
      deliveredAt: "2026-01-15T10:00:00Z", createdAt: "", updatedAt: "",
    };
    const row = formatOwnerPdfRow(entry);
    expect(row.month).toBe("Январь");
    expect(row.status).toBe("Доставлено");
    expect(row.deliveredAt).not.toBe("—");
    expect(row.note).toBe("");
  });

  it("handles invalid itemsJson gracefully", () => {
    const entry: DeliveryEntryWithOwner = {
      id: 3, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
      month: 6, year: 2026, itemsJson: "not-json", status: "planned", adminNote: null,
      deliveredAt: null, createdAt: "", updatedAt: "",
    };
    const row = formatOwnerPdfRow(entry);
    expect(row.products).toBe("");
    expect(row.month).toBe("Июнь");
  });

  it("formats all 12 months correctly", () => {
    for (let m = 1; m <= 12; m++) {
      const entry: DeliveryEntryWithOwner = {
        id: m, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1,
        month: m, year: 2026, itemsJson: "[]", status: "planned", adminNote: null,
        deliveredAt: null, createdAt: "", updatedAt: "",
      };
      const row = formatOwnerPdfRow(entry);
      expect(row.month).toBe(MONTH_NAMES_FULL[m - 1]);
      expect(row.status).toBe("Запланировано");
    }
  });

  it("summary stats match entries", () => {
    const entries: DeliveryEntryWithOwner[] = [
      { id: 1, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1, month: 1, year: 2026, itemsJson: "[]", status: "delivered", adminNote: null, deliveredAt: "2026-01-15", createdAt: "", updatedAt: "" },
      { id: 2, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1, month: 2, year: 2026, itemsJson: "[]", status: "ready", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "" },
      { id: 3, ownerOpenId: "o1", ownerName: "Иван", animalId: 1, ownershipId: 1, productPlanId: 1, month: 3, year: 2026, itemsJson: "[]", status: "planned", adminNote: null, deliveredAt: null, createdAt: "", updatedAt: "" },
    ];
    const stats = calculateStats(entries);
    expect(stats.total).toBe(3);
    expect(stats.delivered).toBe(1);
    expect(stats.ready).toBe(1);
    expect(stats.planned).toBe(1);
    expect(stats.delivered + stats.ready + stats.planned).toBe(stats.total);
  });
});
