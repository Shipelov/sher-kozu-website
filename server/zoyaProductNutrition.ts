export type ReferenceNutrition = {
  analogName: string;
  per100g: {
    kcal: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
  sourceName: string;
  sourceUrl: string;
  sourceId: string;
};

const REFERENCES: Array<{ pattern: RegExp; value: ReferenceNutrition }> = [
  {
    pattern: /(?:брынз|фет)/i,
    value: {
      analogName: "Cheese, feta",
      per100g: { kcal: 265, proteinG: 14.2, fatG: 21.5, carbsG: 3.88 },
      sourceName: "USDA FoodData Central, SR Legacy",
      sourceUrl: "https://fdc.nal.usda.gov/food-details/173420/nutrients",
      sourceId: "USDA FDC 173420",
    },
  },
  {
    pattern: /халуми/i,
    value: {
      analogName: "Cheese, Halloumi",
      per100g: { kcal: 290, proteinG: 22.3, fatG: 21.9, carbsG: 0.9 },
      sourceName: "Matvaretabellen — Norwegian Food Composition Table",
      sourceUrl: "https://www.matvaretabellen.no/en/cheese-halloumi/",
      sourceId: "Food ID 01.270",
    },
  },
  {
    pattern: /рикотт/i,
    value: {
      analogName: "Cheese, ricotta, whole milk",
      per100g: { kcal: 150, proteinG: 7.54, fatG: 10.18, carbsG: 7.27 },
      sourceName: "USDA FoodData Central, SR Legacy",
      sourceUrl: "https://fdc.nal.usda.gov/food-details/170851/nutrients",
      sourceId: "USDA FDC 170851",
    },
  },
  {
    pattern: /камамбер/i,
    value: {
      analogName: "Cheese, camembert",
      per100g: { kcal: 300, proteinG: 19.8, fatG: 24.26, carbsG: 0.46 },
      sourceName: "USDA FoodData Central, SR Legacy",
      sourceUrl: "https://fdc.nal.usda.gov/food-details/172178/nutrients",
      sourceId: "USDA FDC 172178",
    },
  },
];

export function findReferenceNutrition(label: string, productType?: string | null): ReferenceNutrition | null {
  const value = `${label} ${productType ?? ""}`;
  return REFERENCES.find((item) => item.pattern.test(value))?.value ?? null;
}

export function scaleReferenceNutrition(reference: ReferenceNutrition, grams: number) {
  const factor = grams / 100;
  return {
    kcal: reference.per100g.kcal * factor,
    proteinG: reference.per100g.proteinG * factor,
    fatG: reference.per100g.fatG * factor,
    carbsG: reference.per100g.carbsG * factor,
  };
}
