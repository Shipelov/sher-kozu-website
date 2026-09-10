import { beforeEach, describe, expect, it, vi } from "vitest";

const listPublicAnimalsMock = vi.hoisted(() => vi.fn());
const getAnimalBySlugMock = vi.hoisted(() => vi.fn());
const getDbMock = vi.hoisted(() => vi.fn());
const listActiveKnowledgeByCategoryMock = vi.hoisted(() => vi.fn());
const searchAssistantKnowledgeMock = vi.hoisted(() => vi.fn());
const calculateSharePricingMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({
  listPublicAnimals: listPublicAnimalsMock,
  getAnimalBySlug: getAnimalBySlugMock,
  getDb: getDbMock,
}));

vi.mock("../assistantKnowledgeDb", () => ({
  ASSISTANT_KNOWLEDGE_CATEGORIES: ["farm", "breeds", "delivery", "general"],
  listActiveKnowledgeByCategory: listActiveKnowledgeByCategoryMock,
  searchAssistantKnowledge: searchAssistantKnowledgeMock,
}));

vi.mock("../routers/pricing", () => ({
  calculateSharePricing: calculateSharePricingMock,
}));

import { ENV } from "../_core/env";
import {
  MASHA_GUEST_TOOLS,
  SEARCH_KNOWLEDGE_CONTENT_MAX_CHARS,
  SEARCH_KNOWLEDGE_LIMIT,
  animalUrl,
  calculateShare,
  compactKnowledgeContent,
  getAnimal,
  getDeliveryInfo,
  getFarmInfo,
  getMyAnimals,
  listAnimals,
  mapBreedToCalculator,
  mashaToolsFor,
  searchKnowledge,
} from "./mashaTools";

const guest = { userOpenId: null };

function animal(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    // Публичный каталог фильтруется по OWNER_OPEN_ID (в CI задан)
    ownerOpenId: ENV.ownerOpenId || "farm-owner",
    name: "Руфа",
    slug: "rufa",
    species: "sheep",
    breed: "Лакон",
    status: "public_available",
    shortDescription: "Спокойная овца",
    story: "История",
    birthDate: new Date("2022-03-01"),
    availablePercent: 100,
    shareUnitPercent: 50,
    shareUnitPriceMinor: 750_000,
    fullPriceMinor: 1_500_000,
    availableSharePercents: [50, 100],
    ownersCount: 0,
    mySharePercent: 0,
    plans: [{ name: "Базовый", description: "д", durations: [{ months: 12, priceMinor: 9_000_000, label: "год" }] }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  listPublicAnimalsMock.mockResolvedValue([
    animal(),
    animal({ id: 2, name: "Мира", slug: "mira", species: "goat", breed: "Англо-нубийская", availablePercent: 0, status: "fully_booked" }),
  ]);
  getDbMock.mockResolvedValue(null);
});

describe("list_animals", () => {
  it("returns the compact live catalog with site URLs and breeds", async () => {
    const result = (await listAnimals.handler({}, guest)) as { total: number; breeds: string[]; animals: Array<{ url: string; status: string }>; catalogUrl: string };
    expect(result.total).toBe(2);
    expect(result.breeds).toEqual(["Лакон", "Англо-нубийская"]);
    expect(result.animals[0].url).toBe("/animal/rufa");
    expect(result.animals[1].status).toBe("все доли заняты");
    expect(result.catalogUrl).toBe("/animals");
  });

  it("filters by species and availability", async () => {
    const goats = (await listAnimals.handler({ species: "goat" }, guest)) as { total: number };
    expect(goats.total).toBe(1);
    const available = (await listAnimals.handler({ availableOnly: true }, guest)) as { animals: Array<{ slug: string }> };
    expect(available.animals.map((item) => item.slug)).toEqual(["rufa"]);
  });
});

