import { describe, expect, it } from "vitest";
import {
  buildGroundedAnimalCatalogReply,
  buildGroundedOwnershipReply,
  extractFamilySize,
  isFarmAnimalCatalogQuestion,
  isOwnershipRecommendationQuestion,
  type OwnershipAdvisorContext,
} from "./mashaOwnershipAdvisor";

const context: OwnershipAdvisorContext = {
  tiers: [
    {
      slug: "guest",
      name: "Гость фермы",
      sharePercent: 0,
      minAnimals: 0,
      monthlyFeeMinor: 0,
      planChangeFrequency: null,
      deliveryAddresses: 0,
      agedCheeseAccess: false,
    },
    {
      slug: "basic",
      name: "Базовый",
      sharePercent: 50,
      minAnimals: 1,
      monthlyFeeMinor: 750_000,
      planChangeFrequency: "quarterly",
      deliveryAddresses: 1,
      agedCheeseAccess: false,
    },
    {
      slug: "standard",
      name: "Стандартный",
      sharePercent: 100,
      minAnimals: 1,
      monthlyFeeMinor: 1_490_000,
      planChangeFrequency: "monthly",
      deliveryAddresses: 2,
      agedCheeseAccess: false,
    },
    {
      slug: "professional",
      name: "Профессиональный",
      sharePercent: 100,
      minAnimals: 3,
      monthlyFeeMinor: 39_900_000,
      planChangeFrequency: "weekly",
      deliveryAddresses: 5,
      agedCheeseAccess: true,
    },
  ],
  availableAnimals: [
    {
      name: "Мира",
      slug: "mira",
      species: "goat",
      breed: "Альпийская",
      availableSharePercents: [50],
    },
    {
      name: "Лола",
      slug: "Lola",
      species: "goat",
      breed: "Англо-нубийская",
      availableSharePercents: [],
    },
    {
      name: "Аврора",
      slug: "avrora",
      species: "goat",
      breed: "Англо-нубийская",
      availableSharePercents: [],
    },
    {
      name: "Руфа",
      slug: "Rufa",
      species: "sheep",
      breed: "Лакон",
      availableSharePercents: [50, 100],
    },
    {
      name: "Злата",
      slug: "zlata",
      species: "sheep",
      breed: "Остфризская",
      availableSharePercents: [],
    },
  ],
  products: [
    {
      minTier: "basic",
      species: "sheep",
      productType: "cheese",
      label: "Молодой овечий сыр",
      unit: "кг",
    },
  ],
};

describe("Masha grounded ownership advisor", () => {
  const question =
    "Маша, помоги выбрать план владения животным. Любим овечьи сыры. 4 члена семьи. С чего начать?";

  it("detects ownership intent and extracts family size", () => {
    expect(isOwnershipRecommendationQuestion(question)).toBe(true);
    expect(extractFamilySize(question)).toBe(4);
  });

  it("recommends only real tiers and currently available sheep", () => {
    const reply = buildGroundedOwnershipReply(question, context);

    expect(reply).toContain("Для семьи из 4 человек");
    expect(reply).toContain("«Базовый»");
    expect(reply).toContain("«Стандартный»");
    expect(reply).toContain("[Руфа](/animals/Rufa)");
    expect(reply).toContain("Лакон");
    expect(reply).not.toContain("выбрать Злату");
  });

  it("explicitly rejects the fabricated plan and avoids unsupported promises", () => {
    const reply = buildGroundedOwnershipReply(question, context);

    expect(reply).toContain("Отдельного тарифа по виду животного или составу семьи сейчас нет");
    expect(reply).not.toContain("План \"Овечья семья\"");
    expect(reply).not.toContain("будет принадлежать только вам");
    expect(reply).not.toContain("широкому спектру овечьих сыров");
    expect(reply).toContain("количество рассчитывается");
  });

  it("does not intercept unrelated farm questions", () => {
    expect(buildGroundedOwnershipReply("Как сегодня чувствует себя Мира?", context)).toBeNull();
    expect(isOwnershipRecommendationQuestion("С чего начать экскурсию по ферме?")).toBe(false);
  });

  it("asks for catalog follow-up instead of inventing an unavailable animal", () => {
    const reply = buildGroundedOwnershipReply(question, {
      ...context,
      availableAnimals: [],
    });

    expect(reply).toContain("нет свободной доли овцы");
    expect(reply).toContain("[актуальный каталог](/animals)");
  });
});

describe("Masha grounded farm animal catalog", () => {
  const question = "Хочу выбрать Козу. Какие у вас породы?";

  it("detects a farm-catalog question rather than a general breed question", () => {
    expect(isFarmAnimalCatalogQuestion(question)).toBe(true);
    expect(isFarmAnimalCatalogQuestion("Расскажи историю зааненской породы")).toBe(false);
  });

  it("lists only live goats, groups real breeds, and keeps sheep out", () => {
    const reply = buildGroundedAnimalCatalogReply(question, context);

    expect(reply).toContain("**Альпийская**");
    expect(reply).toContain("[Мира](/animals/mira)");
    expect(reply).toContain("**Англо-нубийская**");
    expect(reply).toContain("[Лола](/animals/Lola)");
    expect(reply).toContain("[Аврора](/animals/avrora)");
    expect(reply).not.toContain("Руфа");
    expect(reply).not.toContain("Злата");
    expect(reply).not.toContain("Зааненская коза (Мира)");
  });

  it("distinguishes publication from current share availability", () => {
    const reply = buildGroundedAnimalCatalogReply(question, context);

    expect(reply).toContain("доступна доля 50%");
    expect(reply).toContain("свободных долей сейчас нет");
  });
});
