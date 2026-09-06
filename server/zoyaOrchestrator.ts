import { z } from "zod";
import type { Message } from "./_core/llm";
import { jsonrepair } from "jsonrepair";
import { invokeZoyaLLM } from "./zoyaChatRuntime";
import type { ZoyaAssembledContext } from "./zoyaContextAssembler";
import { parseAmountGrams } from "./zoyaNutritionCalculator";
import { scaleReferenceNutrition } from "./zoyaProductNutrition";
import { buildZoyaDeterministicMenuDraft } from "./zoyaMenuPlanner";

export type ZoyaConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

const nullableNutritionNumber = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase().replace(",", ".");
  if (["null", "нет данных", "неизвестно", "-"].includes(normalized)) return null;
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : value;
}, z.number().nonnegative().nullable());

const nutritionBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

const nutritionSchema = z.object({
  kcal: nullableNutritionNumber,
  proteinG: nullableNutritionNumber,
  fatG: nullableNutritionNumber,
  carbsG: nullableNutritionNumber,
  estimated: nutritionBoolean,
});

const itemSchema = z.object({
  name: z.string().min(1),
  amount: z.string().min(1),
  farmProduct: z.boolean(),
  nutrition: nutritionSchema,
});

const mealSchema = z.object({
  name: z.string().min(1),
  time: z.string(),
  items: z.array(itemSchema),
  nutrition: nutritionSchema,
});

export const zoyaStructuredResponseSchema = z.object({
  summary: z.string().min(1),
  consideredFacts: z.array(z.string()).max(12),
  answer: z.string().min(1),
  mealPlan: z.object({
    enabled: z.boolean(),
    title: z.string(),
    meals: z.array(mealSchema).max(8),
    dailyNutrition: nutritionSchema,
    farmProductShareText: z.string(),
  }),
  substitutions: z.array(z.object({
    replace: z.string().min(1),
    with: z.string().min(1),
    reason: z.string().min(1),
    farmProduct: z.boolean(),
  })).max(2),
  warnings: z.array(z.string()).max(6),
  sources: z.array(z.object({
    evidenceId: z.number().int().positive(),
    title: z.string().min(1),
  })).max(8),
  referenceNote: z.string(),
});

export type ZoyaStructuredResponse = z.infer<typeof zoyaStructuredResponseSchema>;

const zoyaMenuNarrativeSchema = z.object({
  summary: z.string().min(1),
  consideredFacts: z.array(z.string()).max(8),
  answer: z.string().min(1),
  warnings: z.array(z.string()).max(4),
});

const ZOYA_PROMPT_RESPONSE_TEMPLATE = {
  summary: "",
  consideredFacts: [""],
  answer: "",
  mealPlan: {
    enabled: false,
    title: "",
    meals: [{
      name: "",
      time: "",
      items: [{
        name: "",
        amount: "",
        farmProduct: false,
        nutrition: { kcal: null, proteinG: null, fatG: null, carbsG: null, estimated: true },
      }],
      nutrition: { kcal: null, proteinG: null, fatG: null, carbsG: null, estimated: true },
    }],
    dailyNutrition: { kcal: null, proteinG: null, fatG: null, carbsG: null, estimated: true },
    farmProductShareText: "",
  },
  substitutions: [{ replace: "", with: "", reason: "", farmProduct: false }],
  warnings: [""],
  sources: [{ evidenceId: 1, title: "" }],
  referenceNote: "",
};

const nullableNumberSchema = { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] };
const nutritionJsonSchema = {
  type: "object",
  properties: {
    kcal: nullableNumberSchema,
    proteinG: nullableNumberSchema,
    fatG: nullableNumberSchema,
    carbsG: nullableNumberSchema,
    estimated: { type: "boolean" },
  },
  required: ["kcal", "proteinG", "fatG", "carbsG", "estimated"],
  additionalProperties: false,
};

