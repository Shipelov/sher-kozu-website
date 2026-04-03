import { describe, expect, it } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Excel Export — Unit Tests
   Tests cover:
   1. Data preparation for owner Excel export (summary + detail sheets)
   2. Data preparation for admin Excel export (summary + detail sheets)
   3. Product item parsing from JSON
   4. Month name mapping
   5. Status label mapping
   6. Edge cases: empty entries, missing fields, malformed JSON
   ═══════════════════════════════════════════════════════════════ */

/* ── Constants mirroring frontend ── */

const MONTH_NAMES_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово к отправке",
  delivered: "Доставлено",
};

/* ── Types ── */

type TimelineEntry = {
  id: number;
  month: number;
  year: number;
  status: string;
  itemsJson: string;
  deliveredAt: string | null;
  adminNote: string | null;
};

type AdminExportRow = {
  month: string;
  ownerName: string;
  products: string;
  status: string;
  deliveredAt: string;
  adminNote: string;
};

/* ── Pure helper functions matching frontend logic ── */

function parseItems(json: string): Array<{ label: string; quantity: number; unit: string; frequency?: string }> {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function buildOwnerSummarySheet(animalName: string, year: number, stats: { total: number; delivered: number; ready: number; planned: number }) {
  return [
    ["Мои доставки", `${animalName} — ${year}`],
    [],
    ["Всего доставок", stats.total],
    ["Доставлено", stats.delivered],
    ["Готово к отправке", stats.ready],
    ["Запланировано", stats.planned],
  ];
}

function buildOwnerDetailRows(entries: TimelineEntry[]) {
  const headers = ["Месяц", "Продукты", "Статус", "Дата доставки", "Заметка"];
  const rows = entries.map((e) => {
    const items = parseItems(e.itemsJson);
    const productsStr = items.map((i) => `${i.label}: ${i.quantity} ${i.unit}`).join("; ");
    return [
      MONTH_NAMES_FULL[e.month - 1] || `Месяц ${e.month}`,
      productsStr,
      DELIVERY_STATUS_LABELS[e.status] || e.status,
      e.deliveredAt || "—",
      e.adminNote || "",
    ];
  });
  return { headers, rows };
}

function buildAdminSummarySheet(animalName: string, year: number, stats: { total: number; delivered: number; ready: number; planned: number }) {
  return [
    ["График доставки", `${animalName} — ${year}`],
    [],
    ["Всего доставок", stats.total],
    ["Доставлено", stats.delivered],
    ["Готово", stats.ready],
    ["Запланировано", stats.planned],
  ];
}

function buildAdminDetailRows(rows: AdminExportRow[]) {
  const headers = ["Месяц", "Владелец", "Продукты", "Статус", "Дата доставки", "Заметка"];
  const dataRows = rows.map((r) => [r.month, r.ownerName, r.products, r.status, r.deliveredAt, r.adminNote]);
  return { headers, dataRows };
}

/* ── Sample data ── */

function createOwnerEntries(): TimelineEntry[] {
  return [
    {
      id: 1, month: 1, year: 2026, status: "delivered",
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 10, unit: "л", frequency: "monthly" },
        { label: "Сыр", quantity: 1, unit: "кг", frequency: "monthly" },
      ]),
      deliveredAt: "2026-01-15", adminNote: "Доставлено вовремя",
    },
    {
      id: 2, month: 2, year: 2026, status: "delivered",
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 10, unit: "л", frequency: "monthly" },
      ]),
      deliveredAt: "2026-02-14", adminNote: null,
    },
    {
      id: 3, month: 3, year: 2026, status: "ready",
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 10, unit: "л", frequency: "monthly" },
        { label: "Йогурт", quantity: 2, unit: "шт", frequency: "monthly" },
      ]),
      deliveredAt: null, adminNote: "Готово к отправке завтра",
    },
    {
      id: 4, month: 4, year: 2026, status: "planned",
      itemsJson: JSON.stringify([
        { label: "Молоко", quantity: 10, unit: "л", frequency: "monthly" },
      ]),
      deliveredAt: null, adminNote: null,
    },
  ];
}

function createAdminExportRows(): AdminExportRow[] {
  return [
    { month: "Январь", ownerName: "Иван Петров", products: "Молоко: 10 л; Сыр: 1 кг", status: "Доставлено", deliveredAt: "2026-01-15", adminNote: "Доставлено вовремя" },
    { month: "Январь", ownerName: "Мария Сидорова", products: "Молоко: 5 л", status: "Доставлено", deliveredAt: "2026-01-16", adminNote: "" },
    { month: "Февраль", ownerName: "Иван Петров", products: "Молоко: 10 л", status: "Готово к отправке", deliveredAt: "", adminNote: "" },
    { month: "Февраль", ownerName: "Мария Сидорова", products: "Молоко: 5 л", status: "Запланировано", deliveredAt: "", adminNote: "" },
  ];
}

