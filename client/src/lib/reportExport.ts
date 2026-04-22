/**
 * Client-side report export utilities.
 * Generates Excel (xlsx) and PDF (jspdf + autotable) files from tabular data.
 *
 * All generation happens in the browser — no server round-trip needed.
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ──────────────────────────────────────────────────────

export interface ReportColumn {
  header: string;
  key: string;
  width?: number; // Excel column width in characters
}

export interface ReportConfig {
  title: string;
  subtitle?: string; // e.g. "Период: 01.04.2026 — 22.04.2026"
  columns: ReportColumn[];
  rows: Record<string, any>[];
  /** Optional summary rows appended at the bottom (bold) */
  summaryRows?: Record<string, any>[];
  filename: string; // without extension
}

// ─── Excel ──────────────────────────────────────────────────────

export function exportExcel(config: ReportConfig) {
  const { title, subtitle, columns, rows, summaryRows, filename } = config;

  // Build header rows
  const wsData: any[][] = [];
  wsData.push([title]);
  if (subtitle) wsData.push([subtitle]);
  wsData.push([]); // blank row

  // Column headers
  wsData.push(columns.map((c) => c.header));

  // Data rows
  for (const row of rows) {
    wsData.push(columns.map((c) => row[c.key] ?? ""));
  }

  // Summary rows
  if (summaryRows?.length) {
    wsData.push([]); // blank separator
    for (const row of summaryRows) {
      wsData.push(columns.map((c) => row[c.key] ?? ""));
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 14 }));

  // Merge title row across all columns
  if (columns.length > 1) {
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
    if (subtitle) {
      ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Отчёт");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── PDF ────────────────────────────────────────────────────────

export function exportPDF(config: ReportConfig) {
  const { title, subtitle, columns, rows, summaryRows, filename } = config;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  if (subtitle) {
    doc.setFontSize(10);
    doc.text(subtitle, 14, 22);
  }

  const startY = subtitle ? 28 : 22;

  // Combine data + summary rows
  const allRows = [...rows];
  if (summaryRows?.length) {
    allRows.push(...summaryRows);
  }

  const body = allRows.map((row) => columns.map((c) => String(row[c.key] ?? "")));
  const head = [columns.map((c) => c.header)];

  autoTable(doc, {
    startY,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [56, 102, 65], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 240] },
    // Bold summary rows
    didParseCell: (data: any) => {
      if (summaryRows?.length && data.section === "body") {
        const summaryStartIdx = rows.length;
        if (data.row.index >= summaryStartIdx) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [230, 240, 230];
        }
      }
    },
  });

  doc.save(`${filename}.pdf`);
}

// ─── Helpers ────────────────────────────────────────────────────

/** Format ISO date string to DD.MM.YYYY */
export function fmtDate(iso: string): string {
  if (!iso || iso === "—") return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Format shift label */
export function fmtShift(shift: string): string {
  return shift === "morning" ? "Утренняя" : shift === "evening" ? "Вечерняя" : shift;
}

/** Format status label */
export function fmtStatus(status: string): string {
  const map: Record<string, string> = {
    in_progress: "В процессе",
    pending_confirm: "Ожидает",
    confirmed: "Подтверждена",
    disputed: "Оспорена",
    accepted: "Принято",
    rejected: "Отклонено",
  };
  return map[status] ?? status;
}

/** Format period subtitle from dates */
export function periodSubtitle(from: string, to: string): string {
  return `Период: ${fmtDate(from + "T00:00:00")} — ${fmtDate(to + "T00:00:00")}`;
}

/** Preset period dates */
export function getPresetDates(preset: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (preset === "today") return { from: to, to };
  if (preset === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { from: d.toISOString().slice(0, 10), to };
  }
  // month
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return { from: d.toISOString().slice(0, 10), to };
}
