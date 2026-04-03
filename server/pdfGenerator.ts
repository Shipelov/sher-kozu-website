/**
 * Server-side PDF generation for the Pricing Calculator.
 * Uses jsPDF with embedded Roboto fonts for full Cyrillic support.
 * Supports automatic multi-page layout when content exceeds one page.
 */
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

/* ─── Font paths (downloaded at build time) ─── */
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
export interface PdfCalcData {
  breedName: string;
  breedEmoji: string;
  sharePercent: number;
  monthlyLiters: number;
  initialPrice: number;
  monthlyFee: number;
  annualPayment: string;
  products: Array<{
    name: string;
    volume: string;
    unit: string;
    marketPrice: number;
    value: number;
  }>;
  marketValue: number;
  totalCost: number;
  savingsPercent: number;
  savingsAmount: number;
  productDistribution: Array<{ label: string; pct: number }>;
}

/* ─── Helpers ─── */
const fmt = (n: number) => n.toLocaleString("ru-RU");

const GREEN: [number, number, number] = [46, 125, 50];
const DARK: [number, number, number] = [33, 33, 33];
const MUTED: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 245, 240];

const PAGE_HEIGHT = 297; // A4 height in mm
const BOTTOM_MARGIN = 20; // Reserve space at bottom for footer

/* ─── Page break helper ─── */
function checkPageBreak(
  doc: jsPDF,
  y: number,
  neededSpace: number,
  margin: number
): number {
  if (y + neededSpace > PAGE_HEIGHT - BOTTOM_MARGIN) {
    doc.addPage();
    // Reset y to top of new page with some padding
    return 20;
  }
  return y;
}

