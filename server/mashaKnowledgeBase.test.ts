import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for AI Masha's professional knowledge base.
 * Validates that the system prompt contains comprehensive breed information,
 * nutritional data, genetic research, and marketing context from authoritative sources.
 */

const faqChatPath = path.resolve(__dirname, "routers/faqChat.ts");
const faqChatContent = fs.readFileSync(faqChatPath, "utf-8");

// Extract the system prompt string
const promptMatch = faqChatContent.match(
  /const MASHA_SYSTEM_PROMPT = `([\s\S]*?)`;/
);
const systemPrompt = promptMatch ? promptMatch[1] : "";

describe("Masha Knowledge Base — Structure", () => {
  it("should have a non-empty system prompt", () => {
    expect(systemPrompt.length).toBeGreaterThan(1000);
  });

  it("should contain all major sections", () => {
    const sections = [
      "БАЗА ЗНАНИЙ",
      "ПОРОДЫ КОЗ",
      "ПОРОДЫ ОВЕЦ",
      "НУТРИЦИОЛОГИЯ МОЛОКА",
      "РЫНОЧНЫЙ КОНТЕКСТ",
      "ПРАВИЛА ОТВЕТОВ",
    ];
    for (const section of sections) {
      expect(systemPrompt).toContain(section);
    }
  });

  it("should define Masha's professional expertise", () => {
    expect(systemPrompt).toContain("профессионал");
    expect(systemPrompt).toContain("зоотехнии");
    expect(systemPrompt).toContain("нутрициологии");
  });
});

describe("Masha Knowledge Base — Farm Animals", () => {
  it("should list all 4 farm animals with correct breeds", () => {
    expect(systemPrompt).toContain("Мира — Зааненская коза");
    expect(systemPrompt).toContain("Лола — Англо-нубийская коза");
    expect(systemPrompt).toContain("Руфа — овца породы Лакон");
    expect(systemPrompt).toContain(
      "Злата — овца Казахской тонкорунной породы"
    );
  });

  it("should include animal slugs for linking", () => {
    expect(systemPrompt).toContain("slug: mira");
    expect(systemPrompt).toContain("slug: Lola");
    expect(systemPrompt).toContain("slug: Rufa");
    expect(systemPrompt).toContain("slug: zlata");
  });
});

describe("Masha Knowledge Base — Saanen Goat (Мира)", () => {
  it("should contain origin and history", () => {
    expect(systemPrompt).toContain("Заанен");
    expect(systemPrompt).toContain("Швейцария");
    expect(systemPrompt).toContain("голштинкой козьего мира");
    expect(systemPrompt).toContain("900 000 голов");
    expect(systemPrompt).toContain("80+ стран");
  });

  it("should contain milk productivity data with numbers", () => {
    expect(systemPrompt).toContain("838 кг");
    expect(systemPrompt).toContain("264-дневную лактацию");
    expect(systemPrompt).toContain("жирность 3.0-3.5%");
    expect(systemPrompt).toContain("белок 2.9-3.4%");
  });

  it("should contain genetic research data", () => {
    expect(systemPrompt).toContain("h² = 0.26");
    expect(systemPrompt).toContain("GWAS");
    expect(systemPrompt).toContain("Arnal et al., 2019");
  });

  it("should contain nutritional properties", () => {
    expect(systemPrompt).toContain("A2 бета-казеин");
    expect(systemPrompt).toContain("2 мкм vs 3.5 мкм");
    expect(systemPrompt).toContain("аскорбиновой кислоты");
  });

  it("should cite authoritative sources", () => {
    expect(systemPrompt).toContain("Mason's World Encyclopedia");
    expect(systemPrompt).toContain("FAO DAD-IS");
    expect(systemPrompt).toContain("CyberLeninka");
  });
});

describe("Masha Knowledge Base — Anglo-Nubian Goat (Лола)", () => {
  it("should contain origin and history", () => {
    expect(systemPrompt).toContain("Британская порода");
    expect(systemPrompt).toContain("Джамнапари");
    expect(systemPrompt).toContain("Зарайби");
    expect(systemPrompt).toContain("60+ стран");
  });

  it("should contain milk productivity data", () => {
    expect(systemPrompt).toContain("4.7-8.5%");
    expect(systemPrompt).toContain("8.25 кг");
    expect(systemPrompt).toContain("2500 кг");
  });

  it("should contain exterior description", () => {
    expect(systemPrompt).toContain("римский нос");
    expect(systemPrompt).toContain("висячие уши");
    expect(systemPrompt).toContain("140 кг");
  });

  it("should contain character traits", () => {
    expect(systemPrompt).toContain("Общительная");
    expect(systemPrompt).toContain("разговорчивостью");
  });
});

