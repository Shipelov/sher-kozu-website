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

const SPORTS_MENU_INTENT = /(?:рацион|меню|питан|прием\s+пищ|приём\s+пищ)/i;
const SPORTS_CONTEXT = /(?:спорт|нагруз|тренир|силов|зал|мышц|восстанов|вынослив)/i;
const CHEESE_PATTERN = /(?:сыр|брынз|качот|халуми|рикот|камамбер|пекорино|рокфор|шевр)/i;
const SPORTS_MENU_FOLLOW_UP = /(?:мо(?:и|их)\s+сыр|выбери\s+из|ты\s+знаешь|рост|вес|возраст|мне\s+\d{2}|процент|уточн)/i;
const DAIRY_MENU_CONTEXT = /(?:\d{1,3}(?:[.,]\d+)?\s*%[^.!?\n]{0,60}(?:молочн|сыр|продукц)|мо(?:ей|я|и|их)\s+(?:молочн|сыр)|молочн[^.!?\n]{0,30}(?:рацион|меню))/i;

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
  if (!SPORTS_MENU_FOLLOW_UP.test(lastUserMessage.content)) return false;

  return userMessages
    .slice(0, -1)
    .some((message) =>
      isSportsMenuQuestion(message.content) || isDairyMenuQuestion(message.content),
    );
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function findLatestNumber(
  userMessages: string[],
  pattern: RegExp,
): number | null {
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const match = userMessages[index]?.match(pattern);
    const value = parseNumber(match?.slice(1).find(Boolean));
    if (value !== null) return value;
  }
  return null;
}

export function extractSportsFacts(messages: ZoyaConversationMessage[]): SportsFacts {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);

  const hours = findLatestNumber(
    userMessages,
    /(?:провожу|тренируюсь|тренировка|занимаюсь)[^\d]{0,24}(\d+(?:[.,]\d+)?)\s*(?:час|ч\b)/i,
  );
  const minutes = findLatestNumber(
    userMessages,
    /(?:провожу|тренируюсь|тренировка|занимаюсь)[^\d]{0,24}(\d+(?:[.,]\d+)?)\s*(?:минут|мин\b)/i,
  );

  return {
    age: findLatestNumber(
      userMessages,
      /(?:(?:мне\s+)?(\d{2})\s*(?:лет|года|год)|возраст[^\d]{0,8}(\d{2}))/i,
    ),
    heightCm: findLatestNumber(userMessages, /(?:рост(?:ом)?)[^\d]{0,8}(\d{3}(?:[.,]\d+)?)\s*(?:см)?/i),
    weightKg: findLatestNumber(userMessages, /(?:вес(?:ом)?)[^\d]{0,8}(\d{2,3}(?:[.,]\d+)?)\s*(?:кг)?/i),
    trainingMinutes: hours !== null ? Math.round(hours * 60) : minutes !== null ? Math.round(minutes) : null,
    dairySharePercent: findLatestNumber(
      userMessages,
      /(\d{1,3}(?:[.,]\d+)?)\s*%[^.!?\n]{0,50}(?:молочн|сыр|продукц)/i,
    ),
  };
}

function currentOwnedCheeses(context: ZoyaUserContext): string[] {
  const plans = context.ownerContext?.productPlans ?? [];
  const labels: string[] = [];

  for (const plan of plans) {
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
          labels.push(label);
        }
      }
    } catch {
      // Malformed product plans are ignored rather than exposed to the user.
    }
  }

  return Array.from(new Set(labels));
}

function formatKnownFacts(facts: SportsFacts): string {
  const values: string[] = [];
  if (facts.age) values.push(`${facts.age} лет`);
  if (facts.heightCm) values.push(`рост ${facts.heightCm} см`);
  if (facts.weightKg) values.push(`вес ${facts.weightKg} кг`);
  if (facts.trainingMinutes) values.push(`силовая тренировка около ${facts.trainingMinutes} мин`);
  return values.length > 0 ? values.join(", ") : "силовые тренировки";
}

