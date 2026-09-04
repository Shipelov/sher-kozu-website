import { asc, eq } from "drizzle-orm";
import { pricingTiers, tierProductCatalog } from "../drizzle/schema";
import { getDb, listPublicAnimals } from "./db";

const TIER_RANK: Record<string, number> = {
  none: 0,
  guest: 0,
  basic: 1,
  standard: 2,
  professional: 3,
};

const OWNERSHIP_INTENT_TERMS = [
  "план владения",
  "тариф",
  "совладение",
  "владение животным",
  "какой план",
  "выбрать план",
  "подобрать план",
];

type OwnershipTier = {
  slug: string;
  name: string;
  sharePercent: number;
  minAnimals: number;
  monthlyFeeMinor: number;
  planChangeFrequency: string | null;
  deliveryAddresses: number;
  agedCheeseAccess: boolean;
};

type AvailableAnimal = {
  name: string;
  slug: string;
  species: "goat" | "sheep";
  breed: string | null;
  availableSharePercents: number[];
};

type CatalogProduct = {
  minTier: string;
  species: string;
  productType: string;
  label: string;
  unit: string;
};

export type OwnershipAdvisorContext = {
  tiers: OwnershipTier[];
  availableAnimals: AvailableAnimal[];
  products: CatalogProduct[];
};

export function isOwnershipRecommendationQuestion(question: string) {
  const normalized = question.toLocaleLowerCase("ru-RU");
  const hasStrongIntent = OWNERSHIP_INTENT_TERMS.some((term) =>
    normalized.includes(term),
  );
  const hasStarterIntent = normalized.includes("с чего начать");
  const hasOwnershipContext = /животн|дол[яию]|овеч|овц|коз|сыр|продукт/.test(
    normalized,
  );
  return hasStrongIntent || (hasStarterIntent && hasOwnershipContext);
}

export function extractFamilySize(question: string) {
  const normalized = question.toLocaleLowerCase("ru-RU");
  const direct = normalized.match(/(\d{1,2})\s*(?:человек|члена|членов|персон)/);
  if (direct) return Number(direct[1]);
  if (/семь[яеи]/.test(normalized)) return null;
  return null;
}

function detectSpecies(question: string): "goat" | "sheep" | null {
  const normalized = question.toLocaleLowerCase("ru-RU");
  if (/овеч|овц|лакон|остфриз/.test(normalized)) return "sheep";
  if (/коз|заанен|нубий|альпий/.test(normalized)) return "goat";
  return null;
}

function wantsAgedCheese(question: string) {
  return /выдержан|6\s*[-–]?\s*24|зрел/.test(question.toLocaleLowerCase("ru-RU"));
}

function formatRub(minor: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(
    minor / 100,
  );
}

function frequencyLabel(value: string | null) {
  if (value === "weekly") return "раз в неделю";
  if (value === "monthly") return "раз в месяц";
  if (value === "quarterly") return "раз в квартал";
  return "по условиям тарифа";
}

function productIsCheese(product: CatalogProduct) {
  return (
    /cheese|brynza/i.test(product.productType) ||
    /сыр|брынз|качот|халуми|рикот|фет/i.test(product.label)
  );
}

function productsForTier(
  products: CatalogProduct[],
  tierSlug: string,
  species: "goat" | "sheep" | null,
) {
  const tierRank = TIER_RANK[tierSlug] ?? 0;
  return products.filter((product) => {
    const productRank = TIER_RANK[product.minTier] ?? Number.POSITIVE_INFINITY;
    const speciesMatches =
      !species || product.species === "both" || product.species === species;
    return productRank <= tierRank && speciesMatches && productIsCheese(product);
  });
}

