import { describe, expect, it } from "vitest";
import type { ZoyaUserContext } from "./zoyaSportsMenuAdvisor";
import {
  buildGroundedSportsMenuReply,
  extractSportsFacts,
  isDairyMenuQuestion,
  isSportsMenuConversation,
  isSportsMenuQuestion,
  type ZoyaConversationMessage,
} from "./zoyaSportsMenuAdvisor";

const firstQuestion =
  "Какой у меня оптимальный рацион из моих сыров на день с высокими спортивными нагрузками";
const followUpQuestion =
  "я хочу использовать 20% своей молочной продукции в дневном рационе. Хочу поддерживать необходимый баланс для роста мышц. Провожу 1 час в зале силовые тренировки. Мне 47 лет. Рост 174, Вес 102. Сделай сбалансированное меню на день";
const productionFirstQuestion =
  "Зоя, хочу использовать 30% своей молочной продукции в рационе питания. Наращиваю мышцы и хожу в день на 1 час активной силовой тренировки. Сделай дневное меню";
const productionFollowUp =
  "Ты знаешь мои сыры. Выбери из них. Мой рост 174, вес 102, возраст 47";

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

  it("recognizes a product-selection follow-up from the preceding sports-menu context", () => {
    expect(
      isSportsMenuConversation([
        { role: "user", content: productionFirstQuestion },
        { role: "assistant", content: "Предварительная структура меню" },
        { role: "user", content: productionFollowUp },
      ]),
    ).toBe(true);
    expect(isSportsMenuQuestion(productionFollowUp)).toBe(false);
  });

  it("recognizes a standalone dairy-share menu without sports keywords", () => {
    const question = "Сделай мне дневное меню, в рационе которого будет 30% моей молочной продукции";

    expect(isSportsMenuQuestion(question)).toBe(false);
    expect(isDairyMenuQuestion(question)).toBe(true);
    expect(isSportsMenuConversation([{ role: "user", content: question }])).toBe(true);
  });
});