function dairyInterpretation(facts: SportsFacts): string {
  if (facts.dairySharePercent === null) {
    return "Если хотите задать долю своей молочной продукции, уточните: это процент калорий, белка, массы продуктов или объёма вашей поставки.";
  }

  return `Фраза «${facts.dairySharePercent}% молочной продукции» неоднозначна: это может быть доля калорий, белка, массы еды или вашей поставки. Ниже я не пересчитываю её самовольно. Уточните единицу — тогда я переведу процент в граммы конкретных продуктов.`;
}

function proteinGuidance(facts: SportsFacts): string {
  if (!facts.weightKg) {
    return "Для точного белкового ориентира нужен текущий вес. Общий спортивный ориентир для здоровых взрослых — 1,4–2,0 г белка на кг массы в сутки, обычно по 20–40 г за приём каждые 3–4 часа.";
  }

  const lower = Math.round(facts.weightKg * 1.4);
  const upper = Math.round(facts.weightKg * 2);
  const practicalUpper = Math.round(facts.weightKg * 1.6);
  return `По общей массе тела расчётный спортивный диапазон составляет примерно **${lower}–${upper} г белка/сутки**. Для стартового меню без данных о составе тела разумно ориентироваться на нижнюю часть диапазона — около **${lower}–${practicalUpper} г/сутки**, распределяя белок по 4 приёмам. При заболеваниях почек, выраженной гипертонии или назначенной лечебной диете этот расчёт нужно согласовать с врачом.`;
}

type CheeseDayPlan = {
  guidance: string;
  breakfast: string;
  lunch: string;
  rotation: string;
  hasConfirmedCheeses: boolean;
};

function chooseCheese(labels: string[], pattern: RegExp, excluded: Set<string>): string | null {
  const match = labels.find((label) => pattern.test(label) && !excluded.has(label));
  if (match) excluded.add(match);
  return match ?? null;
}

function buildCheeseDayPlan(context: ZoyaUserContext): CheeseDayPlan {
  const cheeses = currentOwnedCheeses(context);
  if (cheeses.length === 0) {
    return {
      guidance: "В текущем **подтверждённом продуктовом плане** я не вижу читаемого списка ваших сыров. Поэтому не буду придумывать шевр, камамбер, пекорино или их КБЖУ.",
      breakfast: "добавьте сыр только после выбора точного продукта из поставки и проверки этикетки",
      lunch: "без дополнительной порции сыра, пока продукт не подтверждён",
      rotation: "После появления читаемого продуктового плана я распределю конкретные сыры.",
      hasConfirmedCheeses: false,
    };
  }

  const selected = new Set<string>();
  const breakfastCheese =
    chooseCheese(cheeses, /рикот/i, selected) ??
    chooseCheese(cheeses, /брынз|качот|сыр/i, selected) ??
    cheeses[0];
  selected.add(breakfastCheese);
  const lunchCheese =
    chooseCheese(cheeses, /брынз/i, selected) ??
    chooseCheese(cheeses, /халуми|качот|камамбер|сыр/i, selected);
  const unused = cheeses.filter((label) => !selected.has(label));

  return {
    guidance: `Я использую только подтверждённые продукты вашего плана: **${cheeses.join(", ")}**. На этот день выбираю **${breakfastCheese}**${lunchCheese ? ` и **${lunchCheese}**` : ""}. Точные КБЖУ не указываю без анализа готового продукта или этикетки.`,
    breakfast: `${breakfastCheese} — ориентировочно 30–40 г как часть блюда`,
    lunch: lunchCheese
      ? `${lunchCheese} — ориентировочно 20–30 г в салате или с овощами`
      : "вторую порцию сыра сегодня не добавляйте",
    rotation: unused.length > 0
      ? `Остальные сыры (**${unused.join(", ")}**) лучше чередовать в другие дни, а не складывать все порции в один рацион.`
      : "Не увеличивайте порции без данных о жирности и соли готового продукта.",
    hasConfirmedCheeses: true,
  };
}

