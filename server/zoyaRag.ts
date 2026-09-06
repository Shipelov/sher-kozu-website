import type { NutriKnowledgeEntry } from "../drizzle/schema";
import { searchKnowledge } from "./nutritionistDb";

export const ZOYA_RAG_CONTEXT_LIMIT = 6;

export async function getZoyaRagEntries(
  query: string | null | undefined,
): Promise<NutriKnowledgeEntry[]> {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) return [];

  return searchKnowledge(normalizedQuery, { limit: ZOYA_RAG_CONTEXT_LIMIT });
}
