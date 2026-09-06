import { describe, expect, it } from "vitest";
import {
  calculateZoyaTargets,
  extractRequestedDairyShare,
  parseAmountGrams,
} from "./zoyaNutritionCalculator";

const profile = {
  gender: "male",
  birthDate: "1979-01-01",
  heightCm: 174,
  weightKg: 102,
  goals: ["muscle_gain"],
  activityLevel: "high",
} as any;

describe("Zoya deterministic nutrition calculator", () => {
  it("prefers an explicit calorie target and computes a protein range from the confirmed profile", () => {
    const targets = calculateZoyaTargets(profile, "Нужно меню на 2500 ккал для роста мышц");
    expect(targets.calorieTarget).toBe(2500);
    expect(targets.calorieTargetSource).toBe("explicit");
    expect(targets.calorieRange).toEqual({ min: 2375, max: 2625 });
    expect(targets.proteinRangeG).toEqual({ min: 143, max: 204 });
  });

  it("produces a transparent profile estimate when calories were not supplied", () => {
    const targets = calculateZoyaTargets(profile, "Составь меню для силовой тренировки");
    expect(targets.calorieTargetSource).toBe("profile_estimate");
    expect(targets.calorieTarget).toBeGreaterThan(2000);
    expect(targets.assumptions[0]).toContain("оценена");
  });

  it("extracts calorie, mass and delivery share bases", () => {
    expect(extractRequestedDairyShare("30% суточной калорийности")).toEqual({ percent: 30, basis: "calories" });
    expect(extractRequestedDairyShare("30% моей продукции по массе еды")).toEqual({ percent: 30, basis: "food_mass" });
    expect(extractRequestedDairyShare("20% моей годовой поставки")).toEqual({ percent: 20, basis: "delivery" });
  });

  it("parses grams, kilograms and milliliters for mass-share validation", () => {
    expect(parseAmountGrams("40 г")).toBe(40);
    expect(parseAmountGrams("0,25 кг")).toBe(250);
    expect(parseAmountGrams("200 мл")).toBe(200);
    expect(parseAmountGrams("одна порция")).toBeNull();
  });
});
