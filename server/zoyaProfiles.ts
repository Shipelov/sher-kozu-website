import { and, asc, eq, isNull } from "drizzle-orm";
import { nutriProfiles, type NutriProfile } from "../drizzle/schema";
import { getDb } from "./db";

export const MAX_NUTRITION_PROFILES_PER_USER = 8;
export const PROFILE_REVIEW_INTERVAL_DAYS = 90;

export const NUTRITION_PROFILE_REQUIRED_FIELDS = [
  "profileName",
  "relationship",
  "gender",
  "birthDate",
  "heightCm",
  "weightKg",
  "goals",
  "activityLevel",
  "allergies",
  "restrictions",
] as const;

export type NutritionProfileRequiredField = (typeof NUTRITION_PROFILE_REQUIRED_FIELDS)[number];
export type NutritionProfileRelationship = "self" | "spouse" | "child" | "family" | "other";
export type NutritionProfileGender = "male" | "female";
export type NutritionActivityLevel = "low" | "light" | "moderate" | "high" | "very_high";

export type NutritionProfileInput = {
  profileName?: string | null;
  relationship?: NutritionProfileRelationship | null;
  gender?: NutritionProfileGender | null;
  birthDate?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: NutritionActivityLevel | null;
  activityDetails?: string | null;
  goals?: string[] | null;
  allergies?: string[] | null;
  restrictions?: string[] | null;
  preferredProducts?: string[] | null;
  dislikedProducts?: string[] | null;
  mealPreferences?: {
    mealsPerDay?: number;
    preferredTimes?: string[];
    notes?: string;
  } | null;
  medicalNotes?: string | null;
  noAllergiesConfirmed?: boolean;
  noRestrictionsConfirmed?: boolean;
};

export type NutritionProfileRequirements = {
  isComplete: boolean;
  missingFields: NutritionProfileRequiredField[];
  needsReview: boolean;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasArrayValues(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

export function getNutritionProfileRequirements(
  profile: Pick<NutriProfile,
    | "profileName"
    | "relationship"
    | "gender"
    | "birthDate"
    | "heightCm"
    | "weightKg"
    | "goals"
    | "activityLevel"
    | "allergies"
    | "restrictions"
    | "noAllergiesConfirmed"
    | "noRestrictionsConfirmed"
    | "lastReviewedAt"
  >,
  now = new Date(),
): NutritionProfileRequirements {
  const missingFields: NutritionProfileRequiredField[] = [];

  if (!hasText(profile.profileName)) missingFields.push("profileName");
  if (!profile.relationship) missingFields.push("relationship");
  if (!profile.gender) missingFields.push("gender");
  if (!profile.birthDate) missingFields.push("birthDate");
  if (!profile.heightCm || profile.heightCm < 50 || profile.heightCm > 250) missingFields.push("heightCm");
  if (!profile.weightKg || profile.weightKg < 15 || profile.weightKg > 400) missingFields.push("weightKg");
  if (!hasArrayValues(profile.goals)) missingFields.push("goals");
  if (!profile.activityLevel) missingFields.push("activityLevel");
  if (!hasArrayValues(profile.allergies) && !profile.noAllergiesConfirmed) missingFields.push("allergies");
  if (!hasArrayValues(profile.restrictions) && !profile.noRestrictionsConfirmed) missingFields.push("restrictions");

  const reviewThreshold = now.getTime() - PROFILE_REVIEW_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  const needsReview = !profile.lastReviewedAt || profile.lastReviewedAt.getTime() < reviewThreshold;

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    needsReview,
  };
}

function normalizeStringArray(value: string[] | null | undefined): string[] | null | undefined {
  if (value == null) return value;
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}

function normalizeInput(data: NutritionProfileInput): NutritionProfileInput {
  return {
    ...data,
    profileName: data.profileName === undefined ? undefined : data.profileName?.trim() || null,
    activityDetails: data.activityDetails === undefined ? undefined : data.activityDetails?.trim() || null,
    medicalNotes: data.medicalNotes === undefined ? undefined : data.medicalNotes?.trim() || null,
    goals: normalizeStringArray(data.goals),
    allergies: normalizeStringArray(data.allergies),
    restrictions: normalizeStringArray(data.restrictions),
    preferredProducts: normalizeStringArray(data.preferredProducts),
    dislikedProducts: normalizeStringArray(data.dislikedProducts),
  };
}

function toUpdateSet(data: NutritionProfileInput): Record<string, unknown> {
  const normalized = normalizeInput(data);
  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined));
}

export async function listNutritionProfiles(userId: number): Promise<NutriProfile[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(nutriProfiles)
    .where(and(eq(nutriProfiles.userId, userId), isNull(nutriProfiles.archivedAt)))
    .orderBy(asc(nutriProfiles.createdAt));
  return [...rows].sort((a: NutriProfile, b: NutriProfile) => Number(b.isPrimary) - Number(a.isPrimary));
}

export async function getNutritionProfile(userId: number, profileId: number): Promise<NutriProfile | null> {
  const db = await getDb();
  if (!db) return null;

  const [profile] = await db
    .select()
    .from(nutriProfiles)
    .where(and(
      eq(nutriProfiles.id, profileId),
      eq(nutriProfiles.userId, userId),
      isNull(nutriProfiles.archivedAt),
    ))
    .limit(1);

  return profile ?? null;
}

