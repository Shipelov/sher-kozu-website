import type { ZoyaUserContext } from "./prompts/zoyaSystemPrompt";

export type ZoyaConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type SportsFacts = {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  trainingMinutes: number | null;
  dairySharePercent: number | null;
};

type ShareBasis = "calories" | "food_mass" | "delivery" | null;

type Macro = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

type OwnedCheese = {
  label: string;
  productType: string;
};

type ReferenceCheese = {
  referenceName: string;
  sourceUrl: string;
  per100g: Macro;
};

type MenuIngredient = {
  label: string;
  grams: number;
  per100g: Macro;
  farmProduct?: boolean;
  referenceName?: string;
};

const SPORTS_MENU_INTENT = /(?:рацион|меню|питан|прием\s+пищ|приём\s+пищ)/i;
const SPORTS_CONTEXT = /(?:спорт|нагруз|тренир|силов|зал|мышц|восстанов|вынослив)/i;
const CHEESE_PATTERN = /(?:сыр|брынз|качот|халуми|рикот|камамбер|пекорино|рокфор|шевр)/i;
const MENU_FOLLOW_UP = /(?:мо(?:и|их)\s+сыр|выбери\s+из|ты\s+знаешь|рост|вес|возраст|мне\s+\d{2}|процент|уточн|калор|ккал|по\s+массе|поставк|пункт|вариант)/i;
const DAIRY_MENU_CONTEXT = /(?:\d{1,3}(?:[.,]\d+)?\s*%[^.!?\n]{0,60}(?:молочн|сыр|продукц)|мо(?:ей|я|и|их)\s+(?:молочн|сыр)|молочн[^.!?\n]{0,30}(?:рацион|меню))/i;

const USDA_FETA = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173420/nutrients";
const USDA_RICOTTA = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/170851/nutrients";
const USDA_CAMEMBERT = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/172178/nutrients";
const NORWAY_HALLOUMI = "https://www.matvaretabellen.no/en/cheese-halloumi/";
const USDA_SEARCH = "https://fdc.nal.usda.gov/food-search";

const REFERENCE_CHEESES: Array<{ pattern: RegExp; value: ReferenceCheese }> = [
  {
    pattern: /рикот/i,
    value: {
      referenceName: "USDA: ricotta, whole milk",
      sourceUrl: USDA_RICOTTA,
      per100g: { kcal: 150, protein: 7.54, fat: 10.18, carbs: 7.27 },
    },
  },
  {
    pattern: /брынз|фет/i,
    value: {
      referenceName: "USDA: feta",
      sourceUrl: USDA_FETA,
      per100g: { kcal: 265, protein: 14.21, fat: 21.49, carbs: 3.88 },
    },
  },
  {
    pattern: /халуми/i,
    value: {
      referenceName: "Matvaretabellen: halloumi",
      sourceUrl: NORWAY_HALLOUMI,
      per100g: { kcal: 290, protein: 22.3, fat: 21.9, carbs: 0.9 },
    },
  },
  {
    pattern: /камамбер/i,
    value: {
      referenceName: "USDA: camembert",
      sourceUrl: USDA_CAMEMBERT,
      per100g: { kcal: 300, protein: 19.8, fat: 24.26, carbs: 0.46 },
    },
  },
];

