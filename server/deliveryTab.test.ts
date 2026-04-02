import { describe, expect, it } from "vitest";

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
    const db = await import("./db");
    expect(typeof db.listDeliveryScheduleByAnimal).toBe("function");
  });

  it("bulkUpdateDeliveryStatus should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.bulkUpdateDeliveryStatus).toBe("function");
  });

  it("updateDeliveryNote should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.updateDeliveryNote).toBe("function");
  });
});

describe("Delivery Tab: Router procedure existence", () => {
  it("getScheduleByAnimal procedure should exist on productTrack router", async () => {
    const { appRouter } = await import("./routers");
    // Check that the procedure exists by verifying the router shape
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("productTrack.getScheduleByAnimal");
  });

  it("bulkUpdateDeliveryStatus procedure should exist on productTrack router", async () => {
    const { appRouter } = await import("./routers");
    const procedures = Object.keys((appRouter as any)._def.procedures);
    expect(procedures).toContain("productTrack.bulkUpdateDeliveryStatus");
  });

  it("updateDeliveryNote procedure should exist on productTrack router", async () => {
    const { appRouter } = await import("./routers");
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