describe("get_animal", () => {
  it("returns the profile with plans for a public animal", async () => {
    getAnimalBySlugMock.mockResolvedValue(animal());
    const result = (await getAnimal.handler({ slug: "rufa" }, guest)) as { found: boolean; url: string; plans: Array<{ durations: Array<{ priceRub: number | null }> }>; fullMonthlyPriceRub: number };
    expect(getAnimalBySlugMock).toHaveBeenCalledWith("rufa", null);
    expect(result.found).toBe(true);
    expect(result.url).toBe(animalUrl("rufa"));
    expect(result.fullMonthlyPriceRub).toBe(15_000);
    expect(result.plans[0].durations[0].priceRub).toBe(90_000);
  });

  it("hides animals that are not in the public catalog", async () => {
    getAnimalBySlugMock.mockResolvedValue(animal({ status: "hidden" }));
    const hidden = (await getAnimal.handler({ slug: "rufa" }, guest)) as { found: boolean };
    expect(hidden.found).toBe(false);

    getAnimalBySlugMock.mockResolvedValue(null);
    const missing = (await getAnimal.handler({ slug: "nope" }, guest)) as { found: boolean; hint: string };
    expect(missing.found).toBe(false);
    expect(missing.hint).toContain("list_animals");
  });
});

describe("calculate_share", () => {
  it("maps the catalog breed to the calculator and never logs a calculator session", async () => {
    getAnimalBySlugMock.mockResolvedValue(animal());
    calculateSharePricingMock.mockResolvedValue({
      breed: "Овца Лакон",
      myAnnualMilk: 175,
      tierName: "Базовый",
      monthlyFeeRub: 7500,
      annualFeeRub: 90_000,
      totalMarketValueRub: 120_000,
      annualSavingsRub: 30_000,
      savingsPercent: 25,
    });

    const result = (await calculateShare.handler({ slug: "rufa", percent: 50 }, guest)) as {
      found: boolean;
      catalogMonthlyPriceRub: number;
      calculator: { breedApproximated: boolean; annualSavingsRub: number };
      calculatorUrl: string;
    };

    expect(calculateSharePricingMock).toHaveBeenCalledWith(
      expect.objectContaining({ breed: "lacaune", sharePercent: 50 }),
      { logSession: false },
    );
    expect(result.found).toBe(true);
    expect(result.catalogMonthlyPriceRub).toBe(7_500);
    expect(result.calculator.breedApproximated).toBe(false);
    expect(result.calculator.annualSavingsRub).toBe(30_000);
    expect(result.calculatorUrl).toBe("/pricing/calculator");
  });

  it("charges two share units for a 100% share", async () => {
    getAnimalBySlugMock.mockResolvedValue(animal());
    calculateSharePricingMock.mockResolvedValue({ breed: "x", myAnnualMilk: 1, tierName: "t", monthlyFeeRub: 1, annualFeeRub: 1, totalMarketValueRub: 1, annualSavingsRub: 1, savingsPercent: 1 });
    const result = (await calculateShare.handler({ slug: "rufa", percent: 100 }, guest)) as { catalogMonthlyPriceRub: number };
    expect(result.catalogMonthlyPriceRub).toBe(15_000);
  });

  it("maps unknown breeds by species and flags the approximation", () => {
    expect(mapBreedToCalculator("Зааненская", "goat")).toEqual({ breed: "alpine", approximated: true });
    expect(mapBreedToCalculator("Казахская тонкорунная", "sheep")).toEqual({ breed: "lacaune", approximated: true });
    expect(mapBreedToCalculator("Остфризская овца", "sheep")).toEqual({ breed: "east-friesian", approximated: false });
  });
});