const BASE_MEALS: Record<string, MenuIngredient[]> = {
  breakfast: [
    { label: "овсяные хлопья (сухие)", grams: 60, per100g: { kcal: 379, protein: 13.15, fat: 6.52, carbs: 67.7 } },
    { label: "яйца", grams: 100, per100g: { kcal: 143, protein: 12.56, fat: 9.51, carbs: 0.72 } },
    { label: "овощи/ягоды", grams: 150, per100g: { kcal: 35, protein: 2, fat: 0.3, carbs: 7 } },
  ],
  lunch: [
    { label: "куриная грудка, готовая", grams: 180, per100g: { kcal: 165, protein: 31.02, fat: 3.57, carbs: 0 } },
    { label: "рис, готовый", grams: 250, per100g: { kcal: 130, protein: 2.69, fat: 0.28, carbs: 28.17 } },
    { label: "овощи", grams: 250, per100g: { kcal: 35, protein: 2, fat: 0.3, carbs: 7 } },
    { label: "оливковое масло", grams: 10, per100g: { kcal: 884, protein: 0, fat: 100, carbs: 0 } },
  ],
  snack: [
    { label: "банан", grams: 120, per100g: { kcal: 89, protein: 1.09, fat: 0.33, carbs: 22.84 } },
  ],
  dinner: [
    { label: "лосось, готовый", grams: 160, per100g: { kcal: 206, protein: 22.1, fat: 12.4, carbs: 0 } },
    { label: "картофель, отварной", grams: 300, per100g: { kcal: 87, protein: 1.87, fat: 0.1, carbs: 20.13 } },
    { label: "овощи", grams: 250, per100g: { kcal: 35, protein: 2, fat: 0.3, carbs: 7 } },
    { label: "оливковое масло", grams: 10, per100g: { kcal: 884, protein: 0, fat: 100, carbs: 0 } },
  ],
};

export function isSportsMenuQuestion(question: string): boolean {
  return SPORTS_MENU_INTENT.test(question) && SPORTS_CONTEXT.test(question);
}

export function isDairyMenuQuestion(question: string): boolean {
  return SPORTS_MENU_INTENT.test(question) && DAIRY_MENU_CONTEXT.test(question);
}

export function isSportsMenuConversation(messages: ZoyaConversationMessage[]): boolean {
  const userMessages = messages.filter((message) => message.role === "user");
  const lastUserMessage = userMessages.at(-1);
  if (!lastUserMessage) return false;
  if (isSportsMenuQuestion(lastUserMessage.content) || isDairyMenuQuestion(lastUserMessage.content)) {
    return true;
  }
  if (!MENU_FOLLOW_UP.test(lastUserMessage.content)) return false;
  return userMessages.slice(0, -1).some((message) =>
    isSportsMenuQuestion(message.content) || isDairyMenuQuestion(message.content),
  );
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function userTexts(messages: ZoyaConversationMessage[]): string[] {
  return messages.filter((message) => message.role === "user").map((message) => message.content);
}

function findLatestNumber(texts: string[], pattern: RegExp): number | null {
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const match = texts[index]?.match(pattern);
    const value = parseNumber(match?.slice(1).find(Boolean));
    if (value !== null) return value;
  }
  return null;
}

export function extractSportsFacts(messages: ZoyaConversationMessage[]): SportsFacts {
  const texts = userTexts(messages);
  const hours = findLatestNumber(
    texts,
    /(?:провожу|тренируюсь|тренировка|занимаюсь)[^\d]{0,24}(\d+(?:[.,]\d+)?)\s*(?:час|ч\b)/i,
  );
  const minutes = findLatestNumber(
    texts,
    /(?:провожу|тренируюсь|тренировка|занимаюсь)[^\d]{0,24}(\d+(?:[.,]\d+)?)\s*(?:минут|мин\b)/i,
  );
  return {
    age: findLatestNumber(texts, /(?:(?:мне\s+)?(\d{2})\s*(?:лет|года|год)|возраст[^\d]{0,8}(\d{2}))/i),
    heightCm: findLatestNumber(texts, /(?:рост(?:ом)?)[^\d]{0,8}(\d{3}(?:[.,]\d+)?)\s*(?:см)?/i),
    weightKg: findLatestNumber(texts, /(?:вес(?:ом)?)[^\d]{0,8}(\d{2,3}(?:[.,]\d+)?)\s*(?:кг)?/i),
    trainingMinutes: hours !== null ? Math.round(hours * 60) : minutes !== null ? Math.round(minutes) : null,
    dairySharePercent: findLatestNumber(texts, /(\d{1,3}(?:[.,]\d+)?)\s*%[^.!?\n]{0,50}(?:молочн|сыр|продукц)/i),
  };
}