describe("Zoya grounded sports menu", () => {
  it("asks one concise basis question instead of inventing a menu", () => {
    const reply = buildGroundedSportsMenuReply(
      [
        { role: "user", content: firstQuestion },
        { role: "assistant", content: "Старый несбалансированный ответ." },
        { role: "user", content: followUpQuestion },
      ],
      ownerContext(),
    );

    expect(reply).not.toBeNull();
    expect(reply).toContain("Что означает **20% молочной продукции**");
    expect(reply).toContain("Доля **суточной калорийности**");
    expect(reply).toContain("Доля **массы всей еды за день**");
    expect(reply).toContain("Доля **вашей поставки**");
    expect(reply).toContain("Качотта из козьего молока");
    expect(reply).toContain("вариант 1, 2500 ккал");
    expect(reply).not.toContain("Структура меню");
    expect(reply.length).toBeLessThan(1_000);
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

    expect(reply).toContain("нет читаемого списка сыров");
    expect(reply).not.toContain("Козий камамбер");
    expect(reply).not.toContain("Выдержанный козий сыр");
  });

  it("includes a health disclaimer in the final calculated menu and avoids diagnosing the user", () => {
    const context = ownerContext({
      ownerContext: {
        ...ownerContext().ownerContext!,
        productPlans: [{
          status: "confirmed",
          selectionsJson: JSON.stringify([
            { label: "Брынза из козьего молока", productType: "brynza" },
          ]),
        }],
      },
    });
    const reply = buildGroundedSportsMenuReply(
      [
        { role: "user", content: followUpQuestion },
        { role: "assistant", content: "Что означает 20%?" },
        { role: "user", content: "Вариант 1, целевая калорийность 2500 ккал" },
      ],
      context,
    )!;

    expect(reply).toContain("не медицинское назначение");
    expect(reply).toContain("справочным аналогам");
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

  it("answers the production dialogue after an explicit 30% calorie basis and target", () => {
    const context = ownerContext({
      ownerContext: {
        ...ownerContext().ownerContext!,
        productPlans: [
          {
            status: "confirmed",
            selectionsJson: JSON.stringify([
              { label: "Брынза из козьего молока", productType: "brynza" },
              { label: "Брынза из овечьего молока", productType: "brynza" },
              { label: "Халуми", productType: "halloumi" },
              { label: "Рикотта с травами", productType: "ricotta" },
              { label: "Козий камамбер", productType: "camembert" },
            ]),
          },
        ],
      },
    });

    const reply = buildGroundedSportsMenuReply(
      [
        { role: "user", content: productionFirstQuestion },
        { role: "assistant", content: "Уточните базу процента" },
        { role: "user", content: productionFollowUp },
        { role: "assistant", content: "Что означает 30%?" },
        { role: "user", content: "Вариант 1, целевая калорийность 2500 ккал" },
      ],
      context,
    )!;

    expect(reply).toContain("30% от 2500 ккал");
    expect(reply).not.toContain("означает 20%");
    expect(reply).toContain("Рикотта с травами");
    expect(reply).toContain("Брынза из козьего молока");
    expect(reply).toContain("КБЖУ");
    expect(reply).toContain("около **29.6%**");
    expect(reply).toContain("143–204 г белка/сутки");
    expect(reply).toContain("высокая сырная нагрузка");
    expect(reply).toContain("USDA: ricotta, whole milk");
    expect(reply).toContain("USDA: feta");
    expect(reply).not.toContain("Ой, что-то пошло не так");
  });

  it("answers the exact standalone 30% dairy-menu request with one clarification", () => {
    const reply = buildGroundedSportsMenuReply(
      [
        {
          role: "user",
          content: "Сделай мне дневное меню, в рационе которого будет 30% моей молочной продукции",
        },
      ],
      ownerContext(),
    )!;

    expect(reply).toContain("Что означает **30% молочной продукции**");
    expect(reply).toContain("Качотта из козьего молока");
    expect(reply).toContain("вариант 1, 2500 ккал");
    expect(reply).not.toContain("Учтённые данные");
    expect(reply).not.toContain("Структура меню");
    expect(reply).not.toContain("Ой, что-то пошло не так");
  });

  it("requests target calories after the user chooses calorie share", () => {
    const reply = buildGroundedSportsMenuReply(
      [
        { role: "user", content: "Сделай меню с 30% моей молочной продукции и КБЖУ" },
        { role: "assistant", content: "Что означает 30%?" },
        { role: "user", content: "30% от суточной калорийности" },
      ],
      ownerContext(),
    )!;

    expect(reply).toContain("30% суточной калорийности");
    expect(reply).toContain("целевую калорийность в ккал/сутки");
    expect(reply).not.toContain("Структура меню");
  });

  it("does not fabricate macros for an owned cheese without a reference analogue", () => {
    const reply = buildGroundedSportsMenuReply(
      [
        { role: "user", content: "Сделай меню с 30% моей молочной продукции и КБЖУ" },
        { role: "assistant", content: "Что означает 30%?" },
        { role: "user", content: "Вариант 1, 2500 ккал" },
      ],
      ownerContext(),
    )!;

    expect(reply).toContain("нет надёжного справочного аналога КБЖУ");
    expect(reply).toContain("Качотта из козьего молока");
    expect(reply).not.toMatch(/Качотта[^\n]+\d+ ккал/);
  });

  it("keeps the exact four-step mass-share dialogue inside the calculator", () => {
    const context = ownerContext({
      ownerContext: {
        ...ownerContext().ownerContext!,
        productPlans: [{
          status: "confirmed",
          selectionsJson: JSON.stringify([
            { label: "Брынза из козьего молока", productType: "brynza" },
            { label: "Брынза из овечьего молока", productType: "brynza" },
            { label: "Халуми", productType: "halloumi" },
            { label: "Рикотта с травами", productType: "ricotta" },
            { label: "Козий камамбер", productType: "camembert" },
          ]),
        }],
      },
    });
    const first = "Зоя сделай мне меню из моей молочной продукции на завтра";
    const second = "30% моей продукции в рационе по массе";
    const third = "мне нужно 2500 кал";
    const correction = "Но кроме молочной продукции ты больше ничего не предложила, а я хочу сбалансированное питание";

    const firstReply = buildGroundedSportsMenuReply([{ role: "user", content: first }], context)!;
    const secondReply = buildGroundedSportsMenuReply([
      { role: "user", content: first },
      { role: "assistant", content: firstReply },
      { role: "user", content: second },
    ], context)!;
    const thirdReply = buildGroundedSportsMenuReply([
      { role: "user", content: first },
      { role: "assistant", content: firstReply },
      { role: "user", content: second },
      { role: "assistant", content: secondReply },
      { role: "user", content: third },
    ], context)!;
    const correctedReply = buildGroundedSportsMenuReply([
      { role: "user", content: first },
      { role: "assistant", content: firstReply },
      { role: "user", content: second },
      { role: "assistant", content: secondReply },
      { role: "user", content: third },
      { role: "assistant", content: thirdReply },
      { role: "user", content: correction },
    ], context)!;

    expect(firstReply).toContain("Какую долю молочной продукции");
    expect(secondReply).toContain("30% от массы всей еды");
    expect(secondReply).toContain("Укажите только целевую калорийность");
    expect(thirdReply).toContain("Сбалансированное меню: 30% молочной продукции по массе");
    expect(thirdReply).toContain("цель 2500 ккал");
    expect(thirdReply).toContain("Рикотта с травами");
    expect(thirdReply).toContain("Брынза из козьего молока");
    expect(thirdReply).toContain("Остальное меню содержит яйца, птицу, рыбу, крупы, овощи, фрукт и ненасыщенные жиры");
    expect(thirdReply).not.toMatch(/(?:кефир|йогурт)/i);
    expect(thirdReply).not.toContain("Сейчас внешний AI-сервис");
    expect(correctedReply).toContain("Сбалансированное меню: 30% молочной продукции по массе");
    expect(correctedReply).not.toContain("Сейчас внешний AI-сервис");

    const massMatch = thirdReply.match(/общий вес меню выбран \*\*(\d+) г\*\*, из него ваши сыры — \*\*(\d+) г \(([\d.]+)%\)\*\*/);
    expect(massMatch).not.toBeNull();
    const totalMass = Number(massMatch?.[1]);
    const dairyMass = Number(massMatch?.[2]);
    expect(dairyMass / totalMass).toBeCloseTo(0.3, 2);

    const totalKcalMatch = thirdReply.match(/### Итого за день\n\*\*(\d+) ккал/);
    expect(totalKcalMatch).not.toBeNull();
    expect(Math.abs(Number(totalKcalMatch?.[1]) - 2500) / 2500).toBeLessThanOrEqual(0.03);
  });
});
