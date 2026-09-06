import { describe, expect, it } from "vitest";
import type { NutriKnowledgeEntry } from "../drizzle/schema";
import {
  buildKnowledgeSearchPlan,
  extractKnowledgeSearchTerms,
  rankKnowledgeEntries,
  scoreKnowledgeEntries,
} from "./zoyaKnowledgeRetrieval";

const UPDATED_AT = new Date("2026-09-06T11:51:10.000Z");

function knowledge(
  input: Pick<NutriKnowledgeEntry, "id" | "title" | "content"> &
    Partial<NutriKnowledgeEntry>,
): NutriKnowledgeEntry {
  return {
    id: input.id,
    category: input.category ?? "nutrition_science",
    title: input.title,
    content: input.content,
    contentChunks: input.contentChunks ?? null,
    sourceType: input.sourceType ?? "manual",
    sourceUrl: input.sourceUrl ?? null,
    sourceName: input.sourceName ?? null,
    confidence: input.confidence ?? "verified",
    language: input.language ?? "ru",
    tags: input.tags ?? null,
    status: input.status ?? "active",
    approvedBy: input.approvedBy ?? null,
    createdAt: input.createdAt ?? UPDATED_AT,
    updatedAt: input.updatedAt ?? UPDATED_AT,
  };
}

const ENTRIES: NutriKnowledgeEntry[] = [
  knowledge({
    id: 660046,
    title: "Овечье молоко: новый источник кальция",
    content: "Овечье молоко содержит кальций и другие минералы.",
    tags: ["овечье молоко", "кальций", "минералы"],
  }),
  knowledge({
    id: 660049,
    title: "Овечье молоко: новый источник белка",
    content: "Овечье молоко является богатым источником белка.",
    tags: ["овечье молоко", "белок"],
  }),
  knowledge({
    id: 660047,
    title: "А2 казеин и аллергия на казеин",
    content: "Материал об A2-казеине и аллергических реакциях требует медицинской проверки.",
    confidence: "trusted",
    tags: ["A2", "казеин", "аллергия"],
  }),
  knowledge({
    id: 660045,
    title: "Козье молоко для людей с лактозной недостаточностью",
    content: "Материал о лактозе и непереносимости козьего молока.",
    tags: ["козье молоко", "лактоза", "непереносимость"],
  }),
  knowledge({
    id: 660050,
    category: "product_info",
    title: "Козий сыр: источник витаминов и минералов",
    content: "Козий сыр содержит витамины, кальций и фосфор.",
    tags: ["козий сыр", "витамины", "минералы"],
  }),
  knowledge({
    id: 660048,
    title: "Ферментированные молочные продукты и здоровье микробиома",
    content: "Ферментированные продукты могут влиять на микробиом кишечника.",
    tags: ["ферментированные продукты", "микробиом"],
  }),
  knowledge({
    id: 660055,
    category: "general",
    title: "Новости о микробиоме и ферментированных молочных продуктах",
    content: "Обзор исследований ферментированных продуктов и микробиома.",
    tags: ["ферментированные продукты", "микробиом"],
  }),
  knowledge({
    id: 10,
    category: "breed_profile",
    title: "Альпийская коза: нутриционный профиль молока",
    content: "Общий породный профиль без данных об овечьем молоке.",
  }),
];

describe("Zoya knowledge query normalization", () => {
  it("removes question words and normalizes Russian inflections", () => {
    expect(extractKnowledgeSearchTerms("Сколько кальция в овечьем молоке?")).toEqual([
      "кальц",
      "овеч",
      "молок",
    ]);
  });

  it("normalizes Cyrillic and Latin A2 into the same canonical term", () => {
    expect(extractKnowledgeSearchTerms("А2 казеин при аллергии")).toEqual([
      "a2",
      "казеин",
      "аллерг",
    ]);
    expect(extractKnowledgeSearchTerms("A2-casein и аллергия")).toContain("a2");
    expect(buildKnowledgeSearchPlan("А2 казеин").patterns).toEqual([
      "a2",
      "а2",
      "казеин",
    ]);
  });

  it("returns no terms for empty or stop-word-only input", () => {
    expect(extractKnowledgeSearchTerms("   ")).toEqual([]);
    expect(extractKnowledgeSearchTerms("и в на это")).toEqual([]);
  });
});

describe("Zoya knowledge ranking", () => {
  it.each([
    ["Сколько кальция в овечьем молоке?", 660046],
    ["Овечье молоко — сколько в нём белка?", 660049],
    ["Безопасен ли А2 казеин при аллергии на казеин?", 660047],
    ["Подходит ли козье молоко при непереносимости лактозы?", 660045],
    ["Какие витамины и минералы есть в козьем сыре?", 660050],
  ])("puts the relevant entry first for %s", (query, expectedId) => {
    expect(rankKnowledgeEntries(ENTRIES, query, 6)[0]?.id).toBe(expectedId);
  });

  it("retrieves both updated microbiome records", () => {
    const ids = rankKnowledgeEntries(
      ENTRIES,
      "Полезны ли ферментированные продукты для микробиома?",
      6,
    ).map((entry) => entry.id);

    expect(ids.slice(0, 2)).toEqual(expect.arrayContaining([660048, 660055]));
  });

  it("is stable when meaningful words change order", () => {
    const first = rankKnowledgeEntries(ENTRIES, "кальций овечье молоко", 4).map(
      (entry) => entry.id,
    );
    const second = rankKnowledgeEntries(ENTRIES, "молоко овечье кальций", 4).map(
      (entry) => entry.id,
    );

    expect(second).toEqual(first);
  });

  it("excludes non-active entries before ranking", () => {
    const archived = knowledge({
      id: 999001,
      title: "Овечье молоко: кальций",
      content: "Кальций в овечьем молоке.",
      status: "archived",
      updatedAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    const ids = rankKnowledgeEntries([archived, ...ENTRIES], "кальций овечье молоко", 6).map(
      (entry) => entry.id,
    );

    expect(ids).not.toContain(archived.id);
    expect(ids[0]).toBe(660046);
  });

  it("deduplicates exact title/content pairs and respects limit", () => {
    const duplicate = knowledge({
      ...ENTRIES[0],
      id: 999002,
      updatedAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    const results = rankKnowledgeEntries(
      [duplicate, ...ENTRIES],
      "кальций овечье молоко витамины сыр",
      2,
    );

    expect(results).toHaveLength(2);
    expect(results.filter((entry) => entry.title === ENTRIES[0].title)).toHaveLength(1);
  });

  it("exposes matched terms for retrieval diagnostics", () => {
    const [top] = scoreKnowledgeEntries(ENTRIES, "кальций овечье молоко");

    expect(top.entry.id).toBe(660046);
    expect(top.matchedTerms).toEqual(expect.arrayContaining(["кальц", "овеч", "молок"]));
    expect(top.titleMatches).toBe(3);
  });

  it("returns an empty result for an empty query or zero limit", () => {
    expect(rankKnowledgeEntries(ENTRIES, "", 6)).toEqual([]);
    expect(rankKnowledgeEntries(ENTRIES, "кальций", 0)).toEqual([]);
  });
});
