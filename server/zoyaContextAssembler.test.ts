import { beforeEach, describe, expect, it, vi } from "vitest";

const getNutriSessionMock = vi.hoisted(() => vi.fn());
const getOwnerNutriContextMock = vi.hoisted(() => vi.fn());
const getNutritionProfileMock = vi.hoisted(() => vi.fn());
const getPrimaryNutritionProfileMock = vi.hoisted(() => vi.fn());
const getNutritionProfileRequirementsMock = vi.hoisted(() => vi.fn());
const getZoyaRagEntriesMock = vi.hoisted(() => vi.fn());

vi.mock("./nutritionistDb", () => ({
  getNutriSession: getNutriSessionMock,
  getOwnerNutriContext: getOwnerNutriContextMock,
}));

vi.mock("./zoyaProfiles", () => ({
  getNutritionProfile: getNutritionProfileMock,
  getPrimaryNutritionProfile: getPrimaryNutritionProfileMock,
  getNutritionProfileRequirements: getNutritionProfileRequirementsMock,
}));

vi.mock("./zoyaRag", () => ({
  getZoyaRagEntries: getZoyaRagEntriesMock,
}));

import {
  assembleZoyaContext,
  buildZoyaSessionState,
  classifyZoyaIntent,
  extractConfirmedOwnerProducts,
} from "./zoyaContextAssembler";
import { buildZoyaDeterministicMenuDraft } from "./zoyaMenuPlanner";

const completeProfile = {
  id: 12,
  userId: 42,
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
  isPrimary: 1,
  onboardingStatus: "complete",
  confirmedAt: new Date(),
  lastReviewedAt: new Date(),
} as any;

const ownerContext = {
  productPlans: [
    {
      id: 4,
      animalId: 2,
      status: "confirmed",
      selectionsJson: JSON.stringify([
        { catalogItemId: 7, productType: "ricotta", label: "Рикотта с травами", annualUnits: 8, unit: "кг" },
      ]),
    },
    {
      id: 5,
      animalId: 3,
      status: "pending_approval",
      selectionsJson: JSON.stringify([
        { catalogItemId: 8, productType: "kefir", label: "Козий кефир", annualUnits: 12, unit: "л" },
      ]),
    },
  ],
  animals: [
    {
      animalId: 2,
      animalName: "Мира",
      animalSlug: "mira",
      availableProducts: [
        { type: "ricotta", label: "Рикотта с травами", unit: "кг" },
        { type: "kefir", label: "Козий кефир", unit: "л" },
      ],
      milkComposition: [],
    },
  ],
  deliveries: [],
};

