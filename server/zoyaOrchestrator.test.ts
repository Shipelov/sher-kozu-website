import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeZoyaLLMMock = vi.hoisted(() => vi.fn());
vi.mock("./zoyaChatRuntime", () => ({
  invokeZoyaLLM: invokeZoyaLLMMock,
}));

import {
  buildZoyaOrchestratorPrompt,
  renderZoyaStructuredResponse,
  runZoyaOrchestrator,
  validateZoyaStructuredResponse,
  ZOYA_RESPONSE_FORMAT,
  type ZoyaStructuredResponse,
} from "./zoyaOrchestrator";

const context = {
  status: "ready",
  intent: "general_information",
  originalQuery: "Составь меню",
  effectiveQuery: "Составь меню",
  requiresPersonalization: false,
  profileConfirmed: true,
  profile: {
    id: 10,
    profileName: "Основной профиль",
    relationship: "self",
    gender: "male",
    birthDate: "1979-01-01",
    heightCm: 174,
    weightKg: 102,
    goals: ["muscle_gain"],
    activityLevel: "high",
    activityDetails: "силовая тренировка 1 час",
    allergies: [],
    restrictions: [],
    preferredProducts: ["Рикотта"],
    dislikedProducts: [],
    mealPreferences: null,
    medicalNotes: null,
  },
  profileRequirements: { isComplete: true, missingFields: [], needsReview: false },
  pendingClarifications: [],
  confirmedProducts: [
    {
      catalogItemId: 7,
      productType: "ricotta",
      label: "Рикотта с травами",
      unit: "кг",
      annualUnits: 8,
      planId: 4,
      animalId: 2,
      referenceNutrition: {
        analogName: "Cheese, ricotta, whole milk",
        per100g: { kcal: 150, proteinG: 7.54, fatG: 10.18, carbsG: 7.27 },
        sourceName: "USDA FoodData Central, SR Legacy",
        sourceUrl: "https://fdc.nal.usda.gov/food-details/170851/nutrients",
        sourceId: "USDA FDC 170851",
      },
    },
  ],
  availableProductVariants: [
    { animalId: 2, animalName: "Мира", label: "Козий кефир", productType: "kefir", unit: "л" },
  ],
  ownerContext: null,
  ragEntries: [],
  evidence: [
    { level: "client_fact", key: "goal", value: "рост мышц" },
    { level: "farm_fact", key: "confirmed_product", value: "Рикотта с травами" },
  ],
  calculationTargets: {
    calorieTarget: 320,
    calorieTargetSource: "explicit",
    calorieRange: { min: 304, max: 336 },
    proteinRangeG: { min: 10, max: 20 },
    requestedDairyShare: null,
    assumptions: [],
  },
} as any;

const nutrition = (kcal: number | null, proteinG: number | null, fatG: number | null, carbsG: number | null, estimated = true) => ({
  kcal,
  proteinG,
  fatG,
  carbsG,
  estimated,
});

const response = (overrides: Partial<ZoyaStructuredResponse> = {}): ZoyaStructuredResponse => ({
  summary: "Сбалансированный рацион",
  consideredFacts: ["профиль подтверждён", "цель — рост мышц"],
  answer: "Молочная продукция включена как часть полноценного рациона.",
  mealPlan: {
    enabled: true,
    title: "Меню на день",
    meals: [
      {
        name: "Завтрак",
        time: "08:00",
        items: [
          { name: "Рикотта с травами", amount: "40 г", farmProduct: true, nutrition: nutrition(70, 5, 5, 2) },
          { name: "Овсяная каша", amount: "250 г", farmProduct: false, nutrition: nutrition(250, 9, 6, 42) },
        ],
        nutrition: nutrition(320, 14, 11, 44),
      },
    ],
    dailyNutrition: nutrition(320, 14, 11, 44),
    farmProductShareText: "40 г подтверждённой продукции",
  },
  substitutions: [],
  warnings: [],
  sources: [{ evidenceId: 2, title: "Подтверждённый продуктовый план" }],
  referenceNote: "КБЖУ рикотты — справочная оценка.",
  ...overrides,
});

const completeMenuResponse = (): ZoyaStructuredResponse => {
  const result = response();
  result.mealPlan.meals = [
    result.mealPlan.meals[0],
    { ...result.mealPlan.meals[0], name: "Обед", time: "13:00" },
    { ...result.mealPlan.meals[0], name: "Ужин", time: "19:00" },
  ];
  result.mealPlan.dailyNutrition = nutrition(960, 42, 33, 132);
  return result;
};

