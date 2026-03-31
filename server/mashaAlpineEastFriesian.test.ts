import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read the faqChat.ts file to extract the system prompt
const faqChatSource = readFileSync(
  resolve(__dirname, "routers/faqChat.ts"),
  "utf-8"
);

describe("AI Masha Knowledge Base — Alpine Goat", () => {
  it("contains Alpine goat breed section", () => {
    expect(faqChatSource).toContain("Альпийская коза");
  });

  it("contains Alpine origin from French Alps", () => {
    expect(faqChatSource).toContain("Французских Альп");
    expect(faqChatSource).toContain("Alpine polychrome");
  });

  it("contains Pashang/Bezoar ancestor history", () => {
    expect(faqChatSource).toContain("Пашанг");
    expect(faqChatSource).toContain("безоарового козла");
    expect(faqChatSource).toContain("12-15 тыс. лет");
  });

  it("contains 1922 Delangle importation history", () => {
    expect(faqChatSource).toContain("1922");
    expect(faqChatSource).toContain("Деланж");
    expect(faqChatSource).toContain("22 французских альпийских");
  });

  it("contains 8 recognized color patterns", () => {
    expect(faqChatSource).toContain("8 признанных окрасов");
    expect(faqChatSource).toContain("Cou Blanc");
    expect(faqChatSource).toContain("Cou Clair");
    expect(faqChatSource).toContain("Cou Noir");
    expect(faqChatSource).toContain("Sundgau");
    expect(faqChatSource).toContain("Chamoisée");
  });

  it("contains Alpine milk production data", () => {
    expect(faqChatSource).toContain("968 кг");
    expect(faqChatSource).toContain("780-850 кг/год");
    expect(faqChatSource).toContain("3.4-3.8%");
  });

  it("contains CSN3/VneI kappa-casein genetics", () => {
    expect(faqChatSource).toContain("CSN3/VneI");
    expect(faqChatSource).toContain("Селионовой М.И.");
    expect(faqChatSource).toContain("генотип CC");
    expect(faqChatSource).toContain("генотип CT");
    expect(faqChatSource).toContain("генотип TT");
  });

  it("contains CSN1S1 alpha-S1 casein genetics", () => {
    expect(faqChatSource).toContain("CSN1S1");
    expect(faqChatSource).toContain("аллель E");
    expect(faqChatSource).toContain("30-40% больше белка");
  });

  it("contains Alpine MCT and bioactive data", () => {
    expect(faqChatSource).toContain("MCT");
    expect(faqChatSource).toContain("15-18%");
    expect(faqChatSource).toContain("таурин");
    expect(faqChatSource).toContain("олигосахариды");
    expect(faqChatSource).toContain("сиаловая кислота");
  });

  it("contains Alpine character description", () => {
    expect(faqChatSource).toContain("alertly graceful");
    expect(faqChatSource).toContain("своенравная");
  });

  it("contains authoritative sources for Alpine", () => {
    expect(faqChatSource).toContain("Alpines International Club");
    expect(faqChatSource).toContain("ADGA");
    expect(faqChatSource).toContain("IDELE");
    expect(faqChatSource).toContain("Crepaldi");
  });
});

describe("AI Masha Knowledge Base — East Friesian Sheep", () => {
  it("contains East Friesian breed section", () => {
    expect(faqChatSource).toContain("Ост-фризская");
    expect(faqChatSource).toContain("Восточно-фризская");
  });

  it("contains Friesland origin and geography", () => {
    expect(faqChatSource).toContain("Фрисландия");
    expect(faqChatSource).toContain("Северного моря");
    expect(faqChatSource).toContain("Везер");
    expect(faqChatSource).toContain("Шельда");
  });

  it("contains family of Friesian breeds", () => {
    expect(faqChatSource).toContain("Deutsches Friesisches Milchschaf");
    expect(faqChatSource).toContain("Fries Melkschaap");
    expect(faqChatSource).toContain("Zeeuwes Melkschaap");
  });

  it("contains connection to Holstein cattle", () => {
    expect(faqChatSource).toContain("Голштинская порода");
    expect(faqChatSource).toContain("рекордные удои");
  });

  it("contains rat-tail distinctive feature", () => {
    expect(faqChatSource).toContain("крысиный хвост");
    expect(faqChatSource).toContain("rat-tail");
  });

  it("contains East Friesian as highest-producing dairy sheep", () => {
    expect(faqChatSource).toContain("САМАЯ продуктивная молочная порода овец");
    expect(faqChatSource).toContain("500-700 кг");
    expect(faqChatSource).toContain("220-230 дней");
  });

  it("contains East Friesian milk composition", () => {
    expect(faqChatSource).toContain("6.0-7.0%");
    expect(faqChatSource).toContain("5.5-6.0%");
    expect(faqChatSource).toContain("17-19%");
    expect(faqChatSource).toContain("18-25%");
  });

  it("contains Assaf crossbreeding data", () => {
    expect(faqChatSource).toContain("Ассаф");
    expect(faqChatSource).toContain("Авасси");
    expect(faqChatSource).toContain("Eyal et al.");
    expect(faqChatSource).toContain("+102%");
    expect(faqChatSource).toContain("+122%");
  });

  it("contains East Friesian genetics — genome and PrP", () => {
    expect(faqChatSource).toContain("You et al., PMC");
    expect(faqChatSource).toContain("PrP");
    expect(faqChatSource).toContain("ARR/ARR");
    expect(faqChatSource).toContain("скрейпи");
  });

  it("contains LEP gene research", () => {
    expect(faqChatSource).toContain("LEP");
    expect(faqChatSource).toContain("лептин");
    expect(faqChatSource).toContain("LEPTT");
    expect(faqChatSource).toContain("Карпова");
  });

  it("contains East Friesian A2 milk and bioactive data", () => {
    expect(faqChatSource).toContain("ЕСТЕСТВЕННО A2 молоко");
    expect(faqChatSource).toContain("Оротовая кислота");
    expect(faqChatSource).toContain("Вакценовая кислота");
    expect(faqChatSource).toContain("каприновая кислота");
  });

  it("contains East Friesian adaptability notes", () => {
    expect(faqChatSource).toContain("Высокоспециализированная порода");
    expect(faqChatSource).toContain("интенсивных систем");
  });

  it("contains authoritative sources for East Friesian", () => {
    expect(faqChatSource).toContain("Oklahoma State University");
    expect(faqChatSource).toContain("NZ Sheepbreeders");
    expect(faqChatSource).toContain("De Vries et al.");
    expect(faqChatSource).toContain("Flis et al.");
  });
});

describe("AI Masha Knowledge Base — All 6 breeds present", () => {
  it("contains all 6 breed sections", () => {
    // Goats
    expect(faqChatSource).toContain("Зааненская");
    expect(faqChatSource).toContain("Англо-нубийская");
    expect(faqChatSource).toContain("Альпийская коза");
    // Sheep
    expect(faqChatSource).toContain("Лакон");
    expect(faqChatSource).toContain("Казахская тонкорунная");
    expect(faqChatSource).toContain("Ост-фризская");
  });

  it("contains both goat and sheep breed sections", () => {
    expect(faqChatSource).toContain("═══ ПОРОДЫ КОЗ ═══");
    expect(faqChatSource).toContain("═══ ПОРОДЫ ОВЕЦ ═══");
  });

  it("contains nutrition section", () => {
    expect(faqChatSource).toContain("═══ НУТРИЦИОЛОГИЯ МОЛОКА ═══");
  });
});
