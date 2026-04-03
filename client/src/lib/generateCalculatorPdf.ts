/*
  generateCalculatorPdf.ts
  Generates a branded PDF report for the Pricing Calculator results.
  Uses jsPDF with embedded Roboto font for Cyrillic support.
*/

import { jsPDF } from "jspdf";

/* ─── Font URLs (CDN-hosted Roboto) ─── */
const FONT_REGULAR_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/roboto-full-regular_dbd624b6.ttf";
const FONT_BOLD_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663373020185/mLhmg5VmBsEBpZiYqdnhMQ/roboto-full-bold_64cc9e0c.ttf";

/* ─── Types ─── */
export interface PdfCalcData {
  breedName: string;
  breedEmoji: string;
  sharePercent: number;
  ownershipCost: number;
  monthlyFee: number;
  annualPayment: boolean;
  effectiveMonthly: number;
  annualFee: number;
  totalCost: number;
  marketValue: number;
  savings: number;
  savingsPercent: number;
  monthlyMilk: number;
  productAllocation: Record<string, number>;
  productLabels: Record<string, { name: string }>;
  totalValueWithBonuses: number;
}

/* ─── Helpers ─── */
const fmt = (n: number) => n.toLocaleString("ru-RU");

async function fetchFontAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ─── Brand colors ─── */
const GREEN = [30, 80, 30] as const; // primary dark green
const LIGHT_GREEN = [240, 248, 240] as const; // light bg
const DARK = [30, 30, 30] as const;
const MUTED = [120, 120, 120] as const;
const WHITE = [255, 255, 255] as const;

/* ─── Main export ─── */
export async function generateCalculatorPdf(data: PdfCalcData): Promise<void> {
  // Load fonts
  const [regularB64, boldB64] = await Promise.all([
    fetchFontAsBase64(FONT_REGULAR_URL),
    fetchFontAsBase64(FONT_BOLD_URL),
  ]);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Register fonts
  doc.addFileToVFS("Roboto-Regular.ttf", regularB64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", boldB64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  const pageW = 210;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 20;

  /* ─── Header ─── */
  doc.setFillColor(...LIGHT_GREEN);
  doc.rect(0, 0, pageW, 45, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...GREEN);
  doc.text("Шерь Козу", margin, y + 8);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("Персональное фермерство", margin, y + 15);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text("Расчёт стоимости участия", margin, y + 28);

  const today = new Date().toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(today, pageW - margin, y + 28, { align: "right" });

  y = 55;

  /* ─── Selected parameters ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Параметры расчёта", margin, y);
  y += 8;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y, contentW, 36, 3, 3, "F");

  const col1 = margin + 5;
  const col2 = margin + contentW / 2 + 5;
  const paramY = y + 8;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Порода", col1, paramY);
  doc.text("Доля владения", col2, paramY);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(`${data.breedEmoji} ${data.breedName}`, col1, paramY + 7);
  doc.text(`${data.sharePercent}%`, col2, paramY + 7);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Оплата", col1, paramY + 18);
  doc.text("Молоко в месяц", col2, paramY + 18);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(data.annualPayment ? "Годовая (−15%)" : "Ежемесячная", col1, paramY + 25);
  doc.text(`~${data.monthlyMilk} л`, col2, paramY + 25);

  y += 44;

  /* ─── Cost breakdown ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Стоимость участия", margin, y);
  y += 8;

  const costRows = [
    ["Стоимость доли", `${fmt(data.ownershipCost)} ₽`, "(разовый платёж)"],
    ["Ежемесячный взнос", `${fmt(data.effectiveMonthly)} ₽/мес`, data.annualPayment ? "(с учётом скидки 15%)" : ""],
    ["Годовой взнос", `${fmt(data.annualFee)} ₽/год`, ""],
  ];

  for (const [label, value, note] of costRows) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, margin + 5, y);

    doc.setFont("Roboto", "bold");
    doc.text(value, pageW - margin - 5, y, { align: "right" });

    if (note) {
      doc.setFont("Roboto", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(note, margin + 5, y + 5);
      y += 10;
    } else {
      y += 7;
    }
  }

  // Total line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin + 5, y, pageW - margin - 5, y);
  y += 6;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text("Итого за первый год", margin + 5, y);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(data.totalCost)} ₽`, pageW - margin - 5, y, { align: "right" });
  y += 12;

  /* ─── Value breakdown ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Ценность для вас", margin, y);
  y += 8;

  const valueRows = [
    ["Продукция (рыночная цена)", `${fmt(data.marketValue)} ₽`],
    ["Привилегии и клуб", `${fmt(data.sharePercent === 100 ? 95000 : 45000)} ₽`],
    ["Визиты и мероприятия", `${fmt(data.sharePercent === 100 ? 76000 : 36000)} ₽`],
  ];

  for (const [label, value] of valueRows) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, margin + 5, y);
    doc.setFont("Roboto", "bold");
    doc.text(value, pageW - margin - 5, y, { align: "right" });
    y += 7;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin + 5, y, pageW - margin - 5, y);
  y += 6;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text("Итого ценность", margin + 5, y);
  doc.setTextColor(...GREEN);
  doc.text(`${fmt(data.totalValueWithBonuses)} ₽`, pageW - margin - 5, y, { align: "right" });
  y += 12;

  /* ─── Savings highlight ─── */
  doc.setFillColor(...GREEN);
  doc.roundedRect(margin, y, contentW, 22, 3, 3, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text("Ваша выгода", margin + 8, y + 10);

  doc.setFontSize(16);
  doc.text(
    `${fmt(data.totalValueWithBonuses - data.totalCost)} ₽  (${data.savingsPercent > 0 ? "+" : ""}${data.savingsPercent}%)`,
    pageW - margin - 8,
    y + 10,
    { align: "right" }
  );

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.text("по сравнению с рыночной стоимостью", margin + 8, y + 17);
  y += 30;

  /* ─── Product allocation ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("Распределение продукции", margin, y);
  y += 8;

  const allocEntries = Object.entries(data.productAllocation).filter(([, v]) => v > 0);
  for (const [slug, pct] of allocEntries) {
    const label = data.productLabels[slug]?.name ?? slug;
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
    doc.roundedRect(barX, y - 3, Math.max(2, (pct / 100) * barW), barH, 2, 2, "F");

    doc.setFont("Roboto", "bold");
    doc.setFontSize(10);
    doc.text(`${pct}%`, barX + barW + 5, y);
    y += 8;
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

  /* ─── Save ─── */
  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Шерь_Козу_Расчёт_${data.breedName}_${data.sharePercent}%.pdf`;
  document.body.appendChild(a);
  a.click();
  // Cleanup after a short delay
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
