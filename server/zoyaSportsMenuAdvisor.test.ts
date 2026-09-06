import { describe, expect, it } from "vitest";
import type { ZoyaUserContext } from "./prompts/zoyaSystemPrompt";
import {
  buildGroundedSportsMenuReply,
  extractSportsFacts,
  isSportsMenuQuestion,
  type ZoyaConversationMessage,
} from "./zoyaSportsMenuAdvisor";

const firstQuestion =
  "Какой у меня оптимальный рацион из моих сыров на день с высокими спортивными нагрузками";
const followUpQuestion =
  "я хочу использовать 20% своей молочной продукции в дневном рационе. Хочу поддерживать необходимый баланс для роста мышц. Провожу 1 час в зале силовые тренировки. Мне 47 лет. Рост 174, Вес 102. Сделай сбалансированное меню на день";

function ownerContext(overrides?: Partial<ZoyaUserContext>): ZoyaUserContext {
  return {
    userType: "owner",
    userName: "Владелец",
    messageCountInSession: 1,
    ownerContext: {
      animals: [
        {
          animalName: "Мира",
          animalSlug: "mira",
          species: "goat",
          breed: "Альпийская",
          milkComposition: [],
          monthlyMetrics: [],
          annualMilkLiters: null,
          availableProducts: [
            { label: "Козий камамбер", type: "camembert", unit: "кг" },
            { label: "Выдержанный козий сыр", type: "aged_cheese", unit: "кг" },
          ],
        },
      ],
      productPlans: [
        {
          status: "confirmed",
          selectionsJson: JSON.stringify([
            { label: "Качотта из козьего молока", productType: "kachotta", annualUnits: 4, unit: "кг" },
          ]),
        },
      ],
      deliveries: [],
    },
    ...overrides,
  };
}

describe("Zoya sports-menu intent and fact extraction", () => {
  it("recognizes both user formulations as sports-menu questions", () => {
    expect(isSportsMenuQuestion(firstQuestion)).toBe(true);
    expect(isSportsMenuQuestion(followUpQuestion)).toBe(true);
    expect(isSportsMenuQuestion("Какие у вас породы коз?")).toBe(false);
  });

  it("uses the latest explicitly stated age, height and weight from the dialogue", () => {
    const messages: ZoyaConversationMessage[] = [
      { role: "user", content: "Мне 35 лет, рост 180, вес 90. Составь спортивный рацион." },
      { role: "assistant", content: "Черновой ответ." },
      { role: "user", content: followUpQuestion },
    ];

    expect(extractSportsFacts(messages)).toEqual({
      age: 47,
      heightCm: 174,
      weightKg: 102,
      trainingMinutes: 60,
      dairySharePercent: 20,
    });
  });
});

describe("Zoya grounded sports menu", () => {
  it("answers the exact follow-up without an LLM and builds a balanced day", () => {
    const reply = buildGroundedSportsMenuReply(
      [
        { role: "user", content: firstQuestion },
        { role: "assistant", content: "Старый несбалансированный ответ." },
        { role: "user", content: followUpQuestion },
      ],
      ownerContext(),
    );

    expect(reply).not.toBeNull();
    expect(reply).toContain("47 лет");
    expect(reply).toContain("рост 174 см");
    expect(reply).toContain("вес 102 кг");
    expect(reply).toContain("143–163 г/сутки");
    expect(reply).toContain("20% молочной продукции");
    expect(reply).toContain("неоднозначна");
    expect(reply).toContain("Качотта из козьего молока");
    expect(reply).toContain("Сыр во время занятия не нужен");
    expect(reply).toContain("рыба/птица/яйца/бобовые");
    expect(reply).not.toContain("Ой, что-то пошло не так");
  });

  it("uses only cheeses from confirmed product plans, not merely available products", () => {
    const reply = buildGroundedSportsMenuReply(
      [{ role: "user", content: firstQuestion }],
      ownerContext(),
    )!;

    expect(reply).toContain("Качотта из козьего молока");
    expect(reply).not.toContain("Козий камамбер");
    expect(reply).not.toContain("Выдержанный козий сыр");
    expect(reply).not.toContain("Пекорино");
    expect(reply).not.toContain("КБЖУ: 264");
    expect(reply).not.toContain("1 порция (100 г)");
  });

  it("does not invent a cheese when the owner has no confirmed readable selection", () => {
    const context = ownerContext({
      ownerContext: {
        ...ownerContext().ownerContext!,
        productPlans: [{ status: "draft", selectionsJson: "not-json" }],
      },
    });

    const reply = buildGroundedSportsMenuReply(
      [{ role: "user", content: firstQuestion }],
      context,
    )!;

    expect(reply).toContain("не вижу читаемого списка ваших сыров");
    expect(reply).not.toContain("Козий камамбер");
    expect(reply).not.toContain("Выдержанный козий сыр");
  });

  it("includes a health disclaimer and avoids diagnosing the user", () => {
    const reply = buildGroundedSportsMenuReply(
      [{ role: "user", content: followUpQuestion }],
      ownerContext(),
    )!;

    expect(reply).toContain("не медицинское назначение");
    expect(reply).toContain("заболеваниях почек");
    expect(reply).toContain("согласовать с врачом");
    expect(reply).not.toMatch(/у вас (?:ожирение|диабет|гипертония)/i);
  });

  it("returns null for a non-sports nutrition question", () => {
    expect(
      buildGroundedSportsMenuReply(
        [{ role: "user", content: "Какие витамины есть в козьем молоке?" }],
        ownerContext(),
      ),
    ).toBeNull();
  });
});
