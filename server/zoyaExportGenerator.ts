/**
 * Zoya AI Nutritionist — PDF & DOCX Export Generator
 *
 * Generates beautifully formatted PDF and DOCX documents from Zoya's
 * chat responses (meal plans, menus, nutrition recommendations).
 * Uses jsPDF for PDF and docx for DOCX generation.
 */

import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableRow,
  TableCell,
  Table,
  WidthType,
  ShadingType,
} from "docx";
import fs from "fs";
import path from "path";

/* ─── Font loading (shared with calculator PDF) ─── */
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
export interface ZoyaExportData {
  /** The assistant's markdown response to export */
  content: string;
  /** Optional title override (auto-detected from content if not provided) */
  title?: string;
  /** User's name for personalization */
  userName?: string;
  /** Date of the conversation */
  date?: string;
  /** The user's question that prompted this response */
  userQuestion?: string;
}

/* ─── Helpers ─── */
const GREEN: [number, number, number] = [46, 125, 50];
const DARK: [number, number, number] = [33, 33, 33];
const MUTED: [number, number, number] = [120, 120, 120];
const LIGHT_BG: [number, number, number] = [245, 248, 240];
const EMERALD_LIGHT: [number, number, number] = [236, 253, 245];

const PAGE_HEIGHT = 297;
const BOTTOM_MARGIN = 20;

function checkPageBreak(doc: jsPDF, y: number, neededSpace: number): number {
  if (y + neededSpace > PAGE_HEIGHT - BOTTOM_MARGIN) {
    doc.addPage();
    return 20;
  }
  return y;
}

/**
 * Extract a title from markdown content.
 * Looks for first # heading or first bold text.
 */
function extractTitle(content: string): string {
  // Try to find first markdown heading
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].replace(/[*_`]/g, "").trim();

  // Try first bold text
  const boldMatch = content.match(/\*\*(.+?)\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  return "Рекомендации нутрициолога";
}

/**
 * Parse markdown into structured blocks for rendering.
 */
interface ContentBlock {
  type: "heading" | "paragraph" | "list-item" | "separator" | "table-row";
  level?: number; // heading level 1-3
  text: string;
  bold?: boolean;
}

function parseMarkdown(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // Empty line — add small separator
      blocks.push({ type: "separator", text: "" });
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].replace(/[*_`]/g, ""),
      });
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push({ type: "separator", text: "---" });
      continue;
    }

    // List items (-, *, numbered)
    const listMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const numListMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (listMatch || numListMatch) {
      const text = (listMatch?.[1] || numListMatch?.[1]) ?? trimmed;
      blocks.push({ type: "list-item", text: text.replace(/[*_`]/g, "") });
      continue;
    }

    // Table rows
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator rows like |---|---|
      if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
      blocks.push({ type: "table-row", text: trimmed });
      continue;
    }

    // Regular paragraph
    blocks.push({
      type: "paragraph",
      text: trimmed.replace(/[`]/g, ""),
      bold: trimmed.startsWith("**") && trimmed.endsWith("**"),
    });
  }

  return blocks;
}

/**
 * Strip markdown formatting from text for plain rendering.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

/* ═══════════════════════════════════════════════════════════════════
   PDF Generation
   ═══════════════════════════════════════════════════════════════════ */