describe("Zoya structured orchestrator", () => {
  beforeEach(() => invokeZoyaLLMMock.mockReset());

  it("separates confirmed products from merely available variants in the prompt", () => {
    const prompt = buildZoyaOrchestratorPrompt(context);
    expect(prompt).toContain("confirmedProducts");
    expect(prompt).toContain("availableProductVariants");
    expect(prompt).toContain("ТОЛЬКО элементы confirmedProducts");
    expect(prompt).toContain("ОБЯЗАТЕЛЬНЫЙ JSON-ШАБЛОН");
    expect(prompt).toContain('"consideredFacts"');
    expect(prompt).toContain('"mealPlan"');
  });

  it("accepts a consistent answer using only a confirmed farm product", () => {
    expect(validateZoyaStructuredResponse(response(), context)).toEqual([]);
  });

  it("rejects a merely available product presented as the client's farm product", () => {
    const unsafe = response();
    unsafe.mealPlan.meals[0].items[0].name = "Козий кефир";
    expect(validateZoyaStructuredResponse(unsafe, context)).toContain("unknown_farm_product:Козий кефир");
  });

  it("allows a preparation note after the exact confirmed product name", () => {
    const prepared = response();
    prepared.mealPlan.meals[0].items[0].name = "Рикотта с травами в омлете";
    expect(validateZoyaStructuredResponse(prepared, context)).not.toEqual(expect.arrayContaining([
      expect.stringContaining("unknown_farm_product"),
    ]));
  });

  it("rejects inconsistent daily arithmetic and unknown evidence ids", () => {
    const invalid = response();
    invalid.mealPlan.dailyNutrition.kcal = 2500;
    invalid.sources = [{ evidenceId: 99, title: "Несуществующий источник" }];
    expect(validateZoyaStructuredResponse(invalid, context)).toEqual(expect.arrayContaining([
      "daily_total:kcal",
      "unknown_evidence:99",
    ]));
  });

  it("rejects a declared farm calorie share that is far from the deterministic target", () => {
    const shareContext = {
      ...context,
      calculationTargets: {
        ...context.calculationTargets,
        requestedDairyShare: { percent: 30, basis: "calories" },
      },
    };
    expect(validateZoyaStructuredResponse(response(), shareContext)).toContain("dairy_calorie_share_deviation");
  });

  it("rejects a product that conflicts with a declared allergy", () => {
    const allergyContext = {
      ...context,
      profile: { ...context.profile, allergies: ["рикотта"] },
    };
    expect(validateZoyaStructuredResponse(response(), allergyContext)).toContain("allergy_conflict:рикотта");
  });

  it("renders considered facts, meal totals, substitutions and source labels", () => {
    const markdown = renderZoyaStructuredResponse(response({
      substitutions: [{ replace: "Рикотта", with: "Рикотта с травами", reason: "есть в плане", farmProduct: true }],
    }));
    expect(markdown).toContain("Учтено в расчёте");
    expect(markdown).toContain("Итого за день");
    expect(markdown).toContain("Варианты замены");
    expect(markdown).toContain("Источники");
  });

  it("adds verified medical sources and a warning deterministically when the model omits them", async () => {
    const medicalContext = {
      ...context,
      intent: "medical_safety",
      evidence: [{
        level: "verified_knowledge",
        key: "mandatory_safety",
        value: "Козье молоко не является безопасной заменой при аллергии на молочный белок.",
        sourceName: "ASCIA — Cow's Milk Allergy",
        sourceUrl: "https://www.allergy.org.au/patients/food-allergy/cows-milk-dairy-allergy",
      }],
    };
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response({ sources: [], warnings: [] })) } }],
    });

    const result = await runZoyaOrchestrator(medicalContext, [{ role: "user", content: "Можно ли козье молоко при аллергии?" }]);

    expect(result.response.sources).toEqual([{ evidenceId: 1, title: "ASCIA — Cow's Milk Allergy" }]);
    expect(result.response.warnings).toHaveLength(1);
    expect(result.markdown).toContain("https://www.allergy.org.au/");
  });

  it("removes only an incomplete trailing clause from a provider answer", async () => {
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response({
        answer: "Первое полное предложение. Второе полное предложение. Незавершённый хвост ответа",
      })) } }],
    });

    const result = await runZoyaOrchestrator(context, [{ role: "user", content: "Составь меню" }]);

    expect(result.response.answer).toBe("Первое полное предложение. Второе полное предложение.");
  });

  it("replaces a weak greeting-only medical answer with the verified safety conclusion", async () => {
    const medicalContext = {
      ...context,
      intent: "medical_safety",
      effectiveQuery: "Можно ли козье молоко при аллергии на казеин?",
      evidence: [{
        level: "verified_knowledge",
        key: "mandatory_safety",
        value: "Козье молоко не является безопасной заменой.",
        sourceName: "ASCIA",
        sourceUrl: "https://www.allergy.org.au/",
      }],
    };
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response({ answer: "Здравствуйте! Я Зоя", sources: [], warnings: [] })) } }],
    });

    const result = await runZoyaOrchestrator(medicalContext, [{ role: "user", content: medicalContext.effectiveQuery }]);

    expect(result.response.answer).toContain("не следует самостоятельно заменять");
    expect(result.response.summary).toContain("не считается безопасной заменой");
  });

  it("uses the short narrative path for a deterministic menu and returns validated Markdown", async () => {
    const menuContext = {
      ...context,
      intent: "personal_menu",
      requiresPersonalization: true,
      calculationTargets: {
        ...context.calculationTargets,
        calorieTarget: 960,
        calorieRange: { min: 900, max: 1_020 },
        proteinRangeG: { min: 30, max: 60 },
      },
    };
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        summary: "AI-пояснение к рассчитанному меню",
        consideredFacts: ["цель — рост мышц"],
        answer: "Рацион распределяет белок и энергию между основными приёмами пищи.",
      }) } }],
    });
    const result = await runZoyaOrchestrator(menuContext, [{ role: "user", content: "Составь меню" }]);
    expect(invokeZoyaLLMMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ maxTokens: 1_200, primaryTimeoutMs: 13_000 }),
    );
    expect(invokeZoyaLLMMock.mock.calls[0][1]).not.toHaveProperty("responseFormat");
    expect(result.markdown).toContain("AI-пояснение к рассчитанному меню");
    expect(result.markdown).toContain("### Меню на день");
  });

  it("returns the validated deterministic menu when the narrative AI call fails", async () => {
    const menuContext = {
      ...context,
      intent: "personal_menu",
      requiresPersonalization: true,
      calculationTargets: {
        ...context.calculationTargets,
        calorieTarget: 960,
        calorieRange: { min: 900, max: 1_020 },
        proteinRangeG: { min: 30, max: 80 },
      },
    };
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: "not valid narrative json" } }],
    });

    const result = await runZoyaOrchestrator(menuContext, [{ role: "user", content: "Составь меню" }]);

    expect(result.markdown).toContain("### Меню на день");
    expect(result.response.mealPlan.meals).toHaveLength(4);
  });

  it("removes unsupported nutrition claims and ignores model-generated medical warnings", async () => {
    const menuContext = {
      ...context,
      intent: "personal_menu",
      requiresPersonalization: true,
      calculationTargets: {
        ...context.calculationTargets,
        calorieTarget: 960,
        calorieRange: { min: 900, max: 1_020 },
        proteinRangeG: { min: 30, max: 80 },
      },
    };
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        summary: "Рассчитанное меню",
        consideredFacts: ["цель — рост мышц"],
        answer: "Рацион распределяет белок между приёмами пищи. Рикотта якобы обеспечивает кальцием.",
        warnings: ["Пейте не менее трёх литров воды."],
      }) } }],
    });

    const result = await runZoyaOrchestrator(menuContext, [{ role: "user", content: "Составь меню" }]);

    expect(result.response.answer).not.toContain("кальцием");
    expect(result.response.warnings).not.toContain("Пейте не менее трёх литров воды.");
  });

  it("fails closed after one call when the provider returns empty content", async () => {
    invokeZoyaLLMMock.mockResolvedValue({ choices: [{ message: { content: null }, finish_reason: "stop" }] });

    await expect(runZoyaOrchestrator(context, [{ role: "user", content: "Составь меню" }]))
      .rejects.toMatchObject({ name: "ZoyaStructuredOutputError" });
    expect(invokeZoyaLLMMock).toHaveBeenCalledTimes(1);
  });

  it("repairs a syntactically malformed JSON fallback before schema validation", async () => {
    const malformed = `${JSON.stringify(response()).slice(0, -1)},}`;
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: `\`\`\`json\n${malformed}\n\`\`\`` }, finish_reason: "stop" }],
    });

    const result = await runZoyaOrchestrator(context, [{ role: "user", content: "Составь меню" }]);

    expect(result.markdown).toContain("Сбалансированный рацион");
  });

  it("normalizes numeric nutrition strings from a schema-less provider fallback", async () => {
    const stringifiedNumbers = response();
    (stringifiedNumbers.mealPlan.dailyNutrition.carbsG as unknown) = "44";
    (stringifiedNumbers.mealPlan.meals[0].nutrition.proteinG as unknown) = "14,0";
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(stringifiedNumbers) }, finish_reason: "stop" }],
    });

    const result = await runZoyaOrchestrator(context, [{ role: "user", content: "Составь меню" }]);

    expect(result.response.mealPlan.dailyNutrition.carbsG).toBe(44);
    expect(result.response.mealPlan.meals[0].nutrition.proteinG).toBe(14);
  });

  it("safely completes a missing answer field from the provider summary", async () => {
    const incomplete = response() as Record<string, unknown>;
    delete incomplete.answer;
    invokeZoyaLLMMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(incomplete) }, finish_reason: "stop" }],
    });

    const result = await runZoyaOrchestrator(context, [{ role: "user", content: "Составь меню" }]);

    expect(result.response.answer).toBe("Сбалансированный рацион");
  });
});