function extractShareBasis(messages: ZoyaConversationMessage[]): ShareBasis {
  const texts = userTexts(messages);
  for (let index = texts.length - 1; index >= 0; index -= 1) {
    const text = texts[index] ?? "";
    if (/(?:вариант|пункт|№)\s*1\b|(?:от|доля|процент|по)[^.!?\n]{0,24}(?:калор|ккал)|(?:калор|ккал)[^.!?\n]{0,24}(?:рацион|дня|суток|процент|доля)/i.test(text)) {
      return "calories";
    }
    if (/(?:вариант|пункт|№)\s*2\b|(?:по|от|доля|процент)[^.!?\n]{0,20}масс|масса\s+(?:еды|рациона|продуктов)/i.test(text)) {
      return "food_mass";
    }
    if (/(?:вариант|пункт|№)\s*3\b|(?:поставк|выдач|получаем|объ[её]м\s+(?:моей|продукц))/i.test(text)) {
      return "delivery";
    }
  }
  return null;
}

function extractTargetCalories(messages: ZoyaConversationMessage[]): number | null {
  return findLatestNumber(
    userTexts(messages),
    /(?:целев[^\d]{0,20}|суточн[^\d]{0,20}|рацион[^\d]{0,20}|^|\s)(\d{3,4})\s*(?:ккал|калор)/i,
  );
}

function currentOwnedCheeses(context: ZoyaUserContext): OwnedCheese[] {
  const result: OwnedCheese[] = [];
  for (const plan of context.ownerContext?.productPlans ?? []) {
    if (plan?.status !== "confirmed") continue;
    try {
      const selections = typeof plan.selectionsJson === "string"
        ? JSON.parse(plan.selectionsJson)
        : plan.selectionsJson;
      if (!Array.isArray(selections)) continue;
      for (const selection of selections) {
        const label = typeof selection?.label === "string" ? selection.label.trim() : "";
        const productType = typeof selection?.productType === "string" ? selection.productType : "";
        if (label && (CHEESE_PATTERN.test(label) || productType.includes("cheese"))) {
          result.push({ label, productType });
        }
      }
    } catch {
      // Ignore malformed plans instead of exposing their content.
    }
  }
  return Array.from(new Map(result.map((item) => [item.label, item])).values());
}

function productSummary(cheeses: OwnedCheese[]): string {
  if (cheeses.length === 0) {
    return "В подтверждённом продуктовом плане сейчас нет читаемого списка сыров.";
  }
  return `В подтверждённом плане вижу: **${cheeses.map((item) => item.label).join(", ")}**.`;
}

function buildBasisQuestion(percent: number | null, cheeses: OwnedCheese[]): string {
  const share = percent === null ? "указанную долю" : `${percent}%`;
  return [
    `Уточню один параметр, чтобы не придумать цифры: что означает **${share} молочной продукции**?`,
    "1. Доля **суточной калорийности**.",
    "2. Доля **массы всей еды за день**.",
    "3. Доля **вашей поставки** за выбранный период.",
    `${productSummary(cheeses)} В каталоге пока нет лабораторных КБЖУ готовых партий, поэтому я отмечу сырные значения как справочную оценку по ближайшему типу.`,
    "Ответьте, например: **«вариант 1, 2500 ккал»**. Тогда следующим сообщением я дам граммовки, КБЖУ по каждому приёму и итог за день.",
  ].join("\n\n");
}

function referenceFor(cheese: OwnedCheese): ReferenceCheese | null {
  const searchable = `${cheese.label} ${cheese.productType}`;
  return REFERENCE_CHEESES.find((entry) => entry.pattern.test(searchable))?.value ?? null;
}

function scaleMacro(macro: Macro, grams: number): Macro {
  const factor = grams / 100;
  return {
    kcal: macro.kcal * factor,
    protein: macro.protein * factor,
    fat: macro.fat * factor,
    carbs: macro.carbs * factor,
  };
}

