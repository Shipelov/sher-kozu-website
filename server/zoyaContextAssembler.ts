import type { NutriKnowledgeEntry, NutriProfile } from "../drizzle/schema";
import { getNutriSession, getOwnerNutriContext } from "./nutritionistDb";
import { getZoyaRagEntries } from "./zoyaRag";
import {
  getNutritionProfile,
  getNutritionProfileRequirements,
  getPrimaryNutritionProfile,
  type NutritionProfileRequirements,
} from "./zoyaProfiles";
import { calculateZoyaTargets, type ZoyaCalculationTargets } from "./zoyaNutritionCalculator";
import { findReferenceNutrition, type ReferenceNutrition } from "./zoyaProductNutrition";

export type ZoyaIntent =
  | "general_information"
  | "product_information"
  | "recipe"
  | "personal_menu"
  | "sports_nutrition"
  | "medical_safety";

export type ZoyaContextStatus =
  | "ready"
  | "needs_authentication"
  | "needs_profile"
  | "needs_profile_completion"
  | "needs_profile_confirmation"
  | "needs_request_clarification";

export type ZoyaEvidenceLevel =
  | "client_fact"
  | "farm_fact"
  | "verified_knowledge"
  | "trusted_knowledge"
  | "reference_estimate";

export type ConfirmedOwnerProduct = {
  catalogItemId: number | null;
  productType: string | null;
  label: string;
  unit: string | null;
  annualUnits: number | null;
  planId: number;
  animalId: number | null;
  referenceNutrition: ReferenceNutrition | null;
};

export type AvailableProductVariant = {
  animalId: number;
  animalName: string | null;
  label: string;
  productType: string;
  unit: string;
};

export type ZoyaEvidence = {
  level: ZoyaEvidenceLevel;
  key: string;
  value: string;
  sourceId?: number;
  sourceName?: string | null;
  sourceUrl?: string | null;
};

export type ZoyaAssembledContext = {
  status: ZoyaContextStatus;
  intent: ZoyaIntent;
  originalQuery: string;
  effectiveQuery: string;
  requiresPersonalization: boolean;
  profileConfirmed: boolean;
  profile: NutriProfile | null;
  profileRequirements: NutritionProfileRequirements | null;
  pendingClarifications: string[];
  confirmedProducts: ConfirmedOwnerProduct[];
  availableProductVariants: AvailableProductVariant[];
  ownerContext: Awaited<ReturnType<typeof getOwnerNutriContext>>;
  ragEntries: NutriKnowledgeEntry[];
  evidence: ZoyaEvidence[];
  calculationTargets: ZoyaCalculationTargets;
};

type AssembleZoyaContextInput = {
  query: string;
  userId?: number | null;
  userType: "guest" | "registered" | "owner";
  profileId?: number | null;
  profileConfirmed?: boolean;
  sessionId?: number | null;
};

const PERSONAL_QUERY_PATTERN = /(?:мне|мой|моей|моего|для\s+меня|для\s+реб[её]нка|для\s+мужа|для\s+жены|составь|подбери|рассчитай|посчитай|меню|рацион|кбжу|калори|питани[ея]\s+на\s+(?:день|неделю)|сколько\s+мне)/i;
const SPORTS_PATTERN = /(?:спорт|тренир|силов|мышц|массы|бег|плаван|вынослив|восстановлен)/i;
const MEDICAL_PATTERN = /(?:аллерг|неперенос|диабет|беремен|лактац|болезн|диагноз|лечени|давлен|почки|сердц)/i;
const RECIPE_PATTERN = /(?:рецепт|приготов|блюдо|запек|салат|завтрак|обед|ужин)/i;
const PRODUCT_PATTERN = /(?:сыр|молок|кефир|йогурт|брынз|рикотт|халуми|камамбер|продукт)/i;
const OWN_PRODUCT_PATTERN = /(?:мо[яйюего]{1,4}\s+(?:молочн\w+\s+)?продукц|мо[ия]\s+сыр|из\s+мо(?:ей|их)\s+продукц)/i;