export const ZOYA_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "zoya_verified_answer",
    strict: true,
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        consideredFacts: { type: "array", items: { type: "string" }, maxItems: 12 },
        answer: { type: "string" },
        mealPlan: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            title: { type: "string" },
            meals: {
              type: "array",
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  time: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        amount: { type: "string" },
                        farmProduct: { type: "boolean" },
                        nutrition: nutritionJsonSchema,
                      },
                      required: ["name", "amount", "farmProduct", "nutrition"],
                      additionalProperties: false,
                    },
                  },
                  nutrition: nutritionJsonSchema,
                },
                required: ["name", "time", "items", "nutrition"],
                additionalProperties: false,
              },
            },
            dailyNutrition: nutritionJsonSchema,
            farmProductShareText: { type: "string" },
          },
          required: ["enabled", "title", "meals", "dailyNutrition", "farmProductShareText"],
          additionalProperties: false,
        },
        substitutions: {
          type: "array",
          maxItems: 2,
          items: {
            type: "object",
            properties: {
              replace: { type: "string" },
              with: { type: "string" },
              reason: { type: "string" },
              farmProduct: { type: "boolean" },
            },
            required: ["replace", "with", "reason", "farmProduct"],
            additionalProperties: false,
          },
        },
        warnings: { type: "array", items: { type: "string" }, maxItems: 6 },
        sources: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              evidenceId: { type: "integer", minimum: 1 },
              title: { type: "string" },
            },
            required: ["evidenceId", "title"],
            additionalProperties: false,
          },
        },
        referenceNote: { type: "string" },
      },
      required: [
        "summary",
        "consideredFacts",
        "answer",
        "mealPlan",
        "substitutions",
        "warnings",
        "sources",
        "referenceNote",
      ],
      additionalProperties: false,
    },
  },
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

function safeProfile(context: ZoyaAssembledContext) {
  const profile = context.profile;
  if (!profile || !context.profileConfirmed) return null;
  return {
    id: profile.id,
    name: profile.profileName,
    relationship: profile.relationship,
    gender: profile.gender,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goals: profile.goals ?? [],
    activityLevel: profile.activityLevel,
    activityDetails: profile.activityDetails,
    allergies: profile.allergies ?? [],
    restrictions: profile.restrictions ?? [],
    preferredProducts: profile.preferredProducts ?? [],
    dislikedProducts: profile.dislikedProducts ?? [],
    mealPreferences: profile.mealPreferences,
    medicalNotes: profile.medicalNotes,
  };
}

export function buildZoyaOrchestratorPrompt(context: ZoyaAssembledContext): string {
  const evidence = context.evidence.map((item, index) => ({ id: index + 1, ...item }));
  const confirmedProducts = context.confirmedProducts.map((product) => ({
    label: product.label,
    productType: product.productType,
    annualUnits: product.annualUnits,
    unit: product.unit,
    referenceNutrition: product.referenceNutrition
      ? {
        per100g: product.referenceNutrition.per100g,
        sourceName: product.referenceNutrition.sourceName,
        sourceUrl: product.referenceNutrition.sourceUrl,
      }
      : null,
  }));
  const availableProductVariants = context.availableProductVariants.map((product) => ({
    label: product.label,
    productType: product.productType,
    unit: product.unit,
  }));
  return `Ты — Зоя, AI-нутрициолог семейной фермы «Шерь Козу». Отвечай на русском языке.

Твоя задача — сформировать полезный естественный ответ, используя только предоставленные ниже факты. Не придумывай профиль, продукты фермы, наличие, лабораторные показатели, КБЖУ или научные утверждения.

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:
1. Фактической продукцией клиента являются ТОЛЬКО элементы confirmedProducts. availableProductVariants — лишь возможные варианты и не должны называться текущей поставкой.
2. Если у конкретного продукта нет лабораторных КБЖУ, допускается справочная оценка по ближайшему типу, но nutrition.estimated=true и referenceNote должен прямо это объяснить.
3. Персональное меню должно быть полноценным: белковые продукты, сложные углеводы, овощи/фрукты и источники ненасыщенных жиров. Молочная продукция — часть рациона, не весь рацион.
4. Для меню укажи КБЖУ каждого приёма и итог дня. Если достоверный расчёт невозможен, используй null, а не выдуманное число.
5. Дай основной вариант и не более двух замен. Замены фермерской продукции также должны быть из confirmedProducts.
6. Строго соблюдай allergies, restrictions и dislikedProducts. Не ставь диагнозы, не назначай лечение. При аллергии на молочный белок не называй козье или овечье молоко безопасной заменой.
7. Научные утверждения основывай только на evidence. В sources указывай только evidence ID из входных данных.
8. Не повторяй длинные формальные предупреждения. Добавляй только предупреждения, релевантные запросу и профилю.
9. Верни только JSON, соответствующий заданной схеме.

ОБЯЗАТЕЛЬНЫЙ JSON-ШАБЛОН (сохрани все поля и типы; ненужные массивы оставь пустыми):
${JSON.stringify(ZOYA_PROMPT_RESPONSE_TEMPLATE)}

КОНТЕКСТ:
${JSON.stringify({
    intent: context.intent,
    effectiveQuery: context.effectiveQuery,
    profile: safeProfile(context),
    confirmedProducts,
    availableProductVariants,
    calculationTargets: context.calculationTargets,
    evidence,
  })}
`;
}

class ZoyaStructuredOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoyaStructuredOutputError";
  }
}

const emptyNutrition = () => ({
  kcal: null,
  proteinG: null,
  fatG: null,
  carbsG: null,
  estimated: false,
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function completeStructuredCandidate(value: unknown): unknown {
  const candidate = asRecord(value);
  const rawMealPlan = asRecord(candidate.mealPlan);
  const meals = Array.isArray(rawMealPlan.meals) ? rawMealPlan.meals : [];
  const summary = typeof candidate.summary === "string" && candidate.summary.trim()
    ? candidate.summary.trim()
    : typeof candidate.answer === "string" && candidate.answer.trim()
      ? candidate.answer.trim().split(/(?<=[.!?])\s/)[0].slice(0, 180)
      : meals.length > 0
        ? "Персональный рацион"
        : "";
  const answer = typeof candidate.answer === "string" && candidate.answer.trim()
    ? candidate.answer.trim()
    : summary
      ? summary
      : meals.length > 0
        ? "Ниже приведён рассчитанный вариант рациона."
        : "";

  return {
    ...candidate,
    summary,
    consideredFacts: Array.isArray(candidate.consideredFacts)
      ? candidate.consideredFacts.filter((item): item is string => typeof item === "string")
      : [],
    answer,
    mealPlan: {
      ...rawMealPlan,
      enabled: rawMealPlan.enabled === true || rawMealPlan.enabled === "true",
      title: typeof rawMealPlan.title === "string" ? rawMealPlan.title : "",
      meals,
      dailyNutrition: Object.keys(asRecord(rawMealPlan.dailyNutrition)).length > 0
        ? rawMealPlan.dailyNutrition
        : emptyNutrition(),
      farmProductShareText: typeof rawMealPlan.farmProductShareText === "string"
        ? rawMealPlan.farmProductShareText
        : "",
    },
    substitutions: Array.isArray(candidate.substitutions) ? candidate.substitutions : [],
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings.filter((item): item is string => typeof item === "string")
      : [],
    sources: Array.isArray(candidate.sources) ? candidate.sources : [],
    referenceNote: typeof candidate.referenceNote === "string" ? candidate.referenceNote : "",
  };
}

function parseStructuredContent(content: unknown): ZoyaStructuredResponse {
  try {
    if (content && typeof content === "object" && !Array.isArray(content)) {
      return zoyaStructuredResponseSchema.parse(completeStructuredCandidate(content));
    }

    const text = Array.isArray(content)
      ? content
        .filter((part): part is { type: "text"; text: string } => (
          Boolean(part)
          && typeof part === "object"
          && (part as { type?: unknown }).type === "text"
          && typeof (part as { text?: unknown }).text === "string"
        ))
        .map((part) => part.text)
        .join("")
      : content;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("content_missing");
    }
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = JSON.parse(jsonrepair(cleaned));
    }
    return zoyaStructuredResponseSchema.parse(completeStructuredCandidate(parsed));
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 160) : "unknown";
    throw new ZoyaStructuredOutputError(`ZOYA_STRUCTURED_OUTPUT_INVALID:${reason}`);
  }
}

