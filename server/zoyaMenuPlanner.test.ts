import { describe, expect, it } from "vitest";
import { buildZoyaDeterministicMenuDraft } from "./zoyaMenuPlanner";
import { calculateZoyaTargets } from "./zoyaNutritionCalculator";
import { findReferenceNutrition } from "./zoyaProductNutrition";

const query = "Составь меню на 2500 ккал: 30% калорийности из моей молочной продукции";
const profile = {
  profileName: "Основной профиль",
  goals: ["рост мышц"],
  preferredProducts: ["Рикотта"],
} as any;
const labels = [
  ["Рикотта с травами", "ricotta"],
  ["Халуми", "halloumi"],
  ["Брынза из козьего молока", "brynza_goat"],
] as const;
const products = labels.map(([label, productType], index) => ({
  catalogItemId: index + 1,
  productType,
  label,
  unit: "кг",
  annualUnits: 8,
  planId: 1,
  animalId: 1,
  referenceNutrition: findReferenceNutrition(label, productType),
}));

const context = {
  intent: "personal_menu",
  profile,
  confirmedProducts: products,
  evidence: products.map((product) => ({
    level: "reference_estimate",
    key: product.label,
    value: product.label,
    sourceName: product.referenceNutrition!.sourceName,
    sourceUrl: product.referenceNutrition!.sourceUrl,
  })),
  calculationTargets: calculateZoyaTargets(profile, query),
} as any;

describe("Zoya deterministic menu planner", () => {
  it("builds four balanced meals using only confirmed farm products", () => {
    const draft = buildZoyaDeterministicMenuDraft(context)!;
    expect(draft.mealPlan.enabled).toBe(true);
    expect(draft.mealPlan.meals).toHaveLength(4);
    const farmItems = draft.mealPlan.meals
      .flatMap((meal) => meal.items)
      .filter((item) => item.farmProduct);
    expect(farmItems.length).toBeGreaterThan(0);
    expect(farmItems.every((item) => products.some((product) => product.label === item.name))).toBe(true);
    expect(draft.mealPlan.meals.flatMap((meal) => meal.items).some((item) => item.name === "Куриная грудка, готовая")).toBe(true);
    expect(draft.mealPlan.meals.flatMap((meal) => meal.items).some((item) => item.name === "Овощи")).toBe(true);
  });

  it("keeps calories and dairy share close to the requested targets", () => {
    const draft = buildZoyaDeterministicMenuDraft(context)!;
    expect(draft.mealPlan.dailyNutrition.kcal).toBeGreaterThanOrEqual(2_375);
    expect(draft.mealPlan.dailyNutrition.kcal).toBeLessThanOrEqual(2_625);
    const match = draft.mealPlan.farmProductShareText.match(/около\s+([\d.]+)%/);
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(27);
    expect(Number(match?.[1])).toBeLessThanOrEqual(33);
  });

  it("offers a confirmed alternative with a calculated equivalent portion", () => {
    const draft = buildZoyaDeterministicMenuDraft(context)!;
    expect(draft.substitutions).toHaveLength(1);
    expect(draft.substitutions[0].with).toMatch(/Брынза из козьего молока — около \d+ г/);
    expect(draft.substitutions[0].reason).toContain("Эквивалентная по калорийности");
  });
});
