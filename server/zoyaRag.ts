import type { NutriKnowledgeEntry } from "../drizzle/schema";
import { searchKnowledge } from "./nutritionistDb";

export const ZOYA_RAG_CONTEXT_LIMIT = 6;
const ZOYA_RAG_CANDIDATE_LIMIT = 30;

export type ZoyaRagPolicy = "general" | "personalized" | "medical";

function isPlaceholderEntry(entry: NutriKnowledgeEntry): boolean {
  const title = entry.title.trim().toLowerCase();
  const content = entry.content.trim().toLowerCase();
  return (
    (title === "обновлённая запись" && content === "обновлённое содержание.")
    || (title === "тестовая запись от админа" && content.startsWith("тестовое содержание"))
  );
}

export function isKnowledgeEligibleForRag(
  entry: NutriKnowledgeEntry,
  policy: ZoyaRagPolicy,
): boolean {
  if (entry.status !== "active" || isPlaceholderEntry(entry)) return false;
  if (entry.confidence === "unverified") return false;
  if (policy === "medical") {
    return entry.confidence === "verified" && Boolean(entry.sourceName?.trim()) && Boolean(entry.sourceUrl?.trim());
  }
  return entry.confidence === "verified" || entry.confidence === "trusted";
}

export async function getZoyaRagEntries(
  query: string | null | undefined,
  policy: ZoyaRagPolicy = "general",
): Promise<NutriKnowledgeEntry[]> {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) return [];

  const candidates = await searchKnowledge(normalizedQuery, { limit: ZOYA_RAG_CANDIDATE_LIMIT });
  return candidates
    .filter((entry) => isKnowledgeEligibleForRag(entry, policy))
    .slice(0, ZOYA_RAG_CONTEXT_LIMIT);
}