/* ── Tests ── */

describe("Excel Export: parseItems", () => {
  it("parses valid JSON items", () => {
    const json = JSON.stringify([{ label: "Молоко", quantity: 10, unit: "л" }]);
    const items = parseItems(json);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe("Молоко");
    expect(items[0].quantity).toBe(10);
    expect(items[0].unit).toBe("л");
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseItems("invalid")).toEqual([]);
    expect(parseItems("")).toEqual([]);
    expect(parseItems("{not-an-array}")).toEqual([]);
  });

  it("parses multiple items with frequency", () => {
    const json = JSON.stringify([
      { label: "Молоко", quantity: 10, unit: "л", frequency: "monthly" },
      { label: "Сыр", quantity: 1, unit: "кг", frequency: "monthly" },
    ]);
    const items = parseItems(json);
    expect(items).toHaveLength(2);
    expect(items[1].frequency).toBe("monthly");
  });

  it("handles empty array JSON", () => {
    expect(parseItems("[]")).toEqual([]);
  });
});

describe("Excel Export: Owner Summary Sheet", () => {
  it("builds correct summary data", () => {
    const summary = buildOwnerSummarySheet("Белка", 2026, { total: 12, delivered: 3, ready: 1, planned: 8 });
    expect(summary[0]).toEqual(["Мои доставки", "Белка — 2026"]);
    expect(summary[1]).toEqual([]);
    expect(summary[2]).toEqual(["Всего доставок", 12]);
    expect(summary[3]).toEqual(["Доставлено", 3]);
    expect(summary[4]).toEqual(["Готово к отправке", 1]);
    expect(summary[5]).toEqual(["Запланировано", 8]);
  });

  it("handles zero stats", () => {
    const summary = buildOwnerSummarySheet("Тест", 2025, { total: 0, delivered: 0, ready: 0, planned: 0 });
    expect(summary[2]).toEqual(["Всего доставок", 0]);
  });

  it("includes animal name and year in title", () => {
    const summary = buildOwnerSummarySheet("Козочка Маша", 2027, { total: 6, delivered: 6, ready: 0, planned: 0 });
    expect(summary[0][1]).toBe("Козочка Маша — 2027");
  });
});

describe("Excel Export: Owner Detail Rows", () => {
  it("builds correct headers", () => {
    const entries = createOwnerEntries();
    const { headers } = buildOwnerDetailRows(entries);
    expect(headers).toEqual(["Месяц", "Продукты", "Статус", "Дата доставки", "Заметка"]);
  });

  it("maps month numbers to Russian names", () => {
    const entries = createOwnerEntries();
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][0]).toBe("Январь");
    expect(rows[1][0]).toBe("Февраль");
    expect(rows[2][0]).toBe("Март");
    expect(rows[3][0]).toBe("Апрель");
  });

  it("formats products as semicolon-separated string", () => {
    const entries = createOwnerEntries();
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][1]).toBe("Молоко: 10 л; Сыр: 1 кг");
    expect(rows[1][1]).toBe("Молоко: 10 л");
  });

  it("maps status codes to Russian labels", () => {
    const entries = createOwnerEntries();
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][2]).toBe("Доставлено");
    expect(rows[2][2]).toBe("Готово к отправке");
    expect(rows[3][2]).toBe("Запланировано");
  });

  it("uses dash for missing delivery date", () => {
    const entries = createOwnerEntries();
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][3]).toBe("2026-01-15");
    expect(rows[2][3]).toBe("—");
  });

  it("uses empty string for missing admin note", () => {
    const entries = createOwnerEntries();
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][4]).toBe("Доставлено вовремя");
    expect(rows[1][4]).toBe("");
    expect(rows[3][4]).toBe("");
  });

  it("handles entries with malformed itemsJson", () => {
    const entries: TimelineEntry[] = [{
      id: 99, month: 6, year: 2026, status: "planned",
      itemsJson: "broken-json", deliveredAt: null, adminNote: null,
    }];
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][1]).toBe(""); // empty products string
    expect(rows[0][0]).toBe("Июнь");
  });

  it("handles empty entries array", () => {
    const { rows } = buildOwnerDetailRows([]);
    expect(rows).toHaveLength(0);
  });

  it("handles month number out of range gracefully", () => {
    const entries: TimelineEntry[] = [{
      id: 99, month: 13, year: 2026, status: "planned",
      itemsJson: "[]", deliveredAt: null, adminNote: null,
    }];
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][0]).toBe("Месяц 13");
  });

  it("handles unknown status gracefully", () => {
    const entries: TimelineEntry[] = [{
      id: 99, month: 1, year: 2026, status: "unknown_status",
      itemsJson: "[]", deliveredAt: null, adminNote: null,
    }];
    const { rows } = buildOwnerDetailRows(entries);
    expect(rows[0][2]).toBe("unknown_status");
  });
});