describe("assembleZoyaContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNutriSessionMock.mockResolvedValue(null);
    getOwnerNutriContextMock.mockResolvedValue(null);
    getNutritionProfileMock.mockResolvedValue(null);
    getPrimaryNutritionProfileMock.mockResolvedValue(null);
    getNutritionProfileRequirementsMock.mockReturnValue({ isComplete: true, missingFields: [], needsReview: false });
    getZoyaRagEntriesMock.mockResolvedValue([]);
  });

  it("requires authentication for a guest personal menu but allows general questions", async () => {
    const personal = await assembleZoyaContext({
      query: "Составь мне дневное меню",
      userType: "guest",
    });
    expect(personal.status).toBe("needs_authentication");

    const general = await assembleZoyaContext({
      query: "Чем отличается козье молоко?",
      userType: "guest",
    });
    expect(general.status).toBe("ready");
  });

  it("classifies healthy eating plans and tomorrow menus as personal planning requests", () => {
    expect(classifyZoyaIntent("Составь мне план здорового питания")).toBe("personal_menu");
    expect(classifyZoyaIntent("Составь мне план сбалансированного здорового питания")).toBe("personal_menu");
    expect(classifyZoyaIntent("Сделай мне меню на завтра")).toBe("personal_menu");
  });

  it("answers a general allergy safety question without profile but gates a personal medical request", async () => {
    const generalSafety = await assembleZoyaContext({
      query: "Можно ли козье молоко при аллергии на казеин?",
      userType: "guest",
    });
    expect(generalSafety.intent).toBe("medical_safety");
    expect(generalSafety.requiresPersonalization).toBe(false);
    expect(generalSafety.status).toBe("ready");
    expect(generalSafety.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: "verified_knowledge",
        key: "mandatory_safety:cow_milk_allergy_cross_reactivity",
        sourceUrl: expect.stringContaining("allergy.org.au"),
      }),
    ]));

    const personalSafety = await assembleZoyaContext({
      query: "Можно ли мне козье молоко при моей аллергии на казеин?",
      userType: "guest",
    });
    expect(personalSafety.requiresPersonalization).toBe(true);
    expect(personalSafety.status).toBe("needs_authentication");
  });

  it("requires profile creation, completion and current-session confirmation in order", async () => {
    const noProfile = await assembleZoyaContext({
      query: "Составь мне меню",
      userId: 42,
      userType: "registered",
    });
    expect(noProfile.status).toBe("needs_profile");

    getPrimaryNutritionProfileMock.mockResolvedValue(completeProfile);
    getNutritionProfileRequirementsMock.mockReturnValue({
      isComplete: false,
      missingFields: ["allergies", "restrictions"],
      needsReview: false,
    });
    const incomplete = await assembleZoyaContext({
      query: "Составь мне меню",
      userId: 42,
      userType: "registered",
    });
    expect(incomplete.status).toBe("needs_profile_completion");
    expect(incomplete.pendingClarifications).toEqual(expect.arrayContaining(["allergies", "restrictions"]));

    getNutritionProfileRequirementsMock.mockReturnValue({ isComplete: true, missingFields: [], needsReview: false });
    const unconfirmed = await assembleZoyaContext({
      query: "Составь мне меню",
      userId: 42,
      userType: "registered",
    });
    expect(unconfirmed.status).toBe("needs_profile_confirmation");
    expect(unconfirmed.evidence.some((item) => item.level === "client_fact")).toBe(false);
  });

  it("separates confirmed products from available variants and adds reference evidence", async () => {
    getPrimaryNutritionProfileMock.mockResolvedValue(completeProfile);
    getOwnerNutriContextMock.mockResolvedValue(ownerContext);

    const context = await assembleZoyaContext({
      query: "Составь мне меню из моей продукции на 2500 ккал",
      userId: 42,
      userType: "owner",
      profileConfirmed: true,
    });

    expect(context.status).toBe("ready");
    expect(context.confirmedProducts.map((item) => item.label)).toEqual(["Рикотта с травами"]);
    expect(context.availableProductVariants.map((item) => item.label)).toEqual([
      "Рикотта с травами",
      "Козий кефир",
    ]);
    expect(context.confirmedProducts[0].referenceNutrition?.sourceId).toBe("USDA FDC 170851");
    expect(context.evidence.some((item) => item.level === "reference_estimate")).toBe(true);
    expect(context.calculationTargets.calorieTarget).toBe(2500);
  });

  it("keeps a short follow-up inside the original task using persisted session state", async () => {
    getNutritionProfileMock.mockResolvedValue(completeProfile);
    getNutriSessionMock.mockResolvedValue({
      id: 99,
      userId: 42,
      profileId: 12,
      contextState: {
        intent: "personal_menu",
        pendingField: "dairyShareBasis",
        collected: { originalQuery: "Составь меню с 30% моей продукции" },
      },
    });
    getOwnerNutriContextMock.mockResolvedValue(ownerContext);

    const context = await assembleZoyaContext({
      query: "по массе еды, 2500 ккал",
      userId: 42,
      userType: "owner",
      profileId: 12,
      profileConfirmed: true,
      sessionId: 99,
    });

    expect(context.intent).toBe("personal_menu");
    expect(context.effectiveQuery).toContain("Составь меню с 30% моей продукции");
    expect(context.effectiveQuery).toContain("по массе еды, 2500 ккал");
    expect(context.pendingClarifications).not.toContain("dairyShareBasis");
    expect(context.calculationTargets.requestedDairyShare).toEqual({ percent: 30, basis: "food_mass" });
    expect(buildZoyaSessionState(context).pendingField).toBeUndefined();
  });

  it("reclassifies a new explicit menu request instead of keeping a stale general intent", async () => {
    getNutritionProfileMock.mockResolvedValue(completeProfile);
    getNutriSessionMock.mockResolvedValue({
      id: 100,
      userId: 42,
      profileId: 12,
      contextState: {
        intent: "general_information",
        collected: { originalQuery: "Расскажи о здоровом питании" },
      },
    });
    getOwnerNutriContextMock.mockResolvedValue(ownerContext);

    const context = await assembleZoyaContext({
      query: "Сделай мне меню на завтра",
      userId: 42,
      userType: "owner",
      profileId: 12,
      profileConfirmed: true,
      sessionId: 100,
    });

    expect(context.intent).toBe("personal_menu");
    expect(context.effectiveQuery).toBe("Сделай мне меню на завтра");
    expect(context.calculationTargets.calorieTargetSource).toBe("profile_estimate");
  });

  it("turns the user's exact healthy-plan request into a ready server menu without asking for a percentage", async () => {
    getPrimaryNutritionProfileMock.mockResolvedValue(completeProfile);
    getOwnerNutriContextMock.mockResolvedValue(ownerContext);

    const context = await assembleZoyaContext({
      query: "Составь мне план здорового питания",
      userId: 42,
      userType: "owner",
      profileConfirmed: true,
    });
    const draft = buildZoyaDeterministicMenuDraft(context);

    expect(context.intent).toBe("personal_menu");
    expect(context.status).toBe("ready");
    expect(context.calculationTargets.calorieTargetSource).toBe("profile_estimate");
    expect(context.calculationTargets.requestedDairyShare).toBeNull();
    expect(draft?.mealPlan.enabled).toBe(true);
    expect(draft?.consideredFacts).toContain(
      "умеренная планировочная доля продукции фермы: около 10% калорийности (допущение по умолчанию)",
    );
    expect(draft?.mealPlan.meals.flatMap((meal) => meal.items).filter((item) => item.farmProduct).map((item) => item.name)).toEqual([
      "Рикотта с травами",
    ]);
  });
});

describe("confirmed product parser", () => {
  it("ignores unconfirmed plans and malformed rows", () => {
    expect(extractConfirmedOwnerProducts({
      productPlans: [
        { id: 1, status: "pending_approval", selectionsJson: JSON.stringify([{ label: "Не подтверждён" }]) },
        { id: 2, status: "confirmed", selectionsJson: "not-json" },
      ],
    })).toEqual([]);
  });
});