function parseMenuNarrative(content: unknown): z.infer<typeof zoyaMenuNarrativeSchema> {
  try {
    const text = Array.isArray(content)
      ? content
        .filter((part): part is { type: "text"; text: string } => (
          Boolean(part)
          && typeof part === "object"
          && (part as { type?: unknown }).type === "text"
          && typeof (part as { text?: unknown }).text === "string"
        ))
        .map((part) => part.text)
        .join("")
      : content;
    if (typeof text !== "string" || !text.trim()) throw new Error("content_missing");
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = JSON.parse(jsonrepair(cleaned));
    }
    const candidate = asRecord(parsed);
    return zoyaMenuNarrativeSchema.parse({
      summary: candidate.summary,
      consideredFacts: Array.isArray(candidate.consideredFacts)
        ? candidate.consideredFacts.filter((item): item is string => typeof item === "string")
        : [],
      answer: candidate.answer,
      warnings: Array.isArray(candidate.warnings)
        ? candidate.warnings.filter((item): item is string => typeof item === "string")
        : [],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 160) : "unknown";
    throw new ZoyaStructuredOutputError(`ZOYA_MENU_NARRATIVE_INVALID:${reason}`);
  }
}

export function buildMenuNarrativePrompt(
  context: ZoyaAssembledContext,
  draft: ZoyaStructuredResponse,
): string {
  return `Ты — Зоя, AI-нутрициолог фермы «Шерь Козу». Сервер уже рассчитал и проверил меню. Не меняй продукты, порции, КБЖУ, долю продукции, замены или источники.

Верни только JSON:
{"summary":"краткий заголовок","consideredFacts":["до 8 фактов"],"answer":"2–4 предложения: почему рацион сбалансирован и как использовать продукты фермы","warnings":["только необходимые предупреждения"]}

ПРОФИЛЬ И ЦЕЛЬ:
${JSON.stringify({ profile: safeProfile(context), calculationTargets: context.calculationTargets })}

ПРОВЕРЕННЫЙ РАСЧЁТ:
${JSON.stringify({
    meals: draft.mealPlan.meals.map((meal) => ({
      name: meal.name,
      items: meal.items.map((item) => ({ name: item.name, amount: item.amount, farmProduct: item.farmProduct })),
    })),
    dailyNutrition: draft.mealPlan.dailyNutrition,
    farmProductShareText: draft.mealPlan.farmProductShareText,
    substitutions: draft.substitutions,
  })}

ПРОВЕРЕННЫЕ ЗНАНИЯ:
${JSON.stringify(context.evidence.slice(0, 8).map((item, index) => ({
    id: index + 1,
    level: item.level,
    value: item.value,
    sourceName: item.sourceName,
  })))}
`;
}

function evidenceSupportsTerm(context: ZoyaAssembledContext, pattern: RegExp): boolean {
  return context.evidence.some((item) => pattern.test(`${item.key} ${item.value}`));
}

function sanitizeMenuNarrative(text: string, context: ZoyaAssembledContext): string {
  const unsupported: Array<{ claim: RegExp; evidence: RegExp }> = [
    { claim: /кальц/i, evidence: /кальц/i },
    { claim: /витамин/i, evidence: /витамин/i },
    { claim: /иммун/i, evidence: /иммун/i },
    { claim: /давлен/i, evidence: /давлен/i },
    { claim: /холестерин/i, evidence: /холестерин/i },
    { claim: /лечит|лечебн|профилактик/i, evidence: /лечит|лечебн|профилактик/i },
  ];
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !unsupported.some(({ claim, evidence }) => (
      claim.test(sentence) && !evidenceSupportsTerm(context, evidence)
    )))
    .join(" ")
    .trim();
}

function isAllowedFarmProduct(name: string, context: ZoyaAssembledContext): boolean {
  return Boolean(findAllowedFarmProduct(name, context));
}