export function classifyZoyaIntent(query: string): ZoyaIntent {
  if (MEDICAL_PATTERN.test(query)) return "medical_safety";
  if (SPORTS_PATTERN.test(query) && PERSONAL_QUERY_PATTERN.test(query)) return "sports_nutrition";
  if (/(?:меню|рацион|кбжу|калори|план\s+питани)/i.test(query) && PERSONAL_QUERY_PATTERN.test(query)) return "personal_menu";
  if (RECIPE_PATTERN.test(query)) return "recipe";
  if (PRODUCT_PATTERN.test(query)) return "product_information";
  return "general_information";
}

export function intentRequiresPersonalization(intent: ZoyaIntent, query = ""): boolean {
  if (intent === "personal_menu" || intent === "sports_nutrition") return true;
  if (intent === "medical_safety") return PERSONAL_QUERY_PATTERN.test(query);
  return false;
}

export function collectRequestClarifications(
  query: string,
  confirmedProducts: ConfirmedOwnerProduct[],
): string[] {
  const clarifications: string[] = [];
  const hasPercent = /\b\d{1,2}(?:[.,]\d+)?\s*%/.test(query);
  const hasShareBasis = /(?:калори|ккал|по\s+масс|массы\s+(?:еды|рациона)|поставк|выдач|годов\w*\s+объ[её]м)/i.test(query);
  if (hasPercent && !hasShareBasis) clarifications.push("dairyShareBasis");
  if (OWN_PRODUCT_PATTERN.test(query) && confirmedProducts.length === 0) {
    clarifications.push("confirmedProducts");
  }
  return clarifications;
}

function parseFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractConfirmedOwnerProducts(ownerContext: any): ConfirmedOwnerProduct[] {
  const products: ConfirmedOwnerProduct[] = [];
  for (const plan of ownerContext?.productPlans ?? []) {
    if (plan?.status !== "confirmed") continue;
    try {
      const selections = typeof plan.selectionsJson === "string"
        ? JSON.parse(plan.selectionsJson)
        : plan.selectionsJson;
      if (!Array.isArray(selections)) continue;
      for (const selection of selections) {
        const label = typeof selection?.label === "string" ? selection.label.trim() : "";
        if (!label) continue;
        products.push({
          catalogItemId: parseFiniteNumber(selection.catalogItemId),
          productType: typeof selection.productType === "string" ? selection.productType : null,
          label,
          unit: typeof selection.unit === "string" ? selection.unit : null,
          annualUnits: parseFiniteNumber(selection.annualUnits),
          planId: plan.id,
          animalId: parseFiniteNumber(plan.animalId),
          referenceNutrition: findReferenceNutrition(label, typeof selection.productType === "string" ? selection.productType : null),
        });
      }
    } catch {
      // Malformed legacy rows are ignored rather than exposed to the model.
    }
  }
  return Array.from(new Map(products.map((product) => [
    `${product.catalogItemId ?? "none"}:${product.label.toLowerCase()}`,
    product,
  ])).values());
}

export function extractAvailableProductVariants(ownerContext: any): AvailableProductVariant[] {
  const variants: AvailableProductVariant[] = [];
  for (const animal of ownerContext?.animals ?? []) {
    for (const product of animal.availableProducts ?? []) {
      if (!product?.label || !product?.type) continue;
      variants.push({
        animalId: animal.animalId,
        animalName: animal.animalName ?? null,
        label: product.label,
        productType: product.type,
        unit: product.unit,
      });
    }
  }
  return Array.from(new Map(variants.map((variant) => [
    `${variant.animalId}:${variant.productType}:${variant.label.toLowerCase()}`,
    variant,
  ])).values());
}

