import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchKnowledgeMock = vi.hoisted(() => vi.fn());

vi.mock("./nutritionistDb", () => ({
  searchKnowledge: searchKnowledgeMock,
}));

import { getZoyaRagEntries, ZOYA_RAG_CONTEXT_LIMIT } from "./zoyaRag";

describe("getZoyaRagEntries", () => {
  beforeEach(() => {
    searchKnowledgeMock.mockReset();
  });

  it("passes the original multiword question to the shared search with the context limit", async () => {
    searchKnowledgeMock.mockResolvedValue([{ id: 660046 }]);

    const result = await getZoyaRagEntries("  Сколько кальция в овечьем молоке?  ");

    expect(searchKnowledgeMock).toHaveBeenCalledWith(
      "Сколько кальция в овечьем молоке?",
      { limit: ZOYA_RAG_CONTEXT_LIMIT },
    );
    expect(result).toEqual([{ id: 660046 }]);
    expect(ZOYA_RAG_CONTEXT_LIMIT).toBe(6);
  });

  it("does not query the database for an empty question", async () => {
    await expect(getZoyaRagEntries("   ")).resolves.toEqual([]);
    expect(searchKnowledgeMock).not.toHaveBeenCalled();
  });
});

describe("Zoya RAG runtime wiring", () => {
  const trpcSource = readFileSync(
    path.resolve(__dirname, "routers/nutritionist.ts"),
    "utf8",
  );
  const sseSource = readFileSync(path.resolve(__dirname, "zoyaSSE.ts"), "utf8");

  it("uses the same shared helper in tRPC and SSE paths", () => {
    expect(trpcSource).toContain("getZoyaRagEntries(lastUserMsg?.content)");
    expect(sseSource).toContain("getZoyaRagEntries(lastUserMsg?.content)");
  });

  it("removes the defective joined-keyword lookup from both paths", () => {
    expect(trpcSource).not.toContain('keywords.join(" ")');
    expect(sseSource).not.toContain('keywords.join(" ")');
  });
});