function findAllowedFarmProduct(name: string, context: ZoyaAssembledContext) {
  const normalizedName = normalize(name);
  return context.confirmedProducts.find((product) => {
    const normalizedLabel = normalize(product.label);
    return normalizedName === normalizedLabel || normalizedName.startsWith(`${normalizedLabel} `);
  }) ?? null;
}

function closeEnough(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= Math.max(5, Math.abs(expected) * 0.12);
}

function validateNutritionArithmetic(response: ZoyaStructuredResponse): string[] {
  const errors: string[] = [];
  if (!response.mealPlan.enabled) return errors;
  const keys = ["kcal", "proteinG", "fatG", "carbsG"] as const;

  for (const meal of response.mealPlan.meals) {
    for (const key of keys) {
      const itemValues = meal.items.map((item) => item.nutrition[key]);
      const declared = meal.nutrition[key];
      if (declared === null || itemValues.some((value) => value === null)) continue;
      const sum = itemValues
        .filter((value): value is number => value !== null)
        .reduce((total, value) => total + value, 0);
      if (!closeEnough(declared, sum)) errors.push(`meal_total:${meal.name}:${key}`);
    }
  }

  for (const key of keys) {
    const mealValues = response.mealPlan.meals.map((meal) => meal.nutrition[key]);
    const declared = response.mealPlan.dailyNutrition[key];
    if (declared === null || mealValues.some((value) => value === null)) continue;
    const sum = mealValues
      .filter((value): value is number => value !== null)
      .reduce((total, value) => total + value, 0);
    if (!closeEnough(declared, sum)) errors.push(`daily_total:${key}`);
  }
  return errors;
}

function validateCalculationTargets(
  response: ZoyaStructuredResponse,
  context: ZoyaAssembledContext,
): string[] {
  if (!response.mealPlan.enabled) return [];
  const errors: string[] = [];
  const targets = context.calculationTargets;
  const daily = response.mealPlan.dailyNutrition;

  if (targets.calorieTarget && daily.kcal !== null) {
    const deviation = Math.abs(daily.kcal - targets.calorieTarget) / targets.calorieTarget;
    if (deviation > 0.15) errors.push("calorie_target_deviation");
  }
  if (targets.proteinRangeG && daily.proteinG !== null) {
    if (daily.proteinG < targets.proteinRangeG.min * 0.85 || daily.proteinG > targets.proteinRangeG.max * 1.15) {
      errors.push("protein_target_deviation");
    }
  }

  const share = targets.requestedDairyShare;
  if (!share || share.basis === "delivery") return errors;
  if (share.basis === "calories" && daily.kcal) {
    const farmCalories = response.mealPlan.meals.flatMap((meal) => meal.items)
      .filter((item) => item.farmProduct)
      .reduce((total, item) => total + (item.nutrition.kcal ?? 0), 0);
    if (farmCalories > 0) {
      const actualPercent = (farmCalories / daily.kcal) * 100;
      if (Math.abs(actualPercent - share.percent) > 5) errors.push("dairy_calorie_share_deviation");
    }
  }
  if (share.basis === "food_mass") {
    const items = response.mealPlan.meals.flatMap((meal) => meal.items);
    const parsed = items.map((item) => ({ item, grams: parseAmountGrams(item.amount) }));
    if (parsed.every(({ grams }) => grams !== null)) {
      const totalMass = parsed.reduce((total, { grams }) => total + (grams ?? 0), 0);
      const farmMass = parsed.filter(({ item }) => item.farmProduct)
        .reduce((total, { grams }) => total + (grams ?? 0), 0);
      if (totalMass > 0) {
        const actualPercent = (farmMass / totalMass) * 100;
        if (Math.abs(actualPercent - share.percent) > 5) errors.push("dairy_mass_share_deviation");
      }
    }
  }
  return errors;
}