export async function getPrimaryNutritionProfile(userId: number): Promise<NutriProfile | null> {
  const db = await getDb();
  if (!db) return null;

  const [primary] = await db
    .select()
    .from(nutriProfiles)
    .where(and(
      eq(nutriProfiles.userId, userId),
      eq(nutriProfiles.isPrimary, true),
      isNull(nutriProfiles.archivedAt),
    ))
    .orderBy(asc(nutriProfiles.id))
    .limit(1);
  if (primary) return primary;

  const [fallback] = await db
    .select()
    .from(nutriProfiles)
    .where(and(eq(nutriProfiles.userId, userId), isNull(nutriProfiles.archivedAt)))
    .orderBy(asc(nutriProfiles.id))
    .limit(1);
  return fallback ?? null;
}

export async function createNutritionProfile(
  userId: number,
  data: NutritionProfileInput,
): Promise<NutriProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  return db.transaction(async (tx: any) => {
    const activeProfiles = await tx
      .select({ id: nutriProfiles.id })
      .from(nutriProfiles)
      .where(and(eq(nutriProfiles.userId, userId), isNull(nutriProfiles.archivedAt)));
    if (activeProfiles.length >= MAX_NUTRITION_PROFILES_PER_USER) {
      throw new Error("NUTRITION_PROFILE_LIMIT_REACHED");
    }

    const isPrimary = activeProfiles.length === 0;
    const normalized = normalizeInput(data);
    const [result] = await tx.insert(nutriProfiles).values({
      userId,
      profileName: normalized.profileName ?? (isPrimary ? "Основной профиль" : "Новый профиль"),
      relationship: normalized.relationship ?? (isPrimary ? "self" : "other"),
      gender: normalized.gender ?? undefined,
      birthDate: normalized.birthDate ?? undefined,
      heightCm: normalized.heightCm ?? undefined,
      weightKg: normalized.weightKg ?? undefined,
      activityLevel: normalized.activityLevel ?? undefined,
      activityDetails: normalized.activityDetails ?? undefined,
      goals: normalized.goals ?? [],
      allergies: normalized.allergies ?? [],
      restrictions: normalized.restrictions ?? [],
      familyMembers: [],
      preferredProducts: normalized.preferredProducts ?? [],
      dislikedProducts: normalized.dislikedProducts ?? [],
      mealPreferences: normalized.mealPreferences ?? undefined,
      medicalNotes: normalized.medicalNotes ?? undefined,
      noAllergiesConfirmed: normalized.noAllergiesConfirmed ?? false,
      noRestrictionsConfirmed: normalized.noRestrictionsConfirmed ?? false,
      isPrimary,
      onboardingStatus: "draft",
    }).$returningId();

    const [profile] = await tx.select().from(nutriProfiles).where(eq(nutriProfiles.id, result.id)).limit(1);
    return profile as NutriProfile;
  });
}

export async function updateNutritionProfile(
  userId: number,
  profileId: number,
  data: NutritionProfileInput,
): Promise<NutriProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const existing = await getNutritionProfile(userId, profileId);
  if (!existing) throw new Error("NUTRITION_PROFILE_NOT_FOUND");

  await db
    .update(nutriProfiles)
    .set(toUpdateSet(data))
    .where(and(eq(nutriProfiles.id, profileId), eq(nutriProfiles.userId, userId)));

  const updated = await getNutritionProfile(userId, profileId);
  if (!updated) throw new Error("NUTRITION_PROFILE_NOT_FOUND");
  const requirements = getNutritionProfileRequirements(updated);
  if (updated.onboardingStatus !== (requirements.isComplete ? "complete" : "draft")) {
    await db
      .update(nutriProfiles)
      .set({ onboardingStatus: requirements.isComplete ? "complete" : "draft" })
      .where(eq(nutriProfiles.id, profileId));
    return (await getNutritionProfile(userId, profileId))!;
  }
  return updated;
}

export async function setPrimaryNutritionProfile(userId: number, profileId: number): Promise<NutriProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  return db.transaction(async (tx: any) => {
    const [profile] = await tx
      .select()
      .from(nutriProfiles)
      .where(and(
        eq(nutriProfiles.id, profileId),
        eq(nutriProfiles.userId, userId),
        isNull(nutriProfiles.archivedAt),
      ))
      .limit(1);
    if (!profile) throw new Error("NUTRITION_PROFILE_NOT_FOUND");

    await tx
      .update(nutriProfiles)
      .set({ isPrimary: false })
      .where(eq(nutriProfiles.userId, userId));
    await tx
      .update(nutriProfiles)
      .set({ isPrimary: true })
      .where(eq(nutriProfiles.id, profileId));

    return { ...profile, isPrimary: true } as NutriProfile;
  });
}

export async function confirmNutritionProfile(userId: number, profileId: number): Promise<NutriProfile> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const profile = await getNutritionProfile(userId, profileId);
  if (!profile) throw new Error("NUTRITION_PROFILE_NOT_FOUND");

  const requirements = getNutritionProfileRequirements(profile);
  if (!requirements.isComplete) {
    throw new Error(`NUTRITION_PROFILE_INCOMPLETE:${requirements.missingFields.join(",")}`);
  }

  const now = new Date();
  await db
    .update(nutriProfiles)
    .set({ onboardingStatus: "complete", confirmedAt: now, lastReviewedAt: now })
    .where(eq(nutriProfiles.id, profileId));
  return (await getNutritionProfile(userId, profileId))!;
}

export async function archiveNutritionProfile(userId: number, profileId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const profile = await getNutritionProfile(userId, profileId);
  if (!profile) throw new Error("NUTRITION_PROFILE_NOT_FOUND");
  if (profile.isPrimary) throw new Error("PRIMARY_NUTRITION_PROFILE_CANNOT_BE_ARCHIVED");

  await db
    .update(nutriProfiles)
    .set({ archivedAt: new Date() })
    .where(and(eq(nutriProfiles.id, profileId), eq(nutriProfiles.userId, userId)));
}