function ageFromBirthDate(birthDate: string | null, now = new Date()): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const month = now.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function profileEvidence(profile: NutriProfile): ZoyaEvidence[] {
  const evidence: ZoyaEvidence[] = [];
  const add = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return;
    evidence.push({ level: "client_fact", key, value: Array.isArray(value) ? value.join(", ") : String(value) });
  };
  add("profile_name", profile.profileName);
  add("gender", profile.gender);
  add("age", ageFromBirthDate(profile.birthDate));
  add("height_cm", profile.heightCm);
  add("weight_kg", profile.weightKg);
  add("goals", profile.goals);
  add("activity_level", profile.activityLevel);
  add("activity_details", profile.activityDetails);
  add("allergies", profile.allergies);
  add("restrictions", profile.restrictions);
  add("preferred_products", profile.preferredProducts);
  add("disliked_products", profile.dislikedProducts);
  return evidence;
}

function productEvidence(products: ConfirmedOwnerProduct[], ownerContext: any): ZoyaEvidence[] {
  const evidence: ZoyaEvidence[] = products.map((product) => ({
    level: "farm_fact" as const,
    key: "confirmed_product",
    value: [
      product.label,
      product.annualUnits === null ? null : `${product.annualUnits} ${product.unit ?? "ед."}/год`,
    ].filter(Boolean).join(" — "),
  }));
  for (const animal of ownerContext?.animals ?? []) {
    for (const item of animal.milkComposition ?? []) {
      evidence.push({
        level: "farm_fact",
        key: `milk_composition:${animal.animalSlug}:${item.label}`,
        value: `${item.value}${item.note ? ` (${item.note})` : ""}`,
      });
    }
  }
  return evidence;
}

function referenceNutritionEvidence(products: ConfirmedOwnerProduct[]): ZoyaEvidence[] {
  const seen = new Set<string>();
  const evidence: ZoyaEvidence[] = [];
  for (const product of products) {
    const reference = product.referenceNutrition;
    if (!reference || seen.has(reference.sourceId)) continue;
    seen.add(reference.sourceId);
    evidence.push({
      level: "reference_estimate",
      key: `reference_nutrition:${reference.sourceId}`,
      value: `${reference.analogName}, на 100 г: ${reference.per100g.kcal} ккал; белки ${reference.per100g.proteinG} г; жиры ${reference.per100g.fatG} г; углеводы ${reference.per100g.carbsG} г. Это справочный аналог, не анализ продукта фермы.`,
      sourceName: reference.sourceName,
      sourceUrl: reference.sourceUrl,
    });
  }
  return evidence;
}

function knowledgeEvidence(entries: NutriKnowledgeEntry[]): ZoyaEvidence[] {
  return entries.map((entry) => ({
    level: entry.confidence === "verified" ? "verified_knowledge" : "trusted_knowledge",
    key: `knowledge:${entry.category}:${entry.title}`,
    value: entry.content,
    sourceId: entry.id,
    sourceName: entry.sourceName,
    sourceUrl: entry.sourceUrl,
  }));
}

function mandatorySafetyEvidence(intent: ZoyaIntent, query: string): ZoyaEvidence[] {
  if (intent !== "medical_safety" || !/(?:аллерг|казеин|молочн\w*\s+бел)/i.test(query)) return [];
  return [
    {
      level: "verified_knowledge",
      key: "mandatory_safety:cow_milk_allergy_cross_reactivity",
      value: "Большинство людей с аллергией на белок коровьего молока также реагируют на молоко других млекопитающих. A2-, козье и овечье молоко не считаются безопасной заменой и могут вызвать тяжёлую реакцию, включая анафилаксию.",
      sourceName: "Australasian Society of Clinical Immunology and Allergy — Cow's Milk (Dairy) Allergy",
      sourceUrl: "https://www.allergy.org.au/patients/food-allergy/cows-milk-dairy-allergy",
    },
    {
      level: "verified_knowledge",
      key: "mandatory_safety:goat_cow_milk_cross_reactivity",
      value: "Белки козьего и коровьего молока имеют существенную гомологию и перекрёстную реактивность; козье молоко не рекомендуется как замена при IgE-опосредованной аллергии на белки коровьего молока.",
      sourceName: "Benjamin-van Aalst et al., Nutrients, 2024",
      sourceUrl: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11314217/",
    },
  ];
}