describe("Masha Knowledge Base — Lacaune Sheep (Руфа)", () => {
  it("should contain origin and Roquefort connection", () => {
    expect(systemPrompt).toContain("Лакон на юге Франции");
    expect(systemPrompt).toContain("Рокфор");
    expect(systemPrompt).toContain("PDO");
    expect(systemPrompt).toContain("Сектор Рокфора");
  });

  it("should contain milk productivity data", () => {
    expect(systemPrompt).toContain("400-500 литров");
    expect(systemPrompt).toContain("жирность 7.10-7.75%");
    expect(systemPrompt).toContain("белок 5.62-5.78%");
  });

  it("should contain genetic information", () => {
    expect(systemPrompt).toContain("генетический тренд достиг 24%");
    expect(systemPrompt).toContain("Barillet et al., 2001");
  });

  it("should contain reproductive data", () => {
    expect(systemPrompt).toContain("1.8-2 ягнёнка");
    expect(systemPrompt).toContain("2.5 ягнят на овцу");
  });
});

describe("Masha Knowledge Base — Kazakh Fine-wool Sheep (Злата)", () => {
  it("should contain origin and history", () => {
    expect(systemPrompt).toContain("1931-1946");
    expect(systemPrompt).toContain("Казахстан");
    expect(systemPrompt).toContain("Бальмонт");
    expect(systemPrompt).toContain("курдючных овец");
  });

  it("should contain productivity data", () => {
    expect(systemPrompt).toContain("100-120 кг");
    expect(systemPrompt).toContain("Настриг шерсти");
    expect(systemPrompt).toMatch(/4\.5-5\.5 кг/i);
  });

  it("should contain wool quality data", () => {
    expect(systemPrompt).toContain("19.5-20.5 мкм");
    expect(systemPrompt).toContain("Мериносов");
  });

  it("should contain adaptability information", () => {
    expect(systemPrompt).toContain("400+ км");
    expect(systemPrompt).toContain("полуаридных");
  });
});

describe("Masha Knowledge Base — Milk Nutrition", () => {
  it("should contain comparative milk composition table", () => {
    expect(systemPrompt).toContain("Козье");
    expect(systemPrompt).toContain("Коровье");
    expect(systemPrompt).toContain("Овечье");
    expect(systemPrompt).toContain("193"); // calcium in sheep milk
    expect(systemPrompt).toContain("134"); // calcium in goat milk
    expect(systemPrompt).toContain("119"); // calcium in cow milk
  });

  it("should contain A2 casein information", () => {
    expect(systemPrompt).toContain("A2 бета-казеин");
    expect(systemPrompt).toContain("A1 бета-казеин");
    expect(systemPrompt).toContain("BCM-7");
    expect(systemPrompt).toContain("93%");
  });

  it("should contain sheep milk bioactive compounds", () => {
    expect(systemPrompt).toContain("лактоферрин");
    expect(systemPrompt).toContain("CLA");
    expect(systemPrompt).toContain("оротовую кислоту");
    expect(systemPrompt).toContain("PRP");
  });

  it("should cite PMC research", () => {
    expect(systemPrompt).toContain("Flis & Molik, 2021");
    expect(systemPrompt).toContain("PMC8122369");
  });
});

describe("Masha Knowledge Base — Market Context", () => {
  it("should contain market size data", () => {
    expect(systemPrompt).toContain("$10.5 млрд");
    expect(systemPrompt).toContain("CAGR");
  });

  it("should contain marketing advantages", () => {
    expect(systemPrompt).toContain("Гипоаллергенность");
    expect(systemPrompt).toContain("Функциональное питание");
    expect(systemPrompt).toContain("Anti-aging");
  });
});

describe("Masha Knowledge Base — Response Rules", () => {
  it("should instruct professional responses for breed questions", () => {
    expect(systemPrompt).toContain(
      "развёрнутые профессиональные ответы"
    );
    expect(systemPrompt).toContain("ссылками на источники");
  });

  it("should instruct using animal names when mentioned", () => {
    expect(systemPrompt).toContain(
      "используй его имя и привязывай к породе"
    );
  });

  it("should maintain warm but professional tone", () => {
    expect(systemPrompt).toContain("тепло и с заботой");
    expect(systemPrompt).toContain("на «вы»");
  });

  it("should not contain old breeds that are no longer on the farm", () => {
    // The old prompt had Альпийская and Остфриз which are not in the DB
    expect(systemPrompt).not.toContain("Альпийская коза");
    expect(systemPrompt).not.toContain("Остфриз");
  });
});