function finalClarification(facts: SportsFacts, hasConfirmedCheeses: boolean): string {
  const share = facts.dairySharePercent !== null
    ? `${facts.dairySharePercent}%`
    : "долю молочной продукции";
  const productText = hasConfirmedCheeses
    ? "Названия ваших сыров уже учтены."
    : "Нужно подтвердить названия сыров из текущей поставки.";

  return `${productText} Чтобы точно пересчитать ${share} в граммы, уточните: это процент калорий, белка, массы еды или объёма поставки, и добавьте КБЖУ/соль с этикетки либо анализа выбранных сыров.`;
}

export function buildGroundedSportsMenuReply(
  messages: ZoyaConversationMessage[],
  context: ZoyaUserContext,
): string | null {
  if (!isSportsMenuConversation(messages)) return null;

  const facts = extractSportsFacts(messages);
  const cheesePlan = buildCheeseDayPlan(context);
  const hasSportsContext = messages
    .filter((message) => message.role === "user")
    .some((message) => SPORTS_CONTEXT.test(message.content));
  const menuStructure = hasSportsContext
    ? [
        `- **Завтрак:** овсянка или гречка, яйца/другой полноценный источник белка, овощи или ягоды; ${cheesePlan.breakfast}.`,
        `- **Обед:** нежирная птица, рыба или бобовые; крупа/картофель; большая порция овощей; ${cheesePlan.lunch}.`,
        "- **За 2–3 часа до тренировки:** обычный приём пищи с углеводами и 25–40 г белка, без большой порции жирного выдержанного сыра.",
        "- **Во время часовой силовой тренировки:** вода по жажде. Сыр во время занятия не нужен.",
        "- **После тренировки:** в ближайшем приёме пищи 25–40 г белка плюс углеводы — например, рыба/птица/яйца/бобовые с крупой и овощами. Молочный продукт может быть частью этого приёма, но не единственным его содержанием.",
        "- **Ужин:** ещё один полноценный источник белка, овощи и умеренная порция сложных углеводов по аппетиту и общей калорийности дня.",
      ]
    : [
        `- **Завтрак:** овсянка или гречка, яйца, овощи или ягоды; ${cheesePlan.breakfast}.`,
        `- **Обед:** птица, рыба или бобовые; крупа/картофель; большая порция овощей; ${cheesePlan.lunch}.`,
        "- **Перекус:** фрукт или ягоды, при необходимости — небольшая порция орехов; дополнительный сыр не нужен.",
        "- **Ужин:** рыба, птица, яйца или бобовые с овощами и умеренной порцией сложных углеводов по аппетиту.",
      ];

  return [
    hasSportsContext
      ? "## Сбалансированный день при силовой тренировке"
      : "## Сбалансированное дневное меню с вашей молочной продукцией",
    "_Это расчётный ориентир для здорового взрослого, а не медицинское назначение. Если есть заболевания почек, сердца, диабет, выраженная гипертония или лечебная диета, персональный план должен подтвердить врач или спортивный диетолог._",
    `**Учтённые данные:** ${formatKnownFacts(facts)}.`,
    hasSportsContext
      ? proteinGuidance(facts)
      : "Пока не указаны цель, возраст, вес и активность, это безопасная структура дня без расчёта калорий и белка. Для персональных цифр добавьте эти данные.",
    dairyInterpretation(facts),
    cheesePlan.guidance,
    "### Структура меню",
    ...menuStructure,
    cheesePlan.rotation,
    "### Что нужно уточнить для точного расчёта",
    finalClarification(facts, cheesePlan.hasConfirmedCheeses),
    "Ориентиры по белку: [ISSN — protein and exercise](https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/). Принципы баланса и умеренности: [ВОЗ — здоровый рацион](https://www.who.int/news-room/fact-sheets/detail/healthy-diet).",
  ].join("\n\n");
}
