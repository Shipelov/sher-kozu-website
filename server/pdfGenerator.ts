/**
 * Server-side PDF generation for the Pricing Calculator.
 * Uses jsPDF with embedded Roboto fonts for full Cyrillic support.
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

  // Try loading from local files first, then download from CDN
  const regularPath = path.join(FONT_DIR, "Roboto-Regular.ttf");
  const boldPath = path.join(FONT_DIR, "Roboto-Bold.ttf");

  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    regularB64 = fs.readFileSync(regularPath).toString("base64");
    boldB64 = fs.readFileSync(boldPath).toString("base64");
  } else {
    // Download from CDN
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

    // Cache locally
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

  /* ─── Header ─── */
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
    `${data.breedEmoji} ${data.breedName} — ${data.sharePercent}% владения`,
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
  y += 12;

  /* ─── Products table ─── */
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
  doc.text("Стоимость", margin + 130, y);
  y += 10;

  // Table rows
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  for (const p of data.products) {
    doc.setTextColor(...DARK);
    doc.text(p.name, margin + 3, y);
    doc.text(`${p.volume} ${p.unit}`, margin + 80, y);
    doc.setTextColor(...GREEN);
    doc.text(`${fmt(p.value)} ₽`, margin + 130, y);
    y += 7;
  }

  // Total row
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y - 4, pageW - margin, y - 4);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Итого рыночная стоимость", margin + 3, y);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(data.marketValue)} ₽`, margin + 130, y);
  y += 15;

  /* ─── Savings highlight ─── */
  doc.setFillColor(232, 245, 233);
  doc.roundedRect(margin, y - 6, pageW - 2 * margin, 25, 3, 3, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GREEN);
  doc.text(`Ваша выгода: ${data.savingsPercent}%`, margin + 5, y + 4);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(12);
  doc.text(`Экономия: ${fmt(data.savingsAmount)} ₽ в год`, margin + 5, y + 14);
  y += 30;

  /* ─── Cost breakdown ─── */
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
    const isBold = label.startsWith("Итого");
    doc.setFont("Roboto", isBold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, margin + 5, y);
    doc.text(value, pageW - margin - 5, y, { align: "right" });
    y += 7;
  }
  y += 8;

  /* ─── Value breakdown ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Ценность для вас", margin, y);
  y += 8;

  const valueRows = [
    ["Продукция (рыночная цена)", `${fmt(data.marketValue)} ₽`],
    [
      "Привилегии и клуб",
      `${fmt(data.sharePercent === 100 ? 95000 : 45000)} ₽`,
    ],
    [
      "Визиты и мероприятия",
      `${fmt(data.sharePercent === 100 ? 76000 : 36000)} ₽`,
    ],
  ];

  for (const [label, value] of valueRows) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, margin + 5, y);
    doc.text(value, pageW - margin - 5, y, { align: "right" });
    y += 7;
  }
  y += 5;

  const totalValue =
    data.marketValue +
    (data.sharePercent === 100 ? 95000 : 45000) +
    (data.sharePercent === 100 ? 76000 : 36000);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.text("Итого ценность", margin + 5, y);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(totalValue)} ₽`, pageW - margin - 5, y, { align: "right" });
  y += 12;

  /* ─── Product distribution ─── */
  if (data.productDistribution?.length) {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text("Распределение молока", margin, y);
    y += 8;

    for (const { label, pct } of data.productDistribution) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.text(`${label}`, margin + 5, y);

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

  y += 5;

  /* ─── Footer ─── */
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

  /* ─── Return buffer ─── */
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