export async function generateZoyaPdfBuffer(
  data: ZoyaExportData
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
  const contentW = pageW - 2 * margin;
  let y = 20;

  const title = data.title || extractTitle(data.content);
  const dateStr =
    data.date || new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  /* ─── Header ─── */
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Шерь Козу", margin, y);

  y += 7;
  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.text("Зоя — AI-нутрициолог", margin, y);

  y += 6;
  doc.setFontSize(8);
  doc.text(dateStr, margin, y);

  if (data.userName) {
    doc.text(`Для: ${data.userName}`, pageW - margin, y, { align: "right" });
  }

  y = 46;

  /* ─── Title ─── */
  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  const titleLines = doc.splitTextToSize(stripMarkdown(title), contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  /* ─── User question (if provided) ─── */
  if (data.userQuestion) {
    y = checkPageBreak(doc, y, 16);
    doc.setFillColor(...EMERALD_LIGHT);
    const qLines = doc.splitTextToSize(
      `Вопрос: ${stripMarkdown(data.userQuestion)}`,
      contentW - 10
    );
    const qHeight = qLines.length * 5 + 8;
    doc.roundedRect(margin, y - 4, contentW, qHeight, 2, 2, "F");
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(qLines, margin + 5, y + 2);
    y += qHeight + 4;
  }

  /* ─── Content ─── */
  const blocks = parseMarkdown(data.content);

  for (const block of blocks) {
    switch (block.type) {
      case "heading": {
        const fontSize = block.level === 1 ? 14 : block.level === 2 ? 12 : 10;
        y = checkPageBreak(doc, y, 12);
        y += 3;
        doc.setFont("Roboto", "bold");
        doc.setFontSize(fontSize);
        doc.setTextColor(...GREEN);
        const hLines = doc.splitTextToSize(stripMarkdown(block.text), contentW);
        doc.text(hLines, margin, y);
        y += hLines.length * (fontSize * 0.45) + 4;
        break;
      }

      case "list-item": {
        y = checkPageBreak(doc, y, 8);
        doc.setFont("Roboto", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...DARK);
        // Bullet
        doc.setFillColor(...GREEN);
        doc.circle(margin + 2, y - 1.2, 1, "F");
        // Text
        const liLines = doc.splitTextToSize(
          stripMarkdown(block.text),
          contentW - 8
        );
        doc.text(liLines, margin + 6, y);
        y += liLines.length * 4.5 + 2;
        break;
      }

      case "paragraph": {
        y = checkPageBreak(doc, y, 8);
        const isBold =
          block.bold ||
          block.text.startsWith("**") ||
          block.text.includes("**");
        const cleanText = stripMarkdown(block.text);
        doc.setFont("Roboto", isBold ? "bold" : "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...DARK);
        const pLines = doc.splitTextToSize(cleanText, contentW);
        doc.text(pLines, margin, y);
        y += pLines.length * 4.5 + 2;
        break;
      }

      case "table-row": {
        y = checkPageBreak(doc, y, 8);
        const cells = block.text
          .split("|")
          .filter((c) => c.trim())
          .map((c) => stripMarkdown(c.trim()));

        if (cells.length > 0) {
          const cellW = contentW / cells.length;
          doc.setFont("Roboto", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...DARK);

          // Light background for table rows
          doc.setFillColor(...LIGHT_BG);
          doc.rect(margin, y - 3.5, contentW, 6, "F");

          cells.forEach((cell, i) => {
            const truncated = cell.length > 35 ? cell.slice(0, 32) + "..." : cell;
            doc.text(truncated, margin + i * cellW + 2, y);
          });
          y += 6;
        }
        break;
      }

      case "separator": {
        if (block.text === "---") {
          y = checkPageBreak(doc, y, 6);
          doc.setDrawColor(220, 220, 220);
          doc.line(margin, y, pageW - margin, y);
          y += 4;
        } else {
          y += 2;
        }
        break;
      }
    }
  }

  /* ─── Footer ─── */
  y = checkPageBreak(doc, y, 25);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    "Рекомендации AI-нутрициолога носят информационный характер и не заменяют консультацию врача.",
    margin,
    y
  );
  y += 5;
  doc.text("koza.vip  •  Семейная ферма Шерь Козу  •  Зоя — AI-нутрициолог", margin, y);

  /* ─── Page numbers ─── */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Шерь Козу — Зоя AI-нутрициолог  •  стр. ${i} из ${totalPages}`,
      pageW / 2,
      PAGE_HEIGHT - 8,
      { align: "center" }
    );
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/* ═══════════════════════════════════════════════════════════════════
   DOCX Generation
   ═══════════════════════════════════════════════════════════════════ */

export async function generateZoyaDocxBuffer(
  data: ZoyaExportData
): Promise<Buffer> {
  const title = data.title || extractTitle(data.content);
  const dateStr =
    data.date || new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const blocks = parseMarkdown(data.content);
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: stripMarkdown(title),
          bold: true,
          size: 36,
          color: "2E7D32",
          font: "Arial",
        }),
      ],
    })
  );

  // Subtitle line
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Зоя — AI-нутрициолог фермы «Шерь Козу»  •  ${dateStr}`,
          size: 18,
          color: "888888",
          font: "Arial",
        }),
        ...(data.userName
          ? [
              new TextRun({
                text: `  •  Для: ${data.userName}`,
                size: 18,
                color: "888888",
                font: "Arial",
              }),
            ]
          : []),
      ],
    })
  );

  // User question
  if (data.userQuestion) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 200 },
        shading: { type: ShadingType.SOLID, color: "ECFDF5" },
        children: [
          new TextRun({
            text: `Вопрос: ${stripMarkdown(data.userQuestion)}`,
            italics: true,
            size: 20,
            color: "666666",
            font: "Arial",
          }),
        ],
      })
    );
  }

  // Content blocks
  let tableRows: string[][] = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    try {
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows.map(
          (cells, rowIdx) =>
            new TableRow({
              children: cells.map(
                (cell) =>
                  new TableCell({
                    width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                    shading:
                      rowIdx === 0
                        ? { type: ShadingType.SOLID, color: "E8F5E9" }
                        : undefined,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cell,
                            bold: rowIdx === 0,
                            size: 18,
                            font: "Arial",
                          }),
                        ],
                      }),
                    ],
                  })
              ),
            })
        ),
      });
      children.push(
        new Paragraph({ spacing: { before: 100 }, children: [] })
      );
      children.push(table as any);
      children.push(
        new Paragraph({ spacing: { after: 100 }, children: [] })
      );
    } catch {
      // If table construction fails, render as paragraphs
      for (const row of tableRows) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: row.join("  |  "),
                size: 18,
                font: "Arial",
              }),
            ],
          })
        );
      }
    }
    tableRows = [];
  }

  for (const block of blocks) {
    // Flush table if we encounter a non-table block
    if (block.type !== "table-row" && tableRows.length > 0) {
      flushTable();
    }

    switch (block.type) {
      case "heading": {
        const level =
          block.level === 1
            ? HeadingLevel.HEADING_1
            : block.level === 2
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3;
        children.push(
          new Paragraph({
            heading: level,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: stripMarkdown(block.text),
                bold: true,
                size: block.level === 1 ? 28 : block.level === 2 ? 24 : 22,
                color: "2E7D32",
                font: "Arial",
              }),
            ],
          })
        );
        break;
      }

      case "list-item": {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            indent: { left: 360 },
            children: [
              new TextRun({
                text: "• ",
                bold: true,
                size: 20,
                color: "2E7D32",
                font: "Arial",
              }),
              new TextRun({
                text: stripMarkdown(block.text),
                size: 20,
                font: "Arial",
              }),
            ],
          })
        );
        break;
      }

      case "paragraph": {
        const cleanText = stripMarkdown(block.text);
        if (!cleanText) break;
        const isBold =
          block.bold ||
          block.text.startsWith("**") ||
          block.text.includes("**");
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: cleanText,
                bold: isBold,
                size: 20,
                font: "Arial",
              }),
            ],
          })
        );
        break;
      }

      case "table-row": {
        const cells = block.text
          .split("|")
          .filter((c) => c.trim())
          .map((c) => stripMarkdown(c.trim()));
        if (cells.length > 0) {
          tableRows.push(cells);
        }
        break;
      }

      case "separator": {
        if (block.text === "---") {
          children.push(
            new Paragraph({
              spacing: { before: 120, after: 120 },
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
              },
              children: [],
            })
          );
        } else {
          children.push(new Paragraph({ spacing: { before: 60 }, children: [] }));
        }
        break;
      }
    }
  }

  // Flush any remaining table
  flushTable();

  // Disclaimer footer
  children.push(
    new Paragraph({
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
      children: [],
    })
  );
  children.push(
    new Paragraph({
      spacing: { before: 100 },
      children: [
        new TextRun({
          text: "Рекомендации AI-нутрициолога носят информационный характер и не заменяют консультацию врача.",
          size: 16,
          color: "999999",
          italics: true,
          font: "Arial",
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "koza.vip  •  Семейная ферма Шерь Козу  •  Зоя — AI-нутрициолог",
          size: 16,
          color: "999999",
          font: "Arial",
        }),
      ],
    })
  );

  const docxDoc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(docxDoc);
  return Buffer.from(buffer);
}
