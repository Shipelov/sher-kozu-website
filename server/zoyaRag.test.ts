import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchKnowledgeMock = vi.hoisted(() => vi.fn());

vi.mock("./nutritionistDb", () => ({
  searchKnowledge: searchKnowledgeMock,
}));

import {
  getZoyaRagEntries,
  isKnowledgeEligibleForRag,
  ZOYA_RAG_CONTEXT_LIMIT,
} from "./zoyaRag";

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: "Кальций в овечьем молоке",
  content: "Проверенное содержание",
  contentChunks: null,
  category: "nutrition_science",
  sourceType: "manual",
  sourceName: "Научный обзор",
  sourceUrl: "https://example.com/review",
  sourceDate: null,
  confidence: "verified",
  status: "active",
  conflictNotes: null,
  tags: [],
  metadata: null,
  addedBy: null,
  verifiedBy: null,
  verifiedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("getZoyaRagEntries", () => {
  beforeEach(() => {
    searchKnowledgeMock.mockReset();
  });

  it("passes the original multiword question to a wider candidate search and limits prompt context", async () => {
    searchKnowledgeMock.mockResolvedValue([entry({ id: 660046 })]);

    const result = await getZoyaRagEntries("  Сколько кальция в овечьем молоке?  ");

    expect(searchKnowledgeMock).toHaveBeenCalledWith(
      "Сколько кальция в овечьем молоке?",
      { limit: 30 },
    );
    expect(result[0]?.id).toBe(660046);
    expect(ZOYA_RAG_CONTEXT_LIMIT).toBe(6);
  });

  it("does not query the database for an empty question", async () => {
    await expect(getZoyaRagEntries("   ")).resolves.toEqual([]);
    expect(searchKnowledgeMock).not.toHaveBeenCalled();
  });

  it("excludes unverified and exact placeholder records from every RAG policy", () => {
    expect(isKnowledgeEligibleForRag(entry({ confidence: "unverified" }) as any, "general")).toBe(false);
    expect(isKnowledgeEligibleForRag(entry({
      title: "Тестовая запись от админа",
      content: "Тестовое содержание для проверки создания записи через админ-панель.",
    }) as any, "personalized")).toBe(false);
  });

  it("requires a verified record with traceable source for medical safety", async () => {
    searchKnowledgeMock.mockResolvedValue([
      entry({ id: 1, confidence: "trusted" }),
      entry({ id: 2, sourceUrl: null }),
      entry({ id: 3 }),
    ]);

    const result = await getZoyaRagEntries("аллергия на казеин", "medical");
    expect(result.map((item) => item.id)).toEqual([3]);
  });
});

describe("Zoya RAG runtime wiring", () => {
  const assemblerSource = readFileSync(path.resolve(__dirname, "zoyaContextAssembler.ts"), "utf8");
  const trpcSource = readFileSync(path.resolve(__dirname, "routers/nutritionist.ts"), "utf8");
  const sseSource = readFileSync(path.resolve(__dirname, "zoyaSSE.ts"), "utf8");

  it("routes both transports through the same context assembler and RAG policy", () => {
    expect(trpcSource).toContain("assembleZoyaContext({");
    expect(sseSource).toContain("assembleZoyaContext({");
    expect(assemblerSource).toContain("getZoyaRagEntries(");
    expect(assemblerSource).toContain('intent === "medical_safety" ? "medical"');
  });

  it("removes the defective joined-keyword lookup from both paths", () => {
    expect(trpcSource).not.toContain('keywords.join(" ")');
    expect(sseSource).not.toContain('keywords.join(" ")');
  });
});