export function validateZoyaStructuredResponse(
  response: ZoyaStructuredResponse,
  context: ZoyaAssembledContext,
): string[] {
  const errors = validateNutritionArithmetic(response);
  errors.push(...validateCalculationTargets(response, context));
  const allowedEvidenceIds = new Set(context.evidence.map((_, index) => index + 1));
  const requiresMealPlan = context.intent === "personal_menu" || context.intent === "sports_nutrition";
  if (requiresMealPlan) {
    if (!response.mealPlan.enabled) errors.push("meal_plan_required");
    if (response.mealPlan.meals.length < 3) errors.push("meal_plan_incomplete");
    if (context.confirmedProducts.length > 0) {
      const hasFarmProduct = response.mealPlan.meals
        .flatMap((meal) => meal.items)
        .some((item) => item.farmProduct);
      if (!hasFarmProduct) errors.push("farm_product_required");
      if (context.confirmedProducts.length > 1 && response.substitutions.length === 0) {
        errors.push("farm_substitution_required");
      }
    }
  }

  for (const meal of response.mealPlan.meals) {
    for (const item of meal.items) {
      if (item.farmProduct) {
        const product = findAllowedFarmProduct(item.name, context);
        if (!product) {
          errors.push(`unknown_farm_product:${item.name}`);
        } else {
          const grams = parseAmountGrams(item.amount);
          const reference = product.referenceNutrition;
          const hasNutrition = [
            item.nutrition.kcal,
            item.nutrition.proteinG,
            item.nutrition.fatG,
            item.nutrition.carbsG,
          ].some((value) => value !== null);
          if (!reference && hasNutrition) {
            errors.push(`unsupported_farm_product_nutrition:${item.name}`);
          } else if (reference && grams) {
            if (!item.nutrition.estimated) errors.push(`unmarked_reference_estimate:${item.name}`);
            const expected = scaleReferenceNutrition(reference, grams);
            for (const key of ["kcal", "proteinG", "fatG", "carbsG"] as const) {
              const actual = item.nutrition[key];
              if (actual !== null && Math.abs(actual - expected[key]) > Math.max(2, expected[key] * 0.2)) {
                errors.push(`farm_product_nutrition_deviation:${item.name}:${key}`);
              }
            }
          }
        }
      }
      for (const allergy of context.profile?.allergies ?? []) {
        if (normalize(allergy).length >= 3 && normalize(item.name).includes(normalize(allergy))) {
          errors.push(`allergy_conflict:${allergy}`);
        }
      }
      for (const disliked of context.profile?.dislikedProducts ?? []) {
        if (normalize(disliked).length >= 3 && normalize(item.name).includes(normalize(disliked))) {
          errors.push(`disliked_product:${disliked}`);
        }
      }
    }
  }

  for (const replacement of response.substitutions) {
    if (replacement.farmProduct && !isAllowedFarmProduct(replacement.with, context)) {
      errors.push(`unknown_farm_substitution:${replacement.with}`);
    }
  }

  for (const source of response.sources) {
    if (!allowedEvidenceIds.has(source.evidenceId)) errors.push(`unknown_evidence:${source.evidenceId}`);
  }

  const unsafeMedicalPattern = /(?:лечит|вылечит|гарантированно\s+безопас|заменяет\s+(?:врача|лечение)|безопасн\w*\s+при\s+аллергии\s+на\s+(?:казеин|молочн))/i;
  if (unsafeMedicalPattern.test(`${response.summary}\n${response.answer}`)) {
    errors.push("unsafe_medical_claim");
  }
  return errors;
}