export function buildGroundedOwnershipReply(
  question: string,
  context: OwnershipAdvisorContext,
) {
  if (!isOwnershipRecommendationQuestion(question)) return null;

  const familySize = extractFamilySize(question);
  const species = detectSpecies(question);
  const agedCheese = wantsAgedCheese(question);
  const paidTiers = context.tiers
    .filter((tier) => tier.slug !== "guest" && tier.sharePercent > 0)
    .sort((a, b) => a.sharePercent - b.sharePercent);
  const starterTier = paidTiers.find((tier) => tier.slug === "basic") ?? paidTiers[0];
  const fullTier = paidTiers.find((tier) => tier.slug === "standard");
  const agedTier = paidTiers.find((tier) => tier.agedCheeseAccess);
  const matchingAnimals = context.availableAnimals.filter(
    (animal) => (!species || animal.species === species) && animal.availableSharePercents.length > 0,
  );

  if (!starterTier) {
    return [
      "Сейчас я не вижу в системе активных тарифов владения, поэтому не буду придумывать план.",
      "Пожалуйста, откройте [раздел цен](/pricing) или напишите ферме — после публикации тарифов я смогу сравнить их по составу семьи и продуктам.",
    ].join("\n\n");
  }

  const familyText = familySize ? `Для семьи из ${familySize} человек` : "Для семьи";
  const preferenceText =
    species === "sheep"
      ? "с интересом к овечьим сырам"
      : species === "goat"
        ? "с интересом к козьим продуктам"
        : "которая выбирает первое животное";
  const lines = [
    `${familyText} ${preferenceText} я сравниваю только действующие тарифы из каталога. Отдельного овечьего или семейного тарифа сейчас нет.`,
    `**Стартовый вариант — «${starterTier.name}»**: доля ${starterTier.sharePercent}%, тарифная плата ${formatRub(starterTier.monthlyFeeMinor)} ₽/мес., продуктовый план можно менять ${frequencyLabel(starterTier.planChangeFrequency)}, адресов доставки — ${starterTier.deliveryAddresses}. Это разумный способ проверить, какой объём продукции реально нужен семье.`,
  ];

  if (fullTier) {
    lines.push(
      `**Если продукты нужны регулярно всей семье — «${fullTier.name}»**: доля ${fullTier.sharePercent}%, тарифная плата ${formatRub(fullTier.monthlyFeeMinor)} ₽/мес., смена продуктового плана ${frequencyLabel(fullTier.planChangeFrequency)}, адресов доставки — ${fullTier.deliveryAddresses}. Точный выбор между ${starterTier.sharePercent}% и ${fullTier.sharePercent}% зависит от желаемого количества сыра в месяц.`,
    );
  }

  if (agedCheese) {
    if (agedTier) {
      lines.push(
        `Для выдержанных сыров нужен тариф **«${agedTier.name}»**; по текущим условиям он требует минимум ${agedTier.minAnimals} животных.`,
      );
    } else {
      lines.push("В текущих активных тарифах я не вижу подтверждённого доступа к выдержанным сырам.");
    }
  }

  if (matchingAnimals.length) {
    lines.push(
      `**Фактически доступные сейчас ${species === "sheep" ? "овцы" : species === "goat" ? "козы" : "животные"}:** ${matchingAnimals
        .slice(0, 5)
        .map(
          (animal) =>
            `[${animal.name}](/animals/${animal.slug}) — ${animal.breed ?? "порода не указана"}, доступная доля ${animal.availableSharePercents.join("% или ")}%`,
        )
        .join("; ")}. Наличие проверяется в момент оформления.`,
    );
  } else {
    lines.push(
      `Сейчас в публичном каталоге нет свободной ${species === "sheep" ? "доли овцы" : species === "goat" ? "доли козы" : "доли животного"}. Я не буду рекомендовать занятое животное; проверьте [актуальный каталог](/animals) или оставьте запрос ферме.`,
    );
  }

  const starterProducts = productsForTier(context.products, starterTier.slug, species);
  if (starterProducts.length) {
    lines.push(
      `В продуктовом каталоге стартового тарифа подтверждены: ${starterProducts
        .slice(0, 5)
        .map((product) => `${product.label} (${product.unit})`)
        .join(", ")}. Фактическое количество рассчитывается из надоя выбранной доли и вашей продуктовой конфигурации.`,
    );
  }

  lines.push(
    "**С чего начать:** откройте [калькулятор](/pricing/calculator), выберите овцу и сначала сравните 50% и 100% по желаемому объёму сыра. Напишите, сколько килограммов сыра семья съедает в месяц и нужны ли выдержанные сыры — тогда я уточню выбор без предположений.",
  );

  return lines.join("\n\n");
}

export async function loadOwnershipAdvisorContext(): Promise<OwnershipAdvisorContext> {
  const db = await getDb();
  if (!db) return { tiers: [], availableAnimals: [], products: [] };

  const [tiers, animals, products] = await Promise.all([
    db
      .select({
        slug: pricingTiers.slug,
        name: pricingTiers.name,
        sharePercent: pricingTiers.sharePercent,
        minAnimals: pricingTiers.minAnimals,
        monthlyFeeMinor: pricingTiers.monthlyFeeMinor,
        planChangeFrequency: pricingTiers.planChangeFrequency,
        deliveryAddresses: pricingTiers.deliveryAddresses,
        agedCheeseAccess: pricingTiers.agedCheeseAccess,
      })
      .from(pricingTiers)
      .where(eq(pricingTiers.isActive, true))
      .orderBy(asc(pricingTiers.displayOrder)),
    listPublicAnimals(),
    db
      .select({
        minTier: tierProductCatalog.minTier,
        species: tierProductCatalog.species,
        productType: tierProductCatalog.productType,
        label: tierProductCatalog.label,
        unit: tierProductCatalog.unit,
      })
      .from(tierProductCatalog)
      .where(eq(tierProductCatalog.isEnabled, 1))
      .orderBy(asc(tierProductCatalog.sortOrder)),
  ]);

  return {
    tiers,
    availableAnimals: animals.map((animal) => ({
      name: animal.name,
      slug: animal.slug,
      species: animal.species,
      breed: animal.breed,
      availableSharePercents: animal.availableSharePercents,
    })),
    products,
  };
}

export async function getGroundedOwnershipRecommendation(question: string) {
  if (!isOwnershipRecommendationQuestion(question)) return null;
  try {
    const context = await loadOwnershipAdvisorContext();
    return buildGroundedOwnershipReply(question, context);
  } catch (error) {
    console.error("[Masha Ownership Advisor] Failed to load live catalog:", error);
    return [
      "Сейчас мне не удалось загрузить актуальные тарифы и наличие животных, поэтому я не буду предлагать план по памяти.",
      "Пожалуйста, проверьте [раздел цен](/pricing) и [каталог животных](/animals) или повторите вопрос через несколько минут.",
    ].join("\n\n");
  }
}
