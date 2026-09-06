import type { NutriProfile } from "../drizzle/schema";

export type DairyShareBasis = "calories" | "food_mass" | "delivery";

export type ZoyaCalculationTargets = {
  calorieTarget: number | null;
  calorieTargetSource: "explicit" | "profile_estimate" | "unavailable";
  calorieRange: { min: number; max: number } | null;
  proteinRangeG: { min: number; max: number } | null;
  requestedDairyShare: { percent: number; basis: DairyShareBasis } | null;
  assumptions: string[];
};

function ageFromBirthDate(birthDate: string | null, now = new Date()): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

function extractExplicitCalories(query: string): number | null {
  const match = query.match(/\b(1[2-9]\d{2}|[2-5]\d{3})\s*(?:ккал|кал(?:орий|ории|ория)?)/i);
  return match ? Number(match[1]) : null;
}

function activityFactor(level: NutriProfile["activityLevel"]): number | null {
  if (level === "low") return 1.2;
  if (level === "light") return 1.375;
  if (level === "moderate") return 1.55;
  if (level === "high") return 1.725;
  if (level === "very_high") return 1.9;
  return null;
}

function goalAdjustment(goals: unknown): number {
  const normalized = Array.isArray(goals) ? goals.map(String) : [];
  if (normalized.some((goal) => /(?:снижен|weight_loss|похуд)/i.test(goal))) return 0.9;
  if (normalized.some((goal) => /(?:мышц|muscle_gain|набор)/i.test(goal))) return 1.05;
  return 1;
}

function calculateProfileCalories(profile: NutriProfile): number | null {
  const weight = Number(profile.weightKg);
  const height = Number(profile.heightCm);
  const age = ageFromBirthDate(profile.birthDate);
  const factor = activityFactor(profile.activityLevel);
  if (!Number.isFinite(weight) || !Number.isFinite(height) || !age || !factor) return null;
  if (profile.gender !== "male" && profile.gender !== "female") return null;
  const sexOffset = profile.gender === "male" ? 5 : -161;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  return Math.round((bmr * factor * goalAdjustment(profile.goals)) / 50) * 50;
}

function calculateProteinRange(profile: NutriProfile): { min: number; max: number } | null {
  const weight = Number(profile.weightKg);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  const goals = Array.isArray(profile.goals) ? profile.goals.map(String) : [];
  const sportGoal = goals.some((goal) => /(?:мышц|muscle_gain|вынослив|performance|спорт)/i.test(goal));
  const active = profile.activityLevel === "high" || profile.activityLevel === "very_high";
  const [minPerKg, maxPerKg] = sportGoal || active ? [1.4, 2] : [1, 1.4];
  return {
    min: Math.round(weight * minPerKg),
    max: Math.round(weight * maxPerKg),
  };
}

export function extractRequestedDairyShare(query: string): ZoyaCalculationTargets["requestedDairyShare"] {
  const percentMatch = query.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*%/);
  if (!percentMatch) return null;
  const percent = Number(percentMatch[1].replace(",", "."));
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) return null;
  if (/(?:по\s+масс|массы\s+(?:еды|рациона)|вес(?:а|у)?\s+(?:еды|рациона))/i.test(query)) {
    return { percent, basis: "food_mass" };
  }
  if (/(?:поставк|выдач|годов\w*\s+объ[её]м)/i.test(query)) {
    return { percent, basis: "delivery" };
  }
  if (/(?:калори|ккал)/i.test(query)) return { percent, basis: "calories" };
  return null;
}

export function calculateZoyaTargets(
  profile: NutriProfile | null,
  effectiveQuery: string,
): ZoyaCalculationTargets {
  const explicitCalories = extractExplicitCalories(effectiveQuery);
  const profileCalories = profile ? calculateProfileCalories(profile) : null;
  const calorieTarget = explicitCalories ?? profileCalories;
  const assumptions: string[] = [];
  if (!explicitCalories && profileCalories) {
    assumptions.push("Калорийность оценена по подтверждённым параметрам профиля и уровню активности; это планировочный ориентир.");
  }
  if (explicitCalories) assumptions.push("Использована указанная пользователем целевая калорийность.");
  return {
    calorieTarget,
    calorieTargetSource: explicitCalories ? "explicit" : profileCalories ? "profile_estimate" : "unavailable",
    calorieRange: calorieTarget
      ? { min: Math.round(calorieTarget * 0.95), max: Math.round(calorieTarget * 1.05) }
      : null,
    proteinRangeG: profile ? calculateProteinRange(profile) : null,
    requestedDairyShare: extractRequestedDairyShare(effectiveQuery),
    assumptions,
  };
}

export function parseAmountGrams(amount: string): number | null {
  const normalized = amount.toLowerCase().replace(",", ".");
  const grams = normalized.match(/(\d+(?:\.\d+)?)\s*г(?:рам\w*)?(?:\s|$|[.,;])/);
  if (grams) return Number(grams[1]);
  const kilograms = normalized.match(/(\d+(?:\.\d+)?)\s*кг(?:\s|$|[.,;])/);
  if (kilograms) return Number(kilograms[1]) * 1000;
  const milliliters = normalized.match(/(\d+(?:\.\d+)?)\s*мл(?:\s|$|[.,;])/);
  if (milliliters) return Number(milliliters[1]);
  return null;
}