function applyDeterministicResponseMetadata(
  response: ZoyaStructuredResponse,
  context: ZoyaAssembledContext,
): ZoyaStructuredResponse {
  const answer = response.answer.trim();
  if (answer && !/[.!?…]$/.test(answer)) {
    const lastSentenceEnd = Math.max(
      answer.lastIndexOf("."),
      answer.lastIndexOf("!"),
      answer.lastIndexOf("?"),
      answer.lastIndexOf("…"),
    );
    if (lastSentenceEnd >= 40) response.answer = answer.slice(0, lastSentenceEnd + 1);
  }
  if (context.intent !== "medical_safety") return response;

  const milkAllergyQuestion = /(?:аллерг|казеин|молочн\w*\s+бел)/i.test(context.effectiveQuery);
  if (milkAllergyQuestion) {
    response.summary = "Козье молоко не считается безопасной заменой при аллергии на молочный белок";
    const answerLooksIncomplete = response.answer.trim().length < 120
      || /^(?:здравствуйте|привет)[!,]?\s*(?:я\s+)?зоя/i.test(response.answer.trim());
    if (answerLooksIncomplete) {
      response.answer = "При подтверждённой аллергии на казеин или другой молочный белок не следует самостоятельно заменять коровье молоко козьим или овечьим: из-за сходства белков возможна перекрёстная реакция. Исключение или введение молочных продуктов необходимо согласовать с врачом или аллергологом.";
    }
  }

  if (response.sources.length === 0) {
    response.sources = context.evidence
      .map((item, index) => ({ item, evidenceId: index + 1 }))
      .filter(({ item }) => item.level === "verified_knowledge" && Boolean(item.sourceName?.trim()))
      .slice(0, 4)
      .map(({ item, evidenceId }) => ({ evidenceId, title: item.sourceName!.trim() }));
  }
  if (response.warnings.length === 0) {
    response.warnings = [
      "При подтверждённой пищевой аллергии изменение рациона следует согласовать с врачом или аллергологом.",
    ];
  }
  return response;
}

function nutritionLine(nutrition: z.infer<typeof nutritionSchema>): string {
  const values = [
    nutrition.kcal === null ? null : `${Math.round(nutrition.kcal)} ккал`,
    nutrition.proteinG === null ? null : `Б ${nutrition.proteinG.toFixed(1)} г`,
    nutrition.fatG === null ? null : `Ж ${nutrition.fatG.toFixed(1)} г`,
    nutrition.carbsG === null ? null : `У ${nutrition.carbsG.toFixed(1)} г`,
  ].filter(Boolean);
  return values.join(" · ");
}

export function renderZoyaStructuredResponse(
  response: ZoyaStructuredResponse,
  context?: ZoyaAssembledContext,
): string {
  const lines: string[] = [`## ${response.summary}`];
  if (response.consideredFacts.length > 0) {
    const facts = response.consideredFacts
      .map((fact) => fact.trim().replace(/[.;]+$/, ""))
      .filter(Boolean);
    if (facts.length > 0) lines.push("", `**Учтено в расчёте:** ${facts.join("; ")}.`);
  }
  if (normalize(response.answer) !== normalize(response.summary)) lines.push("", response.answer);

  if (response.mealPlan.enabled) {
    lines.push("", `### ${response.mealPlan.title || "Меню"}`);
    for (const meal of response.mealPlan.meals) {
      lines.push("", `**${meal.name}${meal.time ? ` · ${meal.time}` : ""}**`);
      for (const item of meal.items) {
        const nutrition = nutritionLine(item.nutrition);
        lines.push(`- ${item.farmProduct ? "Продукт фермы: " : ""}${item.name} — ${item.amount}${nutrition ? `; ${nutrition}` : ""}`);
      }
      const mealTotal = nutritionLine(meal.nutrition);
      if (mealTotal) lines.push(`_Итого приёма: ${mealTotal}_`);
    }
    const daily = nutritionLine(response.mealPlan.dailyNutrition);
    if (daily) lines.push("", `**Итого за день:** ${daily}`);
    if (response.mealPlan.farmProductShareText) lines.push(`**Доля продукции фермы:** ${response.mealPlan.farmProductShareText}`);
  }

  if (response.substitutions.length > 0) {
    lines.push("", "### Варианты замены");
    for (const item of response.substitutions) {
      lines.push(`- **${item.replace} → ${item.with}:** ${item.reason}`);
    }
  }
  if (response.warnings.length > 0) {
    lines.push("", "### Важно", ...response.warnings.map((warning) => `- ${warning}`));
  }
  if (response.referenceNote) lines.push("", `_${response.referenceNote}_`);
  if (response.sources.length > 0) {
    const sources = response.sources.map((source) => {
      const evidence = context?.evidence[source.evidenceId - 1];
      const title = evidence?.sourceName?.trim() || source.title;
      return evidence?.sourceUrl?.trim()
        ? `[${source.evidenceId}] [${title}](${evidence.sourceUrl})`
        : `[${source.evidenceId}] ${title}`;
    });
    lines.push("", `**Источники:** ${sources.join("; ")}`);
  }
  return lines.join("\n");
}

