/**
 * Server-side Excel (XLSX) generation for Delivery Tracker (owner & admin views).
 * Uses the `xlsx` package (SheetJS) for full .xlsx support with multiple sheets,
 * column widths, and styled headers.
 */
import XLSX from "xlsx";

/* ─── Types (mirror pdfDeliveryGenerator) ─── */
export interface OwnerDeliveryExcelData {
  year: number;
  animalName?: string;
  stats: { total: number; delivered: number; ready: number; planned: number };
  entries: Array<{
    month: number;
    status: string;
    itemsJson: string;
    deliveredAt: string | null;
    adminNote: string | null;
  }>;
}

export interface AdminDeliveryExcelData {
  animalName: string;
  year: number;
  stats: { total: number; delivered: number; ready: number; planned: number };
  rows: Array<{
    month: string;
    ownerName: string;
    products: string;
    status: string;
    deliveredAt: string;
    adminNote: string;
  }>;
}

/* ─── Constants ─── */
const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const STATUS_RU: Record<string, string> = {
  planned: "Запланировано",
  ready: "Готово",
  delivered: "Доставлено",
  cancelled: "Отменено",
};

/* ═══════════════════════════════════════════════
   Owner Delivery Excel
   ═══════════════════════════════════════════════ */
export function generateOwnerDeliveryExcel(
  data: OwnerDeliveryExcelData
): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ──
  const summaryData = [
    ["Шерь Козу — График доставок"],
    [],
    ["Год", data.year],
    ["Животное", data.animalName || "—"],
    [],
    ["Статистика"],
    ["Всего доставок", data.stats.total],
    ["Доставлено", data.stats.delivered],
    ["Готово к отправке", data.stats.ready],
    ["Запланировано", data.stats.planned],
    [],
    ["Прогресс (%)", data.stats.total > 0
      ? Math.round((data.stats.delivered / data.stats.total) * 100)
      : 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");

  // ── Sheet 2: Deliveries detail ──
  const headers = ["Месяц", "Статус", "Продукты", "Кол-во позиций", "Дата доставки", "Заметка"];
  const rows = data.entries.map((e) => {
    let productList = "";
    let itemCount = 0;
    try {
      const items = JSON.parse(e.itemsJson) as Array<{
        label: string;
        quantity: number;
        unit: string;
      }>;
      productList = items
        .map((it) => `${it.label}: ${it.quantity} ${it.unit}`)
        .join("; ");
      itemCount = items.length;
    } catch {
      productList = "";
    }

    return [
      MONTH_NAMES[e.month - 1] ?? `Месяц ${e.month}`,
      STATUS_RU[e.status] ?? e.status,
      productList,
      itemCount,
      e.deliveredAt
        ? new Date(e.deliveredAt).toLocaleDateString("ru-RU")
        : "—",
      e.adminNote ?? "",
    ];
  });

  const detailSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  detailSheet["!cols"] = [
    { wch: 14 },  // Месяц
    { wch: 16 },  // Статус
    { wch: 50 },  // Продукты
    { wch: 14 },  // Кол-во позиций
    { wch: 16 },  // Дата доставки
    { wch: 30 },  // Заметка
  ];
  XLSX.utils.book_append_sheet(wb, detailSheet, "Доставки");

  // ── Sheet 3: Products breakdown ──
  const productMap = new Map<string, { totalQty: number; unit: string; months: string[] }>();
  data.entries.forEach((e) => {
    try {
      const items = JSON.parse(e.itemsJson) as Array<{
        label: string;
        quantity: number;
        unit: string;
      }>;
      items.forEach((it) => {
        const existing = productMap.get(it.label);
        const monthName = MONTH_NAMES[e.month - 1] ?? `Месяц ${e.month}`;
        if (existing) {
          existing.totalQty += it.quantity;
          existing.months.push(monthName);
        } else {
          productMap.set(it.label, {
            totalQty: it.quantity,
            unit: it.unit,
            months: [monthName],
          });
        }
      });
    } catch { /* skip */ }
  });

  const productHeaders = ["Продукт", "Общее кол-во", "Ед. изм.", "Месяцы поставки"];
  const productRows = Array.from(productMap.entries()).map(([label, info]) => [
    label,
    info.totalQty,
    info.unit,
    info.months.join(", "),
  ]);

  if (productRows.length > 0) {
    const productSheet = XLSX.utils.aoa_to_sheet([productHeaders, ...productRows]);
    productSheet["!cols"] = [
      { wch: 25 },  // Продукт
      { wch: 14 },  // Общее кол-во
      { wch: 10 },  // Ед. изм.
      { wch: 50 },  // Месяцы поставки
    ];
    XLSX.utils.book_append_sheet(wb, productSheet, "Продукты");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

/* ═══════════════════════════════════════════════
   Admin Delivery Excel
   ═══════════════════════════════════════════════ */
export function generateAdminDeliveryExcel(
  data: AdminDeliveryExcelData
): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Summary ──
  const summaryData = [
    ["Шерь Козу — Управление доставками (Админ)"],
    [],
    ["Животное", data.animalName],
    ["Год", data.year],
    [],
    ["Статистика"],
    ["Всего доставок", data.stats.total],
    ["Доставлено", data.stats.delivered],
    ["Готово к отправке", data.stats.ready],
    ["Запланировано", data.stats.planned],
    [],
    ["Прогресс (%)", data.stats.total > 0
      ? Math.round((data.stats.delivered / data.stats.total) * 100)
      : 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Сводка");

  // ── Sheet 2: Deliveries detail ──
  const headers = ["Месяц", "Владелец", "Продукты", "Статус", "Дата доставки", "Заметка"];
  const rows = data.rows.map((r) => [
    r.month,
    r.ownerName,
    r.products,
    STATUS_RU[r.status] ?? r.status,
    r.deliveredAt || "—",
    r.adminNote || "",
  ]);

  const detailSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  detailSheet["!cols"] = [
    { wch: 14 },  // Месяц
    { wch: 22 },  // Владелец
    { wch: 50 },  // Продукты
    { wch: 18 },  // Статус
    { wch: 16 },  // Дата доставки
    { wch: 35 },  // Заметка
  ];
  XLSX.utils.book_append_sheet(wb, detailSheet, "Доставки");

  // ── Sheet 3: Status breakdown ──
  const statusCounts: Record<string, number> = {};
  data.rows.forEach((r) => {
    const label = STATUS_RU[r.status] ?? r.status;
    statusCounts[label] = (statusCounts[label] || 0) + 1;
  });

  const statusHeaders = ["Статус", "Количество", "Доля (%)"];
  const total = data.rows.length;
  const statusRows = Object.entries(statusCounts).map(([status, count]) => [
    status,
    count,
    total > 0 ? Math.round((count / total) * 100) : 0,
  ]);

  const statusSheet = XLSX.utils.aoa_to_sheet([statusHeaders, ...statusRows]);
  statusSheet["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, statusSheet, "По статусам");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}