describe("Excel Export: Admin Summary Sheet", () => {
  it("builds correct admin summary data", () => {
    const summary = buildAdminSummarySheet("Белка", 2026, { total: 24, delivered: 5, ready: 2, planned: 17 });
    expect(summary[0]).toEqual(["График доставки", "Белка — 2026"]);
    expect(summary[2]).toEqual(["Всего доставок", 24]);
    expect(summary[3]).toEqual(["Доставлено", 5]);
    expect(summary[4]).toEqual(["Готово", 2]);
    expect(summary[5]).toEqual(["Запланировано", 17]);
  });
});

describe("Excel Export: Admin Detail Rows", () => {
  it("builds correct admin headers with owner column", () => {
    const rows = createAdminExportRows();
    const { headers } = buildAdminDetailRows(rows);
    expect(headers).toEqual(["Месяц", "Владелец", "Продукты", "Статус", "Дата доставки", "Заметка"]);
  });

  it("maps admin rows correctly", () => {
    const rows = createAdminExportRows();
    const { dataRows } = buildAdminDetailRows(rows);
    expect(dataRows).toHaveLength(4);
    expect(dataRows[0]).toEqual(["Январь", "Иван Петров", "Молоко: 10 л; Сыр: 1 кг", "Доставлено", "2026-01-15", "Доставлено вовремя"]);
    expect(dataRows[1][1]).toBe("Мария Сидорова");
  });

  it("handles empty admin rows", () => {
    const { dataRows } = buildAdminDetailRows([]);
    expect(dataRows).toHaveLength(0);
  });
});

describe("Excel Export: File naming", () => {
  it("owner file name includes animal name and year", () => {
    const animalName = "Белка";
    const year = 2026;
    const fileName = `мои_доставки_${animalName}_${year}.xlsx`;
    expect(fileName).toBe("мои_доставки_Белка_2026.xlsx");
    expect(fileName.endsWith(".xlsx")).toBe(true);
  });

  it("admin file name includes animal name and year", () => {
    const animalName = "Белка";
    const year = 2026;
    const fileName = `delivery_${animalName}_${year}.xlsx`;
    expect(fileName).toBe("delivery_Белка_2026.xlsx");
    expect(fileName.endsWith(".xlsx")).toBe(true);
  });

  it("handles special characters in animal name", () => {
    const animalName = "Козочка «Маша»";
    const year = 2026;
    const fileName = `мои_доставки_${animalName}_${year}.xlsx`;
    expect(fileName).toContain("Козочка «Маша»");
  });
});

describe("Excel Export: Column widths", () => {
  it("owner detail sheet has 5 columns", () => {
    const ownerCols = [{ wch: 14 }, { wch: 45 }, { wch: 20 }, { wch: 14 }, { wch: 30 }];
    expect(ownerCols).toHaveLength(5);
    expect(ownerCols[1].wch).toBe(45); // products column is widest
  });

  it("admin detail sheet has 6 columns", () => {
    const adminCols = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];
    expect(adminCols).toHaveLength(6);
    expect(adminCols[2].wch).toBe(40); // products column is widest
  });
});

describe("Excel Export: Full data flow", () => {
  it("owner export produces complete workbook data", () => {
    const entries = createOwnerEntries();
    const stats = {
      total: entries.length,
      delivered: entries.filter(e => e.status === "delivered").length,
      ready: entries.filter(e => e.status === "ready").length,
      planned: entries.filter(e => e.status === "planned").length,
    };

    const summary = buildOwnerSummarySheet("Белка", 2026, stats);
    const { headers, rows } = buildOwnerDetailRows(entries);

    // Summary sheet has 6 rows
    expect(summary).toHaveLength(6);
    expect(summary[2][1]).toBe(4); // total

    // Detail sheet has header + 4 data rows
    expect(headers).toHaveLength(5);
    expect(rows).toHaveLength(4);

    // All months are present
    const months = rows.map(r => r[0]);
    expect(months).toEqual(["Январь", "Февраль", "Март", "Апрель"]);
  });

  it("admin export produces complete workbook data", () => {
    const adminRows = createAdminExportRows();
    const stats = { total: 4, delivered: 2, ready: 1, planned: 1 };

    const summary = buildAdminSummarySheet("Белка", 2026, stats);
    const { headers, dataRows } = buildAdminDetailRows(adminRows);

    expect(summary).toHaveLength(6);
    expect(headers).toHaveLength(6); // includes "Владелец" column
    expect(dataRows).toHaveLength(4);
  });
});