export function buildZoyaValidationFallback(context: ZoyaAssembledContext): string {
  const profile = context.profile?.profileName ? ` для профиля **${context.profile.profileName}**` : "";
  const products = context.confirmedProducts.length > 0
    ? ` Подтверждённая продукция сохранена: ${context.confirmedProducts.map((product) => product.label).join(", ")}.`
    : "";
  return `Я собрала персональный контекст${profile}, но не показываю результат: внешний ответ не прошёл проверку фактов или расчётов.${products} Попробуйте повторить запрос — профиль и продуктовый контекст сохранятся.`;
}

export async function runZoyaOrchestrator(
  context: ZoyaAssembledContext,
  messages: ZoyaConversationMessage[],
  options: { signal?: AbortSignal } = {},
): Promise<{ response: ZoyaStructuredResponse; markdown: string }> {
  const llmMessages: Message[] = [
    { role: "system", content: buildZoyaOrchestratorPrompt(context) },
    ...messages.slice(-10).map((message) => ({ role: message.role, content: message.content } as Message)),
  ];
  const requestController = new AbortController();
  const abortFromCaller = () => requestController.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (options.signal?.aborted) abortFromCaller();
  const deadline = setTimeout(
    () => requestController.abort(new Error("ZOYA_ORCHESTRATOR_DEADLINE")),
    26_000,
  );

  try {
    const menuDraft = buildZoyaDeterministicMenuDraft(context);
    if (menuDraft) {
      try {
        const narrativeResult = await invokeZoyaLLM([
          { role: "system", content: buildMenuNarrativePrompt(context, menuDraft) },
          { role: "user", content: context.effectiveQuery },
        ], {
          signal: requestController.signal,
          totalDeadlineMs: 14_000,
          primaryTimeoutMs: 13_000,
          retryOnFailure: false,
          maxTokens: 1_200,
        });
        const narrative = parseMenuNarrative(narrativeResult.choices?.[0]?.message?.content);
        const safeSummary = sanitizeMenuNarrative(narrative.summary, context);
        const safeAnswer = sanitizeMenuNarrative(narrative.answer, context);
        if (safeSummary) menuDraft.summary = safeSummary;
        menuDraft.consideredFacts = narrative.consideredFacts;
        if (safeAnswer.length >= 60) menuDraft.answer = safeAnswer;
      } catch (error) {
        console.error("[Zoya Orchestrator] Menu narrative fallback", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
      }

      const verifiedDraft = applyDeterministicResponseMetadata(menuDraft, context);
      const validationErrors = validateZoyaStructuredResponse(verifiedDraft, context);
      if (validationErrors.length > 0) {
        const error = new Error(`ZOYA_RESPONSE_VALIDATION_FAILED:${validationErrors.join(",")}`);
        error.name = "ZoyaValidationError";
        throw error;
      }
      return {
        response: verifiedDraft,
        markdown: renderZoyaStructuredResponse(verifiedDraft, context),
      };
    }

    const result = await invokeZoyaLLM(llmMessages, {
      signal: requestController.signal,
      totalDeadlineMs: 26_000,
      primaryTimeoutMs: 25_000,
      retryOnFailure: false,
      maxTokens: context.intent === "personal_menu" || context.intent === "sports_nutrition"
        ? 5_000
        : 3_000,
    });
    let response = parseStructuredContent(result.choices?.[0]?.message?.content);

    response = applyDeterministicResponseMetadata(response, context);
    const validationErrors = validateZoyaStructuredResponse(response, context);
    if (validationErrors.length > 0) {
      const error = new Error(`ZOYA_RESPONSE_VALIDATION_FAILED:${validationErrors.join(",")}`);
      error.name = "ZoyaValidationError";
      throw error;
    }
    return { response, markdown: renderZoyaStructuredResponse(response, context) };
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
