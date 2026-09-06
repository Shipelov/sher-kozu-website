import type { ZoyaAssembledContext } from "./zoyaContextAssembler";
import type { ZoyaStructuredResponse } from "./zoyaOrchestrator";

type Macro = { kcal: number; proteinG: number; fatG: number; carbsG: number };
type Ingredient = {
  name: string;
  grams: number;
  per100g: Macro;
  farmProduct: boolean;
};

const BASE_MEALS: Array<{ name: string; time: string; items: Ingredient[] }> = [
  {
    name: "Завтрак",
    time: "08:00",
    items: [
      { name: "Овсяные хлопья", grams: 60, per100g: { kcal: 379, proteinG: 13.15, fatG: 6.52, carbsG: 67.7 }, farmProduct: false },
      { name: "Яйца", grams: 100, per100g: { kcal: 143, proteinG: 12.56, fatG: 9.51, carbsG: 0.72 }, farmProduct: false },
      { name: "Овощи или ягоды", grams: 150, per100g: { kcal: 35, proteinG: 2, fatG: 0.3, carbsG: 7 }, farmProduct: false },
    ],
  },
  {
    name: "Обед",
    time: "13:00",
    items: [
      { name: "Куриная грудка, готовая", grams: 180, per100g: { kcal: 165, proteinG: 31.02, fatG: 3.57, carbsG: 0 }, farmProduct: false },
      { name: "Рис, готовый", grams: 250, per100g: { kcal: 130, proteinG: 2.69, fatG: 0.28, carbsG: 28.17 }, farmProduct: false },
      { name: "Овощи", grams: 250, per100g: { kcal: 35, proteinG: 2, fatG: 0.3, carbsG: 7 }, farmProduct: false },
      { name: "Оливковое масло", grams: 10, per100g: { kcal: 884, proteinG: 0, fatG: 100, carbsG: 0 }, farmProduct: false },
    ],
  },
  {
    name: "Перекус",
    time: "16:30",
    items: [
      { name: "Банан", grams: 120, per100g: { kcal: 89, proteinG: 1.09, fatG: 0.33, carbsG: 22.84 }, farmProduct: false },
    ],
  },
  {
    name: "Ужин",
    time: "20:00",
    items: [
      { name: "Лосось, готовый", grams: 160, per100g: { kcal: 206, proteinG: 22.1, fatG: 12.4, carbsG: 0 }, farmProduct: false },
      { name: "Картофель, отварной", grams: 300, per100g: { kcal: 87, proteinG: 1.87, fatG: 0.1, carbsG: 20.13 }, farmProduct: false },
      { name: "Овощи", grams: 250, per100g: { kcal: 35, proteinG: 2, fatG: 0.3, carbsG: 7 }, farmProduct: false },
      { name: "Оливковое масло", grams: 10, per100g: { kcal: 884, proteinG: 0, fatG: 100, carbsG: 0 }, farmProduct: false },
    ],
  },
];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function scaledMacro(item: Ingredient): Macro {
  const factor = item.grams / 100;
  return {
    kcal: round1(item.per100g.kcal * factor),
    proteinG: round1(item.per100g.proteinG * factor),
    fatG: round1(item.per100g.fatG * factor),
    carbsG: round1(item.per100g.carbsG * factor),
  };
}

