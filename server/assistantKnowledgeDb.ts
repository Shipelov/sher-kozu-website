/**
 * База знаний AI-ассистентов (таблица assistantKnowledge).
 * Поиск переносимый (LIKE по токенам + ранжирование в памяти): TiDB не
 * поддерживает FULLTEXT.
 */

import { and, asc, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import {
  assistantKnowledge,
  type AssistantKnowledge,
  type InsertAssistantKnowledge,
} from "../drizzle/schema";
import { getDb } from "./db";

export type AssistantName = "masha" | "zoya" | "shared";

export const ASSISTANT_KNOWLEDGE_CATEGORIES = [
  "farm",
  "breeds",
  "nutrition",
  "market",
  "products",
  "delivery",
  "club",
  "platform",
  "audience",
  "values",
  "general",
] as const;
export type AssistantKnowledgeCategory = (typeof ASSISTANT_KNOWLEDGE_CATEGORIES)[number];

/** Ассистент видит свои записи и общие. */
function assistantFilter(assistant: AssistantName): SQL {
  if (assistant === "shared") return eq(assistantKnowledge.assistant, "shared");
  return or(eq(assistantKnowledge.assistant, assistant), eq(assistantKnowledge.assistant, "shared")) as SQL;
}

export async function listActiveKnowledgeByCategory(
  assistant: AssistantName,
  category: string,
): Promise<AssistantKnowledge[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(assistantKnowledge)
    .where(and(assistantFilter(assistant), eq(assistantKnowledge.category, category), eq(assistantKnowledge.isActive, true)))
    .orderBy(asc(assistantKnowledge.sortOrder), asc(assistantKnowledge.id));
}

const QUERY_STOPWORDS = new Set([
  "что", "чем", "как", "где", "это", "эти", "есть", "или", "для", "при", "про", "ваш", "ваши", "наш", "наши",
  "вас", "нас", "они", "она", "его", "еще", "уже", "вам", "нам", "мне", "мой", "моя", "мои", "сколько", "какой", "какая", "какие", "расскажи", "скажи",
]);

export function tokenizeKnowledgeQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/ё/g, "е")
        .split(/[^a-zа-я0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !QUERY_STOPWORDS.has(token))
        // Грубая лемматизация: отрезаем окончание, чтобы «лаконы» нашли «лакон»
        .map((token) => (token.length > 5 ? token.slice(0, token.length - 2) : token.length > 4 ? token.slice(0, -1) : token)),
    ),
  ).slice(0, 8);
}

export function scoreKnowledgeEntry(
  entry: Pick<AssistantKnowledge, "title" | "content" | "tags">,
  tokens: string[],
): number {
  const title = entry.title.toLowerCase().replace(/ё/g, "е");
  const content = entry.content.toLowerCase().replace(/ё/g, "е");
  const tags = (Array.isArray(entry.tags) ? entry.tags : []).join(" ").toLowerCase().replace(/ё/g, "е");
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 5;
    if (tags.includes(token)) score += 3;
    const occurrences = content.split(token).length - 1;
    if (occurrences > 0) score += Math.min(occurrences, 3);
  }
  return score;
}

export async function searchAssistantKnowledge(
  assistant: AssistantName,
  query: string,
  options: { category?: string; limit?: number } = {},
): Promise<Array<AssistantKnowledge & { score: number }>> {
  const db = await getDb();
  if (!db) return [];
  const tokens = tokenizeKnowledgeQuery(query);
  const limit = options.limit ?? 5;
  const base = [assistantFilter(assistant), eq(assistantKnowledge.isActive, true)];
  if (options.category) base.push(eq(assistantKnowledge.category, options.category));

  const tokenConditions = tokens.map((token) => {
    const pattern = `%${token.replace(/[%_\\]/g, "\\$&")}%`;
    return or(
      like(assistantKnowledge.title, pattern),
      like(assistantKnowledge.content, pattern),
      like(sql`cast(${assistantKnowledge.tags} as char)`, pattern),
    );
  });
  const where = tokenConditions.length > 0 ? and(...base, or(...tokenConditions)) : and(...base);

  const rows: AssistantKnowledge[] = await db
    .select()
    .from(assistantKnowledge)
    .where(where)
    .orderBy(asc(assistantKnowledge.sortOrder))
    .limit(60);

  return rows
    .map((row: AssistantKnowledge) => ({ ...row, score: scoreKnowledgeEntry(row, tokens) }))
    .sort((a: AssistantKnowledge & { score: number }, b: AssistantKnowledge & { score: number }) => b.score - a.score || a.sortOrder - b.sortOrder)
    .slice(0, limit);
}

/* ─── Админ-CRUD ─── */

export async function listAssistantKnowledge(filters: {
  assistant?: AssistantName;
  category?: string;
  search?: string;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { items: [] as AssistantKnowledge[], total: 0 };

  const conditions: SQL[] = [];
  if (filters.assistant) conditions.push(eq(assistantKnowledge.assistant, filters.assistant));
  if (filters.category) conditions.push(eq(assistantKnowledge.category, filters.category));
  if (!filters.includeInactive) conditions.push(eq(assistantKnowledge.isActive, true));
  if (filters.search) {
    const pattern = `%${filters.search.replace(/[%_\\]/g, "\\$&")}%`;
    conditions.push(or(like(assistantKnowledge.title, pattern), like(assistantKnowledge.content, pattern)) as SQL);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items: AssistantKnowledge[] = await db
    .select()
    .from(assistantKnowledge)
    .where(where)
    .orderBy(asc(assistantKnowledge.category), asc(assistantKnowledge.sortOrder), desc(assistantKnowledge.updatedAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0);
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(assistantKnowledge)
    .where(where);
  return { items, total: Number(countRow?.count ?? 0) };
}

export async function createAssistantKnowledge(
  data: Omit<InsertAssistantKnowledge, "id" | "createdAt" | "updatedAt">,
): Promise<AssistantKnowledge> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [inserted] = await db.insert(assistantKnowledge).values(data).$returningId();
  const [entry] = await db.select().from(assistantKnowledge).where(eq(assistantKnowledge.id, inserted.id)).limit(1);
  return entry;
}

export async function updateAssistantKnowledge(
  id: number,
  data: Partial<Omit<InsertAssistantKnowledge, "id" | "createdAt" | "updatedAt">>,
): Promise<AssistantKnowledge | null> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(assistantKnowledge).set(data).where(eq(assistantKnowledge.id, id));
  const [entry] = await db.select().from(assistantKnowledge).where(eq(assistantKnowledge.id, id)).limit(1);
  return entry ?? null;
}

export async function deleteAssistantKnowledge(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.delete(assistantKnowledge).where(eq(assistantKnowledge.id, id));
  return true;
}