function addPageNumber(doc: jsPDF, margin: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageNum = doc.getNumberOfPages();
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Шерь Козу — Расчёт выгоды  •  стр. ${pageNum}`,
    pageW / 2,
    PAGE_HEIGHT - 8,
    { align: "center" }
  );
}

/* ─── Main export ─── */
export async function generateCalculatorPdfBuffer(
  data: PdfCalcData
): Promise<Buffer> {
  await ensureFonts();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Register fonts
  doc.addFileToVFS("Roboto-Regular.ttf", regularB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", boldB64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  /* ═══════════════════════════════════════════════
     PAGE 1 — Header
     ═══════════════════════════════════════════════ */
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 35, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Шерь Козу", margin, y);

  y += 8;
  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.text("Персональное фермерство — расчёт выгоды", margin, y);

  y += 20;

  /* ─── Breed & ownership ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(
    `${data.breedName} — ${data.sharePercent}% владения`,
    margin,
    y
  );
  y += 10;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    `Молоко: ${data.monthlyLiters} л/мес  •  Разовый платёж: ${fmt(data.initialPrice)} ₽  •  Ежемесячно: ${fmt(data.monthlyFee)} ₽/мес`,
    margin,
    y
  );
  y += 14;

  /* ═══════════════════════════════════════════════
     Products table
     ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 20, margin);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Что вы получите за год", margin, y);
  y += 8;

  // Table header
  doc.setFillColor(...LIGHT_BG);
  doc.rect(margin, y - 4, pageW - 2 * margin, 8, "F");
  doc.setFont("Roboto", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text("Продукт", margin + 3, y);
  doc.text("Объём/год", margin + 80, y);
  doc.text("Рыночная цена", margin + 110, y);
  doc.text("Стоимость", margin + 150, y);
  y += 10;

  // Table rows
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  for (const p of data.products) {
    y = checkPageBreak(doc, y, 8, margin);
    doc.setTextColor(...DARK);
    doc.text(p.name, margin + 3, y);
    doc.text(`${p.volume} ${p.unit}`, margin + 80, y);
    doc.setTextColor(...MUTED);
    doc.text(p.marketPrice > 0 ? `${fmt(p.marketPrice)} ₽` : "—", margin + 110, y);
    doc.setTextColor(...GREEN);
    doc.text(`${fmt(p.value)} ₽`, margin + 150, y);
    y += 7;
  }

  // Total row
  y += 2;
  y = checkPageBreak(doc, y, 10, margin);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y - 4, pageW - margin, y - 4);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Итого рыночная стоимость", margin + 3, y);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(data.marketValue)} ₽`, margin + 150, y);
  y += 15;

  /* ═══════════════════════════════════════════════
     Savings highlight
     ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 30, margin);

  doc.setFillColor(232, 245, 233);
  doc.roundedRect(margin, y - 6, pageW - 2 * margin, 25, 3, 3, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GREEN);
  doc.text(`Ваша выгода: ${data.savingsPercent}%`, margin + 5, y + 4);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(12);
  doc.text(
    `Экономия: ${fmt(data.savingsAmount)} ₽ в год`,
    margin + 5,
    y + 14
  );
  y += 32;

  /* ═══════════════════════════════════════════════
     Cost breakdown
     ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 40, margin);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Сводка расходов (год)", margin, y);
  y += 8;

  const costRows = [
    ["Разовый платёж", `${fmt(data.initialPrice)} ₽`],
    ["Ежемесячные взносы", `${fmt(data.monthlyFee * 12)} ₽`],
    ["Итого ваши расходы", `${fmt(data.totalCost)} ₽`],
  ];

  for (const [label, value] of costRows) {
    y = checkPageBreak(doc, y, 8, margin);
    const isBold = label.startsWith("Итого");
    doc.setFont("Roboto", isBold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, margin + 5, y);
    doc.text(value, pageW - margin - 5, y, { align: "right" });
    y += 7;
  }
  y += 10;

  /* ═══════════════════════════════════════════════
     Value breakdown
     ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 50, margin);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Ценность для вас", margin, y);
  y += 8;

  const privilegesValue = data.sharePercent === 100 ? 95000 : 45000;
  const visitsValue = data.sharePercent === 100 ? 76000 : 36000;
  const totalValue = data.marketValue + privilegesValue + visitsValue;

  const valueRows = [
    ["Продукция (рыночная цена)", `${fmt(data.marketValue)} ₽`],
    ["Привилегии и клуб", `${fmt(privilegesValue)} ₽`],
    ["Визиты и мероприятия", `${fmt(visitsValue)} ₽`],
  ];

  for (const [label, value] of valueRows) {
    y = checkPageBreak(doc, y, 8, margin);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, margin + 5, y);
    doc.text(value, pageW - margin - 5, y, { align: "right" });
    y += 7;
  }
  y += 5;

  y = checkPageBreak(doc, y, 10, margin);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text("Итого ценность", margin + 5, y);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(totalValue)} ₽`, pageW - margin - 5, y, { align: "right" });
  y += 15;

  /* ═══════════════════════════════════════════════
     Comparison block
     ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 35, margin);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Сравнение", margin, y);
  y += 10;

  // Your costs box
  const boxW = (pageW - 2 * margin - 10) / 2;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(margin, y - 4, boxW, 20, 2, 2, "F");
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Ваши расходы", margin + boxW / 2, y + 2, { align: "center" });
  doc.setFont("Roboto", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text(`${fmt(data.totalCost)} ₽`, margin + boxW / 2, y + 12, {
    align: "center",
  });

  // Market value box
  const box2X = margin + boxW + 10;
  doc.setFillColor(232, 245, 233);
  doc.roundedRect(box2X, y - 4, boxW, 20, 2, 2, "F");
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Рыночная стоимость", box2X + boxW / 2, y + 2, {
    align: "center",
  });
  doc.setFont("Roboto", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(totalValue)} ₽`, box2X + boxW / 2, y + 12, {
    align: "center",
  });
  y += 28;

  /* ═══════════════════════════════════════════════
     Product distribution
     ═══════════════════════════════════════════════ */
  if (data.productDistribution?.length) {
    y = checkPageBreak(doc, y, 15 + data.productDistribution.length * 9, margin);

    doc.setFont("Roboto", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text("Распределение молока", margin, y);
    y += 10;

    for (const { label, pct } of data.productDistribution) {
      y = checkPageBreak(doc, y, 10, margin);
      doc.setFont("Roboto", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.text(label, margin + 5, y);

      // Progress bar
      const barX = margin + 70;
      const barW = 80;
      const barH = 4;
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(barX, y - 3, barW, barH, 2, 2, "F");
      doc.setFillColor(...GREEN);
      doc.roundedRect(
        barX,
        y - 3,
        Math.max(2, (pct / 100) * barW),
        barH,
        2,
        2,
        "F"
      );

      doc.setFont("Roboto", "bold");
      doc.setFontSize(10);
      doc.text(`${pct}%`, barX + barW + 5, y);
      y += 8;
    }
  }

  y += 8;

  /* ═══════════════════════════════════════════════
     Footer
     ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 20, margin);

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "Данный расчёт носит информационный характер. Точные условия уточняйте у менеджера фермы.",
    margin,
    y
  );
  y += 5;
  doc.text("sherkozu.ru  •  Семейная ферма Шерь Козу", margin, y);

  /* ─── Add page numbers to all pages ─── */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Шерь Козу — Расчёт выгоды  •  стр. ${i} из ${totalPages}`,
      pageW / 2,
      PAGE_HEIGHT - 8,
      { align: "center" }
    );
  }

  /* ─── Return buffer ─── */
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