function sumMacros(items: MenuIngredient[]): Macro {
  return items.reduce<Macro>((sum, item) => {
    const value = scaleMacro(item.per100g, item.grams);
    return {
      kcal: sum.kcal + value.kcal,
      protein: sum.protein + value.protein,
      fat: sum.fat + value.fat,
      carbs: sum.carbs + value.carbs,
    };
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

function macroText(value: Macro): string {
  return `${Math.round(value.kcal)} ккал · Б ${value.protein.toFixed(1)} г · Ж ${value.fat.toFixed(1)} г · У ${value.carbs.toFixed(1)} г`;
}

function roundPortion(value: number, label: string): number {
  if (label === "яйца") return Math.max(50, Math.round(value / 50) * 50);
  if (label === "оливковое масло") return Math.max(3, Math.round(value));
  return Math.max(5, Math.round(value / 5) * 5);
}

function ingredientText(items: MenuIngredient[]): string {
  return items.map((item) => `${item.label} — ${item.grams} г`).join(", ");
}

function calculatedMenu(
  percent: number,
  targetCalories: number,
  cheeses: OwnedCheese[],
  facts: SportsFacts,
): string {
  const mapped = cheeses
    .map((cheese) => ({ cheese, reference: referenceFor(cheese) }))
    .filter((item): item is { cheese: OwnedCheese; reference: ReferenceCheese } => Boolean(item.reference))
    .sort((a, b) => Number(/рикот/i.test(b.cheese.label)) - Number(/рикот/i.test(a.cheese.label)))
    .slice(0, 2);

  if (mapped.length === 0) {
    return `${productSummary(cheeses)} Для этих сыров у меня нет надёжного справочного аналога КБЖУ. Пришлите значения с этикетки на 100 г (ккал, белки, жиры, углеводы), и я сразу посчитаю меню.`;
  }

  const dairyTargetKcal = targetCalories * percent / 100;
  const dairyItems: MenuIngredient[] = mapped.map((item, index) => {
    const calorieShare = mapped.length === 1 ? 1 : index === 0 ? 0.55 : 0.45;
    const grams = Math.max(5, Math.round((dairyTargetKcal * calorieShare / item.reference.per100g.kcal * 100) / 5) * 5);
    return {
      label: item.cheese.label,
      grams,
      per100g: item.reference.per100g,
      farmProduct: true,
      referenceName: item.reference.referenceName,
    };
  });
  const dairyMacros = sumMacros(dairyItems);

  const baseNonDairy = Object.values(BASE_MEALS).flat();
  const baseKcal = sumMacros(baseNonDairy).kcal;
  const remainingKcal = Math.max(400, targetCalories - dairyMacros.kcal);
  const scale = Math.max(0.55, Math.min(1.45, remainingKcal / baseKcal));
  const meals = Object.fromEntries(
    Object.entries(BASE_MEALS).map(([meal, items]) => [
      meal,
      items.map((item) => ({
        ...item,
        grams: roundPortion(item.grams * scale, item.label),
      })),
    ]),
  ) as Record<string, MenuIngredient[]>;

  meals.breakfast!.push(dairyItems[0]!);
  if (dairyItems[1]) meals.lunch!.push(dairyItems[1]);

  const labels: Record<string, string> = {
    breakfast: "Завтрак",
    lunch: "Обед",
    snack: "Перекус",
    dinner: "Ужин",
  };
  const menuLines = Object.entries(meals).map(([key, items]) =>
    `- **${labels[key]}:** ${ingredientText(items)}.  
  ${macroText(sumMacros(items))}`,
  );
  const totals = sumMacros(Object.values(meals).flat());
  const actualDairyPercent = dairyMacros.kcal / totals.kcal * 100;
  const proteinRange = facts.weightKg
    ? `При весе ${facts.weightKg} кг ориентир 1,4–2,0 г/кг составляет ${Math.round(facts.weightKg * 1.4)}–${Math.round(facts.weightKg * 2)} г белка/сутки; в этом меню около ${Math.round(totals.protein)} г.`
    : "Для персональной проверки белка укажите текущий вес и цель.";
  const dairyGrams = dairyItems.reduce((sum, item) => sum + item.grams, 0);
  const highCheeseLoad = dairyGrams > 200 || dairyMacros.fat > 45;

  return [
    "## Расчётное меню и КБЖУ",
    `_Это оценочный рацион для здорового взрослого, не медицинское назначение. КБЖУ ваших сыров рассчитаны по справочным аналогам, а не по лабораторному анализу партии._`,
    `**Принято для расчёта:** ${percent}% от ${targetCalories} ккал = около ${Math.round(dairyTargetKcal)} ккал из вашей молочной продукции.`,
    ...menuLines,
    `### Итого за день\n**${macroText(totals)}**`,
    `Из вашей продукции: **${ingredientText(dairyItems)}** — ${macroText(dairyMacros)}, то есть около **${actualDairyPercent.toFixed(1)}%** расчётной калорийности меню.`,
    proteinRange,
    highCheeseLoad
      ? `**Важно:** математически 30% калорий только из выбранных сыров дают около ${dairyGrams} г сыра в день. Это высокая сырная нагрузка по жирам и соли; для регулярного рациона лучше подтвердить состав ваших партий и обсудить меньшую долю либо добавить менее солёные молочные продукты.`
      : "Порции сыра распределены между завтраком и обедом, а не заменяют основные источники белка, овощи и сложные углеводы.",
    `**Справочные аналоги сыров:** ${dairyItems.map((item) => `${item.label} → ${item.referenceName}`).join("; ")}. Остальные продукты — средние значения USDA FoodData Central.`,
    `Источники: [USDA FoodData Central](${USDA_SEARCH}) · [Halloumi — Matvaretabellen](${NORWAY_HALLOUMI}) · [ISSN: protein and exercise](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/).`,
  ].join("\n\n");
}

export function buildGroundedSportsMenuReply(
  messages: ZoyaConversationMessage[],
  context: ZoyaUserContext,
): string | null {
  if (!isSportsMenuConversation(messages)) return null;

  const facts = extractSportsFacts(messages);
  const cheeses = currentOwnedCheeses(context);
  const basis = extractShareBasis(messages);

  if (facts.dairySharePercent === null || basis === null) {
    return buildBasisQuestion(facts.dairySharePercent, cheeses);
  }

  if (basis === "delivery") {
    return `Поняла: **${facts.dairySharePercent}% от вашей поставки**. Уточните один параметр: за какой период считать поставку — день, неделя или месяц — и какой фактический объём получен за этот период? После этого посчитаю граммовки и КБЖУ.`;
  }

  if (basis === "food_mass") {
    return `Поняла: **${facts.dairySharePercent}% от массы всей еды**. Уточните общий вес рациона за день и целевую калорийность. Без этих двух величин граммовки и КБЖУ будут выдуманными.`;
  }

  const targetCalories = extractTargetCalories(messages);
  if (targetCalories === null) {
    return [
      `Поняла: **${facts.dairySharePercent}% суточной калорийности** должно приходиться на вашу молочную продукцию.`,
      productSummary(cheeses),
      "Укажите только вашу **целевую калорийность в ккал/сутки** (например, 2500 ккал). Если вы её не знаете, напишите пол, возраст, рост, вес и сколько тренировок в неделю — я сначала оценю диапазон.",
    ].join("\n\n");
  }

  if (targetCalories < 1_200 || targetCalories > 5_000) {
    return `Целевая калорийность **${targetCalories} ккал** выглядит нетипично для взрослого рациона. Подтвердите число, чтобы я не построила ошибочное меню.`;
  }

  return calculatedMenu(facts.dairySharePercent, targetCalories, cheeses, facts);
}
