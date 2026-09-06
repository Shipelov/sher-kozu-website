import { z } from "zod";
import { invokeZoyaLLM } from "./zoyaChatRuntime";
import type { ZoyaAssembledContext } from "./zoyaContextAssembler";
import { parseAmountGrams } from "./zoyaNutritionCalculator";
import { scaleReferenceNutrition } from "./zoyaProductNutrition";
import { buildZoyaDeterministicMenuDraft } from "./zoyaMenuPlanner";

export type ZoyaConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ZoyaOrchestrationDiagnostics = {
  mode: "deterministic_menu" | "verified_draft";
  aiAttempted: boolean;
  aiOutcome: "used" | "fallback" | "skipped";
  aiReasonCode: string | null;
  aiLatencyMs: number | null;
  validationErrors: string[];
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

function extractPlainTextContent(content: unknown): string {
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
    throw new ZoyaStructuredOutputError("ZOYA_PLAIN_TEXT_CONTENT_MISSING");
  }
  const cleaned = text
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (/^[{[]/.test(cleaned)) {
    throw new ZoyaStructuredOutputError("ZOYA_PLAIN_TEXT_UNEXPECTED_JSON");
  }
  return cleaned;
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

function emptyMealPlan(): ZoyaStructuredResponse["mealPlan"] {
  return {
    enabled: false,
    title: "",
    meals: [],
    dailyNutrition: emptyNutrition(),
    farmProductShareText: "",
  };
}

function evidenceSources(context: ZoyaAssembledContext): ZoyaStructuredResponse["sources"] {
  const seen = new Set<string>();
  return context.evidence
    .map((item, index) => ({ item, evidenceId: index + 1 }))
    .filter(({ item }) => Boolean(item.sourceName?.trim()))
    .filter(({ item }) => {
      const key = `${item.sourceName}|${item.sourceUrl ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map(({ item, evidenceId }) => ({
      evidenceId,
      title: item.sourceName!.trim(),
    }));
}

function verifiedEvidenceForAnswer(context: ZoyaAssembledContext): ZoyaAssembledContext["evidence"] {
  return context.evidence.filter((item) => {
    if (context.intent === "medical_safety") return item.level === "verified_knowledge";
    return item.level === "verified_knowledge"
      || item.level === "trusted_knowledge"
      || item.level === "farm_fact"
      || item.level === "reference_estimate";
  });
}

export function buildZoyaVerifiedDraft(context: ZoyaAssembledContext): ZoyaStructuredResponse {
  const evidence = verifiedEvidenceForAnswer(context).slice(0, 4);
  const consideredFacts = [
    context.profileConfirmed && context.profile?.profileName
      ? `подтверждённый профиль ${context.profile.profileName}`
      : null,
    context.confirmedProducts.length > 0
      ? `подтверждённые продукты: ${context.confirmedProducts.slice(0, 5).map((item) => item.label).join(", ")}`
      : null,
    ...evidence.slice(0, 3).map((item) => item.sourceName
      ? `проверенный источник: ${item.sourceName}`
      : "проверенное знание базы Зои"),
  ].filter((item): item is string => Boolean(item));

  const milkAllergyQuestion = context.intent === "medical_safety"
    && /(?:аллерг|казеин|молочн\w*\s+бел)/i.test(context.effectiveQuery);
  if (milkAllergyQuestion) {
    return {
      summary: "Козье молоко не считается безопасной заменой при аллергии на молочный белок",
      consideredFacts,
      answer: "При подтверждённой аллергии на казеин или другой молочный белок не следует самостоятельно заменять коровье молоко козьим или овечьим: из-за сходства белков возможна перекрёстная реакция. Исключение или введение молочных продуктов необходимо согласовать с врачом или аллергологом.",
      mealPlan: emptyMealPlan(),
      substitutions: [],
      warnings: [
        "При подтверждённой пищевой аллергии изменение рациона следует согласовать с врачом или аллергологом.",
      ],
      sources: evidenceSources(context),
      referenceNote: "Медицинский вывод и обязательное предупреждение закреплены сервером по проверенным источникам; внешний AI может улучшать только формулировку, не меняя смысл.",
    };
  }

  const evidenceText = evidence
    .map((item) => item.value.trim())
    .filter(Boolean)
    .slice(0, 3);
  const productsText = context.confirmedProducts.length > 0
    ? `В подтверждённом продуктовом плане: ${context.confirmedProducts.map((item) => item.label).join(", ")}.`
    : "";
  const answer = evidenceText.length > 0
    ? `${evidenceText.join(" ")} ${productsText}`.trim()
    : productsText
      || "В проверенной базе Зои пока недостаточно данных для уверенного фактического ответа. Уточните продукт или формулировку вопроса — я выполню повторный поиск по базе знаний.";

  const summaryByIntent: Record<ZoyaAssembledContext["intent"], string> = {
    general_information: "Ответ по проверенным данным",
    product_information: "Проверенная информация о продукции",
    recipe: "Ответ по рецепту и продуктам",
    personal_menu: "Персональное меню",
    sports_nutrition: "Спортивное питание",
    medical_safety: "Безопасный информационный ответ",
  };
  return {
    summary: summaryByIntent[context.intent],
    consideredFacts,
    answer,
    mealPlan: emptyMealPlan(),
    substitutions: [],
    warnings: context.intent === "medical_safety"
      ? ["Ответ носит информационный характер и не заменяет консультацию врача."]
      : [],
    sources: evidenceSources(context),
    referenceNote: context.evidence.some((item) => item.level === "reference_estimate")
      ? "Числовые значения со статусом справочной оценки не являются лабораторным анализом конкретной партии фермы."
      : "",
  };
}

export function buildVerifiedDraftRewritePrompt(
  context: ZoyaAssembledContext,
  draft: ZoyaStructuredResponse,
): string {
  return `Ты — редактор ответа Зои. Перепиши только поле answer естественным русским языком в 2–5 предложениях.

Верни только обычный текст без JSON, Markdown-заголовков, списков и ссылок.

Разрешено использовать только факты из SERVER_DRAFT. Запрещено добавлять числа, продукты, полезные свойства, медицинские выводы, причины, источники или рекомендации, которых нет в draft. Не меняй смысл red-line предупреждений.

INTENT: ${context.intent}
USER_QUERY: ${context.effectiveQuery}
SERVER_DRAFT: ${JSON.stringify({
    summary: draft.summary,
    answer: draft.answer,
    warnings: draft.warnings,
  })}`;
}

export function buildMenuCompositionPrompt(
  context: ZoyaAssembledContext,
  draft: ZoyaStructuredResponse,
): string {
  return `Ты — AI-нутрициолог Зоя. Сервер уже подготовил и проверил персональное меню. Сразу напиши окончательный текст, не описывая ход рассуждений.

Сформулируй 1–2 завершённых содержательных предложения обычного русского текста: объясни логику распределения рациона и роль подтверждённых продуктов фермы. Пиши естественно и по делу.

Верни только текст без JSON, Markdown-заголовков, списков и ссылок. Не повторяй граммовки и КБЖУ: они будут показаны сервером ниже.

LOCKED FACTS нельзя менять или дополнять. Запрещено добавлять новые числа, продукты, медицинские обещания, полезные свойства, витамины, минералы, источники или рекомендации, которых нет в draft.

USER_QUERY: ${context.effectiveQuery}
LOCKED_FACTS: ${JSON.stringify({
    summary: draft.summary,
    consideredFacts: draft.consideredFacts,
    serverAnswer: draft.answer,
    farmProducts: draft.mealPlan.meals.flatMap((meal) => meal.items)
      .filter((item) => item.farmProduct)
      .map((item) => item.name),
    mealNames: draft.mealPlan.meals.map((meal) => meal.name),
    substitutions: draft.substitutions.map((item) => `${item.replace} → ${item.with}`),
    warnings: draft.warnings,
  })}`;
}

function numberTokens(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

const DAIRY_CATEGORY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "кефир", pattern: /кефир/i },
  { name: "йогурт", pattern: /йогурт/i },
  { name: "сметана", pattern: /сметан/i },
  { name: "молоко", pattern: /молок/i },
  { name: "масло", pattern: /масл/i },
  { name: "брынза", pattern: /брынз/i },
  { name: "халуми", pattern: /халуми/i },
  { name: "рикотта", pattern: /рикотт/i },
  { name: "камамбер", pattern: /камамбер/i },
];

function completePlainText(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (/[.!?]$/.test(compact)) return compact;
  const sentences = compact.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.map((sentence) => sentence.trim()).join(" ");
}

function mentionsUnknownDairyCategory(
  text: string,
  draft: ZoyaStructuredResponse,
  context: ZoyaAssembledContext,
): boolean {
  const allowedText = normalize([
    draft.answer,
    ...draft.consideredFacts,
    ...draft.mealPlan.meals.flatMap((meal) => meal.items.map((item) => item.name)),
    ...draft.substitutions.flatMap((item) => [item.replace, item.with]),
    ...context.confirmedProducts.map((product) => product.label),
  ].join(" "));
  return DAIRY_CATEGORY_PATTERNS.some(({ name, pattern }) => (
    pattern.test(text) && !allowedText.includes(name)
  ));
}

function sanitizeVerifiedRewrite(
  text: string,
  draft: ZoyaStructuredResponse,
  context: ZoyaAssembledContext,
): string {
  const sanitized = completePlainText(sanitizeMenuNarrative(text, context));
  if (!sanitized) return "";
  const allowedNumbers = new Set(numberTokens(`${draft.summary} ${draft.answer} ${draft.warnings.join(" ")}`));
  const containsUnknownNumber = numberTokens(sanitized).some((token) => !allowedNumbers.has(token));
  if (containsUnknownNumber) return "";
  if (mentionsUnknownDairyCategory(sanitized, draft, context)) return "";
  if (/(?:лечит|вылечит|гарантированно\s+безопас|заменяет\s+(?:врача|лечение))/i.test(sanitized)) return "";
  if (
    context.intent === "medical_safety"
    && /аллерг|казеин|молочн.{0,8}бел/i.test(context.effectiveQuery)
    && !/(?:не\s+(?:является|считается|следует|подходит|безопас)|нельзя|не\s+рекоменду)/i.test(sanitized)
  ) return "";
  return sanitized;
}

function orchestrationReasonCode(error: unknown): string {
  if (!(error instanceof Error)) return "AI_UNKNOWN_ERROR";
  if (error.name === "AbortError" || /timeout|deadline|aborted/i.test(error.message)) return "AI_TIMEOUT";
  if (error instanceof ZoyaStructuredOutputError) return "AI_CONTENT_INVALID";
  if (/\b(?:401|403)\b|unauthoriz|forbidden/i.test(error.message)) return "AI_AUTH_ERROR";
  if (/\b429\b|rate.?limit/i.test(error.message)) return "AI_RATE_LIMIT";
  if (/\b5\d\d\b|fetch failed|network|econn/i.test(error.message)) return "AI_TRANSPORT_ERROR";
  return "AI_PROVIDER_ERROR";
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
): Promise<{
  response: ZoyaStructuredResponse;
  markdown: string;
  diagnostics: ZoyaOrchestrationDiagnostics;
}> {
  void messages;
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
      const diagnostics: ZoyaOrchestrationDiagnostics = {
        mode: "deterministic_menu",
        aiAttempted: true,
        aiOutcome: "fallback",
        aiReasonCode: null,
        aiLatencyMs: null,
        validationErrors: [],
      };

      const aiStartedAt = Date.now();
      try {
        const result = await invokeZoyaLLM([
          { role: "system", content: buildMenuCompositionPrompt(context, menuDraft) },
          { role: "user", content: context.effectiveQuery },
        ], {
          signal: requestController.signal,
          totalDeadlineMs: 18_000,
          primaryTimeoutMs: 17_000,
          retryOnFailure: false,
          maxTokens: 1_600,
        });
        const rewritten = extractPlainTextContent(result.choices?.[0]?.message?.content);
        const safeRewrite = sanitizeVerifiedRewrite(rewritten, menuDraft, context);
        if (safeRewrite.length >= 80) {
          menuDraft.answer = safeRewrite;
          diagnostics.aiOutcome = "used";
        } else {
          diagnostics.aiReasonCode = "AI_REWRITE_REJECTED";
        }
      } catch (error) {
        diagnostics.aiReasonCode = orchestrationReasonCode(error);
      } finally {
        diagnostics.aiLatencyMs = Date.now() - aiStartedAt;
      }

      const verifiedDraft = applyDeterministicResponseMetadata(menuDraft, context);
      const validationErrors = validateZoyaStructuredResponse(verifiedDraft, context);
      diagnostics.validationErrors = validationErrors;
      if (validationErrors.length > 0) {
        const error = new Error(`ZOYA_RESPONSE_VALIDATION_FAILED:${validationErrors.join(",")}`);
        error.name = "ZoyaValidationError";
        throw error;
      }
      return {
        response: verifiedDraft,
        markdown: renderZoyaStructuredResponse(verifiedDraft, context),
        diagnostics,
      };
    }

    if (context.intent === "personal_menu") {
      const response = applyDeterministicResponseMetadata(buildZoyaVerifiedDraft(context), context);
      const diagnostics: ZoyaOrchestrationDiagnostics = {
        mode: "verified_draft",
        aiAttempted: false,
        aiOutcome: "skipped",
        aiReasonCode: "MENU_DRAFT_NOT_READY",
        aiLatencyMs: null,
        validationErrors: [],
      };
      const validationErrors = validateZoyaStructuredResponse(response, context);
      diagnostics.validationErrors = validationErrors;
      if (validationErrors.length > 0) {
        const error = new Error(`ZOYA_RESPONSE_VALIDATION_FAILED:${validationErrors.join(",")}`);
        error.name = "ZoyaValidationError";
        throw error;
      }
      return {
        response,
        markdown: renderZoyaStructuredResponse(response, context),
        diagnostics,
      };
    }

    let response = buildZoyaVerifiedDraft(context);
    const diagnostics: ZoyaOrchestrationDiagnostics = {
      mode: "verified_draft",
      aiAttempted: true,
      aiOutcome: "fallback",
      aiReasonCode: null,
      aiLatencyMs: null,
      validationErrors: [],
    };
    if (diagnostics.aiAttempted) {
      const aiStartedAt = Date.now();
      try {
        const result = await invokeZoyaLLM([
          { role: "system", content: buildVerifiedDraftRewritePrompt(context, response) },
          { role: "user", content: context.effectiveQuery },
        ], {
          signal: requestController.signal,
          totalDeadlineMs: 12_000,
          primaryTimeoutMs: 11_000,
          retryOnFailure: false,
          maxTokens: 700,
        });
        const rewritten = extractPlainTextContent(result.choices?.[0]?.message?.content);
        const safeRewrite = sanitizeVerifiedRewrite(rewritten, response, context);
        if (safeRewrite.length >= 60) {
          response.answer = safeRewrite;
          diagnostics.aiOutcome = "used";
        } else {
          diagnostics.aiReasonCode = "AI_REWRITE_REJECTED";
        }
      } catch (error) {
        diagnostics.aiReasonCode = orchestrationReasonCode(error);
      } finally {
        diagnostics.aiLatencyMs = Date.now() - aiStartedAt;
      }
    }

    response = applyDeterministicResponseMetadata(response, context);
    const validationErrors = validateZoyaStructuredResponse(response, context);
    diagnostics.validationErrors = validationErrors;
    if (validationErrors.length > 0) {
      const error = new Error(`ZOYA_RESPONSE_VALIDATION_FAILED:${validationErrors.join(",")}`);
      error.name = "ZoyaValidationError";
      throw error;
    }
    return {
      response,
      markdown: renderZoyaStructuredResponse(response, context),
      diagnostics,
    };
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