describe("knowledge tools", () => {
  it("get_farm_info reads the farm category and adds site links", async () => {
    listActiveKnowledgeByCategoryMock.mockResolvedValue([{ title: "О ферме", content: "Семейная ферма" }]);
    const result = (await getFarmInfo.handler({}, guest)) as { entries: Array<{ title: string }>; links: { catalog: string } };
    expect(listActiveKnowledgeByCategoryMock).toHaveBeenCalledWith("masha", "farm");
    expect(result.entries[0].title).toBe("О ферме");
    expect(result.links.catalog).toBe("/animals");
  });

  it("get_delivery_info reads the delivery category", async () => {
    listActiveKnowledgeByCategoryMock.mockResolvedValue([]);
    await getDeliveryInfo.handler({}, guest);
    expect(listActiveKnowledgeByCategoryMock).toHaveBeenCalledWith("masha", "delivery");
  });

  it("search_knowledge returns only scored entries", async () => {
    searchAssistantKnowledgeMock.mockResolvedValue([
      { title: "Лакон", category: "breeds", content: "...", score: 8 },
      { title: "Ценности", category: "values", content: "...", score: 0 },
    ]);
    const result = (await searchKnowledge.handler({ query: "чем знамениты лаконы" }, guest)) as { results: Array<{ title: string }> };
    expect(searchAssistantKnowledgeMock).toHaveBeenCalledWith("masha", "чем знамениты лаконы", { category: undefined, limit: SEARCH_KNOWLEDGE_LIMIT });
    expect(SEARCH_KNOWLEDGE_LIMIT).toBe(3);
    expect(result.results.map((item) => item.title)).toEqual(["Лакон"]);
  });

  it("search_knowledge returns compact plain text: markdown stripped, content capped, size logged", async () => {
    const longBreed = "### Лакон\n\n**Происхождение:** Франция, регион Рокфор.\n- Молочная порода\n- [сыр](https://example.invalid) Рокфор\n\n" + "Удой за лактацию 250–300 литров. ".repeat(120);
    searchAssistantKnowledgeMock.mockResolvedValue([{ title: "Лакон", category: "breeds", content: longBreed, score: 9 }]);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = (await searchKnowledge.handler({ query: "лаконы" }, guest)) as { results: Array<{ content: string }> };
    const content = result.results[0].content;

    expect(content.length).toBeLessThanOrEqual(SEARCH_KNOWLEDGE_CONTENT_MAX_CHARS + 1);
    expect(content.endsWith("…")).toBe(true);
    expect(content).not.toContain("###");
    expect(content).not.toContain("**");
    expect(content).not.toContain("](");
    expect(content).toContain("Происхождение: Франция");
    expect(content).toContain("сыр Рокфор");
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(6_000);
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/^\[masha:search_knowledge\] results=1 bytes=\d+$/));
  });
});

describe("compactKnowledgeContent", () => {
  it("keeps short plain text as is and normalizes whitespace", () => {
    expect(compactKnowledgeContent("Первая строка.\r\n\r\n\r\nВторая   строка.")).toBe("Первая строка.\nВторая строка.");
  });

  it("cuts at a sentence boundary and appends an ellipsis", () => {
    const text = "Предложение номер один. ".repeat(200);
    const compact = compactKnowledgeContent(text, 300);
    expect(compact.length).toBeLessThanOrEqual(301);
    expect(compact.endsWith(".…")).toBe(true);
  });
});

describe("get_my_animals and tool sets", () => {
  it("is unavailable to guests and reports it", async () => {
    const result = (await getMyAnimals.handler({}, guest)) as { authenticated: boolean };
    expect(result.authenticated).toBe(false);
    expect(mashaToolsFor(guest).map((tool) => tool.name)).not.toContain("get_my_animals");
    expect(mashaToolsFor(guest)).toHaveLength(MASHA_GUEST_TOOLS.length);
  });

  it("is added for authenticated users", () => {
    const names = mashaToolsFor({ userOpenId: "u1" }).map((tool) => tool.name);
    expect(names).toContain("get_my_animals");
    expect(names).toEqual(expect.arrayContaining(["get_farm_info", "list_animals", "get_animal", "get_pricing_tiers", "calculate_share", "search_knowledge", "get_delivery_info"]));
  });

  it("every tool has a valid JSON schema and a description", () => {
    for (const tool of mashaToolsFor({ userOpenId: "u1" })) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.safeParse({}).success || tool.name === "get_animal" || tool.name === "calculate_share" || tool.name === "search_knowledge").toBe(true);
    }
  });
});
