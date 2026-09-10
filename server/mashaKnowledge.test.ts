import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseKnowledgeMarkdown, defaultKnowledgePath } from "../scripts/seed-assistant-knowledge.mjs";
import { ASSISTANT_KNOWLEDGE_CATEGORIES, scoreKnowledgeEntry, tokenizeKnowledgeQuery } from "./assistantKnowledgeDb";
import { MASHA_PROMPT_MAX_CHARS, MASHA_SYSTEM_PROMPT, buildMashaSystemPrompt } from "./assistants/mashaPrompt";

const ANIMAL_NAMES = ["Руфа", "Злата", "Мира", "Лола", "Аврора"];

type Entry = { assistant: string; category: string; title: string; content: string; tags: string[]; sortOrder: number };

const markdown = readFileSync(defaultKnowledgePath(), "utf8");
const entries = parseKnowledgeMarkdown(markdown) as Entry[];

describe("seed-assistant-knowledge: разбор masha-knowledge.md", () => {
  it("указывает на файл базы знаний Маши", () => {
    expect(path.basename(defaultKnowledgePath())).toBe("masha-knowledge.md");
  });

  it("раскладывает секции по категориям, известным серверу", () => {
    const categories = new Set(entries.map((entry) => entry.category));
    for (const category of categories) {
      expect(ASSISTANT_KNOWLEDGE_CATEGORIES).toContain(category);
    }
    expect(categories).toEqual(new Set(["farm", "breeds", "nutrition", "market", "products", "delivery", "club", "platform", "audience", "values"]));
  });

  it("делает по записи на породу и общие записи для ферм/продуктов/доставки", () => {
    const breeds = entries.filter((entry) => entry.category === "breeds").map((entry) => entry.title);
    expect(breeds).toEqual([
      "Зааненская коза",
      "Англо-нубийская коза",
      "Альпийская коза",
      "Лакон",
      "Казахская тонкорунная",
      "Ост-фризская (Восточно-фризская) овца",
    ]);
    expect(entries.filter((entry) => entry.category === "farm").map((entry) => entry.title)).toEqual(["О ферме", "Как это работает (3 шага)"]);
    const delivery = entries.find((entry) => entry.category === "delivery");
    expect(delivery?.content).toContain("Москв");
  });

  it("ключ (assistant, category, title) уникален — сид идемпотентен", () => {
    const keys = entries.map((entry) => `${entry.assistant}|${entry.category}|${entry.title}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(entries.every((entry) => entry.assistant === "masha")).toBe(true);
    expect(entries.every((entry) => entry.content.length > 0 && entry.title.length <= 255)).toBe(true);
  });

  it("имена животных остаются в живом каталоге, а не в базе знаний и промпте", () => {
    for (const name of ANIMAL_NAMES) {
      expect(markdown).not.toContain(name);
      expect(MASHA_SYSTEM_PROMPT).not.toContain(name);
    }
  });

  it("повторный разбор даёт тот же результат", () => {
    expect(parseKnowledgeMarkdown(markdown)).toEqual(entries);
  });

  it("теги породы ищутся по виду животного", () => {
    const lacaune = entries.find((entry) => entry.title === "Лакон");
    expect(lacaune?.tags).toEqual(expect.arrayContaining(["порода", "овца", "лакон"]));
  });
});

describe("search_knowledge: токенизация и ранжирование", () => {
  it("режет окончания, чтобы «лаконы» находили «Лакон»", () => {
    const tokens = tokenizeKnowledgeQuery("Чем знамениты Лаконы?");
    expect(tokens).toContain("лако");
    expect(tokens).not.toContain("чем");
  });

  it("совпадение по заголовку весит больше, чем по тексту", () => {
    const tokens = tokenizeKnowledgeQuery("лаконы");
    const lacaune = entries.find((entry) => entry.title === "Лакон")!;
    const values = entries.find((entry) => entry.category === "values")!;
    expect(scoreKnowledgeEntry(lacaune, tokens)).toBeGreaterThan(scoreKnowledgeEntry(values, tokens));
    expect(scoreKnowledgeEntry(values, tokens)).toBe(0);
  });
});

describe("промпт Маши", () => {
  it("короче лимита и содержит ключевые правила", () => {
    expect(MASHA_SYSTEM_PROMPT.length).toBeLessThan(MASHA_PROMPT_MAX_CHARS);
    expect(MASHA_SYSTEM_PROMPT).toContain("только из инструментов");
    expect(MASHA_SYSTEM_PROMPT).toContain("/nutritionist");
    expect(MASHA_SYSTEM_PROMPT).toContain("get_my_animals");
    expect(MASHA_SYSTEM_PROMPT).toContain("[текст](url)");
  });

  it("персонализируется именем, страницей и режимом гость/владелец", () => {
    const guest = buildMashaSystemPrompt({ isAuthenticated: false });
    expect(guest).toContain("гость");
    const owner = buildMashaSystemPrompt({ isAuthenticated: true, userName: "Анна", currentPage: "/animals" });
    expect(owner).toContain("Собеседника зовут Анна");
    expect(owner).toContain("/animals");
    expect(owner).toContain("авторизован");
  });
});
