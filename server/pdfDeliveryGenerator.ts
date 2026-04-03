/**
 * Server-side PDF generation for Delivery Tracker (owner & admin views).
 * Uses jsPDF with embedded Roboto fonts for full Cyrillic support.
 * Supports automatic multi-page layout via jspdf-autotable.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";

/* ─── Font paths (shared with calculator PDF) ─── */
const FONT_DIR = path.resolve(import.meta.dirname, "../fonts");

let fontsLoaded = false;
let regularB64 = "";
let boldB64 = "";

async function ensureFonts() {
  if (fontsLoaded) return;

  const regularPath = path.join(FONT_DIR, "Roboto-Regular.ttf");
  const boldPath = path.join(FONT_DIR, "Roboto-Bold.ttf");

  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    regularB64 = fs.readFileSync(regularPath).toString("base64");
    boldB64 = fs.readFileSync(boldPath).toString("base64");
  } else {
    const FONT_REGULAR_URL =
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/roboto-full-regular_dbd624b6.ttf";
    const FONT_BOLD_URL =
      "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/roboto-full-bold_64cc9e0c.ttf";

    const [regResp, boldResp] = await Promise.all([
      fetch(FONT_REGULAR_URL),
      fetch(FONT_BOLD_URL),
    ]);

    const regBuf = Buffer.from(await regResp.arrayBuffer());
    const boldBuf = Buffer.from(await boldResp.arrayBuffer());

    fs.mkdirSync(FONT_DIR, { recursive: true });
    fs.writeFileSync(regularPath, regBuf);
    fs.writeFileSync(boldPath, boldBuf);

    regularB64 = regBuf.toString("base64");
    boldB64 = boldBuf.toString("base64");
  }

  fontsLoaded = true;
}

/* ─── Types ─── */
export interface OwnerDeliveryPdfData {
  year: number;
  stats: { total: number; delivered: number; ready: number; planned: number };
  entries: Array<{
    month: number;
    status: string;
    itemsJson: string;
    deliveredAt: string | null;
    adminNote: string | null;
  }>;
}

export interface AdminDeliveryPdfData {
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

/* ─── Helpers ─── */
const GREEN: [number, number, number] = [46, 125, 50];
const DARK: [number, number, number] = [33, 33, 33];
const MUTED: [number, number, number] = [120, 120, 120];

const PAGE_HEIGHT = 297;

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

function setupDoc(doc: jsPDF) {
  doc.addFileToVFS("Roboto-Regular.ttf", regularB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", boldB64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
}

function addPageNumbers(doc: jsPDF, title: string) {
  const totalPages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${title}  •  стр. ${i} из ${totalPages}`,
      pageW / 2,
      PAGE_HEIGHT - 8,
      { align: "center" }
    );
  }
}

/* ═══════════════════════════════════════════════
   Owner Delivery PDF
   ═══════════════════════════════════════════════ */
export async function generateOwnerDeliveryPdf(
  data: OwnerDeliveryPdfData
): Promise<Buffer> {
  await ensureFonts();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupDoc(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Шерь Козу", margin, 16);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.text("Мой график доставок", margin, 24);

  // Title
  let y = 42;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(`График доставок — ${data.year}`, margin, y);
  y += 10;

  // Stats summary
  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    `Всего: ${data.stats.total}  |  Доставлено: ${data.stats.delivered}  |  Готово: ${data.stats.ready}  |  Запланировано: ${data.stats.planned}`,
    margin,
    y
  );
  y += 10;

  // Table
  const tableBody = data.entries.map((e) => {
    let productList = "";
    try {
      const items = JSON.parse(e.itemsJson) as Array<{
        label: string;
        quantity: number;
        unit: string;
      }>;
      productList = items
        .map((it) => `${it.label}: ${it.quantity} ${it.unit}`)
        .join(", ");
    } catch {
      productList = "";
    }

    return [
      MONTH_NAMES[e.month - 1] ?? `Месяц ${e.month}`,
      STATUS_RU[e.status] ?? e.status,
      productList,
      e.deliveredAt
        ? new Date(e.deliveredAt).toLocaleDateString("ru-RU")
        : "—",
      e.adminNote ?? "",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Месяц", "Статус", "Продукты", "Дата доставки", "Заметка"]],
    body: tableBody,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: "Roboto",
      overflow: "linebreak",
      textColor: DARK,
    },
    headStyles: {
      fillColor: GREEN,
      font: "Roboto",
      fontStyle: "bold",
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [248, 248, 245] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 28 },
      2: { cellWidth: 65 },
      3: { cellWidth: 25 },
      4: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const lastY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  const footerY = Math.min(lastY + 15, PAGE_HEIGHT - 25);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("sherkozu.ru  •  Семейная ферма Шерь Козу", margin, footerY + 6);

  addPageNumbers(doc, "Шерь Козу — График доставок");

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/* ═══════════════════════════════════════════════
   Admin Delivery PDF
   ═══════════════════════════════════════════════ */
export async function generateAdminDeliveryPdf(
  data: AdminDeliveryPdfData
): Promise<Buffer> {
  await ensureFonts();

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  setupDoc(doc);

  const pageW = doc.internal.pageSize.getWidth(); // 297 for landscape
  const pageH = doc.internal.pageSize.getHeight(); // 210 for landscape
  const margin = 14;

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 25, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Шерь Козу — Админ", margin, 14);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(`График доставки: ${data.animalName}`, margin, 21);

  // Title & stats
  let y = 35;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(`${data.animalName} — ${data.year}`, margin, y);
  y += 8;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    `Всего: ${data.stats.total}  |  Доставлено: ${data.stats.delivered}  |  Готово: ${data.stats.ready}  |  Запланировано: ${data.stats.planned}`,
    margin,
    y
  );
  y += 8;

  // Table
  autoTable(doc, {
    startY: y,
    head: [
      ["Месяц", "Владелец", "Продукты", "Статус", "Дата доставки", "Заметка"],
    ],
    body: data.rows.map((r) => [
      r.month,
      r.ownerName,
      r.products,
      STATUS_RU[r.status] ?? r.status,
      r.deliveredAt || "—",
      r.adminNote || "",
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      font: "Roboto",
      overflow: "linebreak",
      textColor: DARK,
    },
    headStyles: {
      fillColor: [26, 58, 42],
      font: "Roboto",
      fontStyle: "bold",
      textColor: [255, 255, 255],
    },
    alternateRowStyles: { fillColor: [248, 248, 245] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 40 },
      2: { cellWidth: 80 },
      3: { cellWidth: 30 },
      4: { cellWidth: 28 },
      5: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const lastY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  const footerY = Math.min(lastY + 10, pageH - 15);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("sherkozu.ru  •  Семейная ферма Шерь Козу", margin, footerY + 5);

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Шерь Козу — Доставки (админ)  •  стр. ${i} из ${totalPages}`,
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