async function resolveProfile(input: AssembleZoyaContextInput): Promise<NutriProfile | null> {
  if (!input.userId) return null;
  if (input.profileId) return getNutritionProfile(input.userId, input.profileId);
  if (input.sessionId) {
    const session = await getNutriSession(input.sessionId);
    if (session?.userId === input.userId && session.profileId) {
      const profile = await getNutritionProfile(input.userId, session.profileId);
      if (profile) return profile;
    }
  }
  return getPrimaryNutritionProfile(input.userId);
}

function isZoyaIntent(value: unknown): value is ZoyaIntent {
  return [
    "general_information",
    "product_information",
    "recipe",
    "personal_menu",
    "sports_nutrition",
    "medical_safety",
  ].includes(String(value));
}

export async function assembleZoyaContext(input: AssembleZoyaContextInput): Promise<ZoyaAssembledContext> {
  const session = input.userId && input.sessionId ? await getNutriSession(input.sessionId) : null;
  const sessionOwned = session?.userId === input.userId ? session : null;
  const previousQuery = typeof sessionOwned?.contextState?.collected?.originalQuery === "string"
    ? sessionOwned.contextState.collected.originalQuery
    : "";
  const originalQuery = previousQuery || input.query;
  const effectiveQuery = sessionOwned?.contextState?.pendingField && previousQuery
    ? `${previousQuery}\nУточнение пользователя: ${input.query}`
    : input.query;
  const intent = isZoyaIntent(sessionOwned?.contextState?.intent)
    ? sessionOwned.contextState.intent
    : classifyZoyaIntent(effectiveQuery);
  const requiresPersonalization = intentRequiresPersonalization(intent, effectiveQuery);
  const profile = await resolveProfile(input);
  const profileRequirements = profile ? getNutritionProfileRequirements(profile) : null;
  const ownerContext = input.userId && input.userType === "owner"
    ? await getOwnerNutriContext(input.userId)
    : null;
  const confirmedProducts = extractConfirmedOwnerProducts(ownerContext);
  const availableProductVariants = extractAvailableProductVariants(ownerContext);
  const ragEntries = await getZoyaRagEntries(
    effectiveQuery,
    intent === "medical_safety" ? "medical" : requiresPersonalization ? "personalized" : "general",
  );
  const pendingClarifications = collectRequestClarifications(effectiveQuery, confirmedProducts);

  let status: ZoyaContextStatus = "ready";
  if (requiresPersonalization && !input.userId) {
    status = "needs_authentication";
  } else if (requiresPersonalization && !profile) {
    status = "needs_profile";
  } else if (requiresPersonalization && profileRequirements && !profileRequirements.isComplete) {
    status = "needs_profile_completion";
    pendingClarifications.push(...profileRequirements.missingFields);
  } else if (requiresPersonalization && profile && !input.profileConfirmed) {
    status = "needs_profile_confirmation";
  } else if (requiresPersonalization && pendingClarifications.length > 0) {
    status = "needs_request_clarification";
  }

  return {
    status,
    intent,
    originalQuery,
    effectiveQuery,
    requiresPersonalization,
    profileConfirmed: Boolean(input.profileConfirmed),
    profile,
    profileRequirements,
    pendingClarifications,
    confirmedProducts,
    availableProductVariants,
    ownerContext,
    ragEntries,
    evidence: [
      ...(profile && input.profileConfirmed ? profileEvidence(profile) : []),
      ...productEvidence(confirmedProducts, ownerContext),
      ...referenceNutritionEvidence(confirmedProducts),
      ...mandatorySafetyEvidence(intent, effectiveQuery),
      ...knowledgeEvidence(ragEntries),
    ],
    calculationTargets: calculateZoyaTargets(
      profile && input.profileConfirmed ? profile : null,
      effectiveQuery,
    ),
  };
}

export function buildZoyaSessionState(context: ZoyaAssembledContext) {
  const pendingField = context.status === "needs_request_clarification"
    ? context.pendingClarifications[0]
    : undefined;
  return {
    intent: context.intent,
    pendingField,
    collected: {
      originalQuery: context.originalQuery,
      profileId: context.profile?.id ?? 0,
    },
  };
}