function sumMacros(items: Ingredient[]): Macro {
  const result = items.reduce<Macro>((sum, item) => {
    const value = scaledMacro(item);
    return {
      kcal: sum.kcal + value.kcal,
      proteinG: sum.proteinG + value.proteinG,
      fatG: sum.fatG + value.fatG,
      carbsG: sum.carbsG + value.carbsG,
    };
  }, { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
  return {
    kcal: round1(result.kcal),
    proteinG: round1(result.proteinG),
    fatG: round1(result.fatG),
    carbsG: round1(result.carbsG),
  };
}

function roundedGrams(value: number, name: string): number {
  if (name === "Оливковое масло") return Math.max(3, Math.round(value));
  if (name === "Яйца") return Math.max(50, Math.round(value / 50) * 50);
  return Math.max(5, Math.round(value / 5) * 5);
}

function cloneAndScaleBase(scale: number): Array<{ name: string; time: string; items: Ingredient[] }> {
  return BASE_MEALS.map((meal) => ({
    ...meal,
    items: meal.items.map((item) => ({
      ...item,
      grams: roundedGrams(item.grams * scale, item.name),
    })),
  }));
}

function nutrition(value: Macro, estimated = true) {
  return { ...value, estimated };
}

function productEvidenceId(context: ZoyaAssembledContext, sourceUrl: string): number | null {
  const index = context.evidence.findIndex((item) => item.sourceUrl === sourceUrl);
  return index >= 0 ? index + 1 : null;
}

export function buildZoyaDeterministicMenuDraft(
  context: ZoyaAssembledContext,
): ZoyaStructuredResponse | null {
  if (context.intent !== "personal_menu" && context.intent !== "sports_nutrition") return null;
  const calorieTarget = context.calculationTargets.calorieTarget;
  if (!calorieTarget) return null;

  const usableProducts = context.confirmedProducts
    .filter((product) => product.referenceNutrition)
    .sort((a, b) => {
      const preferred = context.profile?.preferredProducts ?? [];
      return Number(preferred.some((item) => b.label.toLowerCase().includes(item.toLowerCase())))
        - Number(preferred.some((item) => a.label.toLowerCase().includes(item.toLowerCase())));
    });
  if (usableProducts.length === 0) return null;

  const selected = usableProducts.slice(0, 2);
  const requestedShare = context.calculationTargets.requestedDairyShare;
  const sharePercent = requestedShare?.percent ?? 10;
  const shareRatio = Math.min(0.65, Math.max(0.03, sharePercent / 100));
  const split = selected.length === 1 ? [1] : [0.55, 0.45];
  const baseItems = BASE_MEALS.flatMap((meal) => meal.items);
  const baseMacros = sumMacros(baseItems);
  const baseMass = baseItems.reduce((sum, item) => sum + item.grams, 0);

  let dairyMassTarget: number;
  let baseScale: number;
  if (requestedShare?.basis === "food_mass") {
    const dairyDensity = selected.reduce((sum, product, index) => (
      sum + product.referenceNutrition!.per100g.kcal / 100 * split[index]!
    ), 0);
    const baseDensity = baseMacros.kcal / baseMass;
    const totalMass = calorieTarget / (dairyDensity * shareRatio + baseDensity * (1 - shareRatio));
    dairyMassTarget = totalMass * shareRatio;
    baseScale = (totalMass * (1 - shareRatio)) / baseMass;
  } else {
    const dairyTargetKcal = calorieTarget * shareRatio;
    dairyMassTarget = selected.reduce((sum, product, index) => (
      sum + dairyTargetKcal * split[index]! / product.referenceNutrition!.per100g.kcal * 100
    ), 0);
    const dairyKcal = dairyTargetKcal;
    baseScale = Math.max(0.35, (calorieTarget - dairyKcal) / baseMacros.kcal);
  }

  const dairyItems: Ingredient[] = selected.map((product, index) => {
    const grams = selected.length === 1
      ? dairyMassTarget
      : dairyMassTarget * split[index]!;
    return {
      name: product.label,
      grams: roundedGrams(grams, product.label),
      per100g: product.referenceNutrition!.per100g,
      farmProduct: true,
    };
  });
  const meals = cloneAndScaleBase(baseScale);
  meals[0]!.items.push(dairyItems[0]!);
  if (dairyItems[1]) meals[1]!.items.push(dairyItems[1]);

  const mealPlanMeals = meals.map((meal) => {
    const total = sumMacros(meal.items);
    return {
      name: meal.name,
      time: meal.time,
      items: meal.items.map((item) => ({
        name: item.name,
        amount: `${item.grams} г`,
        farmProduct: item.farmProduct,
        nutrition: nutrition(scaledMacro(item)),
      })),
      nutrition: nutrition(total),
    };
  });
  const daily = mealPlanMeals.reduce<Macro>((sum, meal) => ({
    kcal: sum.kcal + (meal.nutrition.kcal ?? 0),
    proteinG: sum.proteinG + (meal.nutrition.proteinG ?? 0),
    fatG: sum.fatG + (meal.nutrition.fatG ?? 0),
    carbsG: sum.carbsG + (meal.nutrition.carbsG ?? 0),
  }), { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 });
  const dailyRounded = {
    kcal: round1(daily.kcal),
    proteinG: round1(daily.proteinG),
    fatG: round1(daily.fatG),
    carbsG: round1(daily.carbsG),
  };
  const dairyMacros = sumMacros(dairyItems);
  const dairyMass = dairyItems.reduce((sum, item) => sum + item.grams, 0);
  const totalMass = meals.flatMap((meal) => meal.items).reduce((sum, item) => sum + item.grams, 0);
  const actualShare = requestedShare?.basis === "food_mass"
    ? dairyMass / totalMass * 100
    : dairyMacros.kcal / dailyRounded.kcal * 100;
  const shareBasisLabel = requestedShare?.basis === "food_mass" ? "массы рациона" : "калорийности";

  const sources = Array.from(new Map(selected.flatMap((product) => {
    const evidenceId = productEvidenceId(context, product.referenceNutrition!.sourceUrl);
    return evidenceId
      ? [[evidenceId, { evidenceId, title: product.referenceNutrition!.sourceName }] as const]
      : [];
  })).values());

  return {
    summary: `Сбалансированный дневной рацион на ${Math.round(dailyRounded.kcal)} ккал`,
    consideredFacts: [
      `подтверждённый профиль ${context.profile?.profileName ?? "клиента"}`,
      `цель: ${(context.profile?.goals ?? []).join(", ") || "сбалансированный рацион"}`,
      `${sharePercent}% ${shareBasisLabel} из продукции фермы`,
      `использованы только подтверждённые продукты: ${selected.map((product) => product.label).join(", ")}`,
    ],
    answer: "Рацион рассчитан сервером: молочная продукция распределена между основными приёмами пищи и дополнена белковыми продуктами, сложными углеводами, овощами, фруктом и источниками ненасыщенных жиров.",
    mealPlan: {
      enabled: true,
      title: "Меню на день",
      meals: mealPlanMeals,
      dailyNutrition: nutrition(dailyRounded),
      farmProductShareText: `${dairyItems.map((item) => `${item.name} — ${item.grams} г`).join("; ")}; около ${round1(actualShare)}% ${shareBasisLabel}`,
    },
    substitutions: usableProducts.slice(2, 4).map((product, index) => {
      const selectedIndex = index % selected.length;
      const replacedProduct = selected[selectedIndex]!;
      const replacedItem = dairyItems[selectedIndex]!;
      const replacementGrams = roundedGrams(
        replacedItem.grams
          * replacedProduct.referenceNutrition!.per100g.kcal
          / product.referenceNutrition!.per100g.kcal,
        product.label,
      );
      return {
        replace: replacedProduct.label,
        with: `${product.label} — около ${replacementGrams} г`,
        reason: "Эквивалентная по калорийности порция по справочному КБЖУ; перед регулярным применением уточните состав партии.",
        farmProduct: true,
      };
    }),
    warnings: dairyMass > 220 || dairyMacros.fatG > 45
      ? ["Заданная доля даёт высокую ежедневную порцию сыра и нагрузку по жирам и соли. Для регулярного рациона стоит проверить этикетку/анализ партии и рассмотреть меньшую долю."]
      : [],
    sources,
    referenceNote: "КБЖУ сыров и базовых продуктов — справочная оценка по таблицам состава; это не лабораторный анализ конкретной партии фермы.",
  };
}
