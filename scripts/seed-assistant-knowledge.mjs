#!/usr/bin/env node
/**
 * Сид базы знаний Маши из server/assistants/masha-knowledge.md в таблицу
 * assistantKnowledge. Идемпотентен: ключ (assistant, category, title) —
 * уникальный индекс, повторный запуск обновляет content/tags/sortOrder и
 * не трогает isActive (записи, выключенные в админке, остаются выключенными).
 *
 *   DATABASE_URL=... node scripts/seed-assistant-knowledge.mjs [--dry-run] [--file path]
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ASSISTANT = "masha";

/** Секция ═══ … ═══ → категория и способ нарезки на записи. */
export const SECTION_MAP = {
  "БАЗА ЗНАНИЙ": { category: "farm", split: "##" },
  "ПОРОДЫ КОЗ": { category: "breeds", split: "###", tags: ["порода", "коза", "козы"] },
  "ПОРОДЫ ОВЕЦ": { category: "breeds", split: "###", tags: ["порода", "овца", "овцы"] },
  "НУТРИЦИОЛОГИЯ МОЛОКА": { category: "nutrition", split: "##", tags: ["молоко", "польза"] },
  "РЫНОЧНЫЙ КОНТЕКСТ": { category: "market", split: "##", tags: ["рынок"] },
  "ПРОДУКТЫ": { category: "products", title: "Продукты фермы", tags: ["продукты", "сыр", "молоко"] },
  "КЛУБ ВЛАДЕЛЬЦЕВ": { category: "club", title: "Клуб владельцев", tags: ["клуб", "мероприятия"] },
  "ПЛАТФОРМА (САЙТ)": { category: "platform", title: "Возможности сайта", tags: ["сайт", "кабинет"] },
  "ДЛЯ КОГО": { category: "audience", title: "Для кого проект", tags: ["семьи", "подарки"] },
  "ЦЕННОСТИ": { category: "values", title: "Ценности фермы", tags: ["ценности"] },
};

const DELIVERY_PATTERN = /^-?[ ]*доставк/i;

function normalize(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

function splitByHeading(body, marker) {
  const lines = body.split("\n");
  const entries = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith(`${marker} `)) {
      if (current) entries.push(current);
      current = { title: line.slice(marker.length + 1).trim(), lines: [] };
      continue;
    }
    if (!current) {
      if (line.trim()) {
        current = { title: null, lines: [line] };
      }
      continue;
    }
    current.lines.push(line);
  }
  if (current) entries.push(current);
  return entries.map((entry) => ({ title: entry.title, content: entry.lines.join("\n").trim() }));
}

/**
 * Разбирает markdown с секциями ═══ НАЗВАНИЕ ═══ в список записей
 * { assistant, category, title, content, tags, sortOrder }.
 */
export function parseKnowledgeMarkdown(markdown) {
  const text = normalize(stripHtmlComments(markdown));
  const sectionRegex = /^═══\s+(.+?)\s+═══$/gm;
  const sections = [];
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({ name: match[1].trim(), start: match.index + match[0].length });
  }

  const entries = [];
  let sortOrder = 0;
  const push = (entry) => {
    sortOrder += 10;
    entries.push({ assistant: ASSISTANT, ...entry, sortOrder });
  };

  sections.forEach((section, index) => {
    const end = index + 1 < sections.length ? text.lastIndexOf("═══", sections[index + 1].start - 1) : text.length;
    const body = text.slice(section.start, end).trim();
    const rule = SECTION_MAP[section.name];
    if (!rule) return;
    const baseTags = rule.tags ?? [];

    if (rule.split) {
      for (const part of splitByHeading(body, rule.split)) {
        if (!part.content) continue;
        const title = part.title ?? section.name;
        push({
          category: rule.category,
          title,
          content: part.content,
          tags: Array.from(new Set([...baseTags, ...titleTags(title)])),
        });
      }
      return;
    }

    push({ category: rule.category, title: rule.title, content: body, tags: baseTags });

    if (rule.category === "products") {
      const deliveryLine = body.split("\n").find((line) => DELIVERY_PATTERN.test(line));
      if (deliveryLine) {
        push({
          category: "delivery",
          title: "Доставка продуктов",
          content: `${deliveryLine.replace(/^-\s*/, "").trim()}. Точные условия и сроки — при оформлении участия или у фермы напрямую.`,
          tags: ["доставка", "москва", "подмосковье"],
        });
      }
    }
  });

  return entries;
}

function titleTags(title) {
  return title
    .toLowerCase()
    .replace(/[()]/g, " ")
    .split(/[^a-zа-яё0-9-]+/i)
    .filter((token) => token.length >= 4)
    .slice(0, 4);
}

export function defaultKnowledgePath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "server", "assistants", "masha-knowledge.md");
}

export async function seedAssistantKnowledge(entries, databaseUrl) {
  const { default: mysql } = await import("mysql2/promise");
  const connection = await mysql.createConnection(databaseUrl);
  let updated = 0;
  let unchanged = 0;
  try {
    const countRows = async () => {
      const [rows] = await connection.query("SELECT COUNT(*) AS n FROM assistantKnowledge");
      return Number(rows[0]?.n ?? 0);
    };
    const before = await countRows();
    for (const entry of entries) {
      const [result] = await connection.execute(
        `INSERT INTO assistantKnowledge (assistant, category, title, content, tags, isActive, sortOrder)
         VALUES (?, ?, ?, ?, ?, 1, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content), tags = VALUES(tags), sortOrder = VALUES(sortOrder)`,
        [entry.assistant, entry.category, entry.title, entry.content, JSON.stringify(entry.tags ?? []), entry.sortOrder],
      );
      // affectedRows: 2 — обновление; 1 — вставка или без изменений (mysql2 включает FOUND_ROWS)
      if (result.affectedRows === 2) updated += 1;
      else unchanged += 1;
    }
    const inserted = (await countRows()) - before;
    return { inserted, updated, unchanged: unchanged - inserted, total: entries.length };
  } finally {
    await connection.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileIndex = args.indexOf("--file");
  const file = fileIndex >= 0 ? path.resolve(args[fileIndex + 1]) : defaultKnowledgePath();
  const entries = parseKnowledgeMarkdown(readFileSync(file, "utf8"));

  const byCategory = entries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Записей: ${entries.length}`, byCategory);
  if (dryRun) {
    for (const entry of entries) console.log(`- [${entry.category}] ${entry.title} (${entry.content.length} символов)`);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Переменная DATABASE_URL не задана");
    process.exit(1);
  }
  const summary = await seedAssistantKnowledge(entries, databaseUrl);
  console.log(`Готово: вставлено ${summary.inserted}, обновлено ${summary.updated}, без изменений ${summary.unchanged}, всего ${summary.total}`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
