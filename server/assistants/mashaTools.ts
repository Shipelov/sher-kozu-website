/**
 * Инструменты Маши: всё читается из живой БД, результаты — компактный JSON.
 * Ссылки на сайт формируются только здесь, чтобы модель не выдумывала URL.
 */

import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import {
  animalOwnerships,
  animals,
  pricingTiers,
  type Plan,
  type PlanDuration,
  type PricingTier,
} from "../../drizzle/schema";
import { getDb, getAnimalBySlug, listPublicAnimals } from "../db";
import { ENV } from "../_core/env";
import {
  listActiveKnowledgeByCategory,
  searchAssistantKnowledge,
  ASSISTANT_KNOWLEDGE_CATEGORIES,
} from "../assistantKnowledgeDb";
import { calculateSharePricing, type CalculatorBreed } from "../routers/pricing";
import { createToolDefiner, type ToolDef } from "./core";

export type MashaToolContext = {
  /** openId авторизованного пользователя; null для гостя. */
  userOpenId: string | null;
};

export const SITE_LINKS = {
  catalog: "/animals",
  pricing: "/pricing",
  calculator: "/pricing/calculator",
  nutritionist: "/nutritionist",
  dashboard: "/dashboard",
} as const;

export function animalUrl(slug: string): string {
  return `/animal/${slug}`;
}

const PUBLIC_STATUSES = new Set(["public_available", "public_limited", "fully_booked"]);

function rub(minor: number | null | undefined): number | null {
  return typeof minor === "number" ? Math.round(minor / 100) : null;
}

function statusLabel(status: string, availablePercent: number): string {
  if (status === "fully_booked" || availablePercent <= 0) return "все доли заняты";
  if (status === "public_limited" || availablePercent < 100) return "доступна часть долей";
  return "доступна";
}

type PublicAnimal = Awaited<ReturnType<typeof listPublicAnimals>>[number];

function compactAnimal(animal: PublicAnimal) {
  return {
    name: animal.name,
    slug: animal.slug,
    species: animal.species,
    breed: animal.breed ?? null,
    status: statusLabel(animal.status, animal.availablePercent),
    availablePercent: animal.availablePercent,
    shareUnitPercent: animal.shareUnitPercent,
    shareMonthlyPriceRub: rub(animal.shareUnitPriceMinor),
    description: (animal.shortDescription ?? "").slice(0, 200),
    url: animalUrl(animal.slug),
  };
}

/** Порода из свободного текста каталога → порода калькулятора. */
export function mapBreedToCalculator(breed: string | null | undefined, species: string): {
  breed: CalculatorBreed;
  approximated: boolean;
} {
  const text = (breed ?? "").toLowerCase();
  if (text.includes("нубий")) return { breed: "anglo-nubian", approximated: false };
  if (text.includes("альп")) return { breed: "alpine", approximated: false };
  if (text.includes("лакон")) return { breed: "lacaune", approximated: false };
  if (text.includes("фриз")) return { breed: "east-friesian", approximated: false };
  return species === "sheep"
    ? { breed: "lacaune", approximated: true }
    : { breed: "alpine", approximated: true };
}

const DEFAULT_ALLOCATION: Record<string, number> = { "fresh-milk": 60, "soft-cheese": 20, tvorog: 20 };

export const SEARCH_KNOWLEDGE_LIMIT = 3;
export const SEARCH_KNOWLEDGE_CONTENT_MAX_CHARS = 1500;

/**
 * Записи базы знаний — длинный markdown (породы по 3–5 КБ). В tool_result
 * уходит плоский текст без разметки, обрезанный по лимиту: большой результат
 * инструмента ронял второй вызов LLM (ECONNRESET до AI Gateway).
 */
export function compactKnowledgeContent(content: string, maxChars = SEARCH_KNOWLEDGE_CONTENT_MAX_CHARS): string {
  const plain = content
    .replace(/\r\n/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (plain.length <= maxChars) return plain;
  const cut = plain.slice(0, maxChars);
  const boundary = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return `${(boundary > maxChars * 0.6 ? cut.slice(0, boundary + 1) : cut).trimEnd()}…`;
}

const knowledgeCategorySchema = z.enum(ASSISTANT_KNOWLEDGE_CATEGORIES);
const mashaTool = createToolDefiner<MashaToolContext>();

export const getFarmInfo = mashaTool({
  name: "get_farm_info",
  description: "Общая информация о ферме «Шерь Козу»: что это, как работает участие, шаги. Вызывай на вопросы «расскажи о ферме», «как это работает», «как попасть на ферму».",
  inputSchema: z.object({}),
  handler: async () => {
    const entries = await listActiveKnowledgeByCategory("masha", "farm");
    return {
      entries: entries.map((entry) => ({ title: entry.title, content: entry.content })),
      links: { catalog: SITE_LINKS.catalog, pricing: SITE_LINKS.pricing },
    };
  },
});

export const listAnimals = mashaTool({
  name: "list_animals",
  description: "Живой каталог животных фермы: имена, породы, вид, доступность долей, цена доли, ссылка. Единственный источник о том, какие животные и породы есть на ферме сейчас.",
  inputSchema: z.object({
    species: z.enum(["goat", "sheep"]).optional().describe("Фильтр по виду: goat — козы, sheep — овцы"),
    availableOnly: z.boolean().optional().describe("Только животные со свободными долями"),
  }),
  handler: async (args) => {
    const all = await listPublicAnimals();
    const filtered = all.filter(
      (animal) =>
        (!args.species || animal.species === args.species) &&
        (!args.availableOnly || animal.availablePercent > 0),
    );
    const breeds = Array.from(new Set(filtered.map((animal) => animal.breed).filter((b): b is string => Boolean(b))));
    return {
      total: filtered.length,
      goats: filtered.filter((animal) => animal.species === "goat").length,
      sheep: filtered.filter((animal) => animal.species === "sheep").length,
      breeds,
      animals: filtered.map(compactAnimal),
      catalogUrl: SITE_LINKS.catalog,
    };
  },
});

export const getAnimal = mashaTool({
  name: "get_animal",
  description: "Профиль одного животного по slug из list_animals: история, характер, доступные доли, планы участия и цены.",
  inputSchema: z.object({ slug: z.string().min(1).max(120) }),
  handler: async (args, ctx) => {
    const animal = await getAnimalBySlug(args.slug, ctx.userOpenId);
    const farmOwner = ENV.ownerOpenId;
    const visible =
      animal &&
      (PUBLIC_STATUSES.has(animal.status) || animal.mySharePercent > 0) &&
      (!farmOwner || animal.ownerOpenId === farmOwner || animal.mySharePercent > 0);
    if (!animal || !visible) {
      return { found: false, hint: "Такого животного нет в каталоге; список — list_animals." };
    }
    return {
      found: true,
      ...compactAnimal(animal),
      story: (animal.story ?? "").slice(0, 600),
      birthDate: animal.birthDate ? String(animal.birthDate).slice(0, 10) : null,
      availableSharePercents: animal.availableSharePercents,
      fullMonthlyPriceRub: rub(animal.fullPriceMinor),
      mySharePercent: animal.mySharePercent,
      ownersCount: animal.ownersCount,
      plans: animal.plans.map((plan: Plan & { durations: PlanDuration[] }) => ({
        name: plan.name,
        description: (plan.description ?? "").slice(0, 200),
        durations: plan.durations.map((duration: PlanDuration) => ({
          months: duration.months,
          priceRub: rub(duration.priceMinor),
          label: duration.label,
        })),
      })),
    };
  },
});

export const getPricingTiers = mashaTool({
  name: "get_pricing_tiers",
  description: "Тарифы участия (базовый, стандартный, профессиональный): доля, ежемесячная плата, что входит. Вызывай на вопросы о тарифах и «что входит».",
  inputSchema: z.object({}),
  handler: async () => {
    const db = await getDb();
    if (!db) return { tiers: [], pricingUrl: SITE_LINKS.pricing };
    const rows = await db.select().from(pricingTiers).where(eq(pricingTiers.isActive, true)).orderBy(pricingTiers.displayOrder);
    const asStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
    return {
      tiers: rows.map((tier: PricingTier) => ({
        slug: tier.slug,
        name: tier.name,
        subtitle: tier.subtitle,
        sharePercent: tier.sharePercent,
        minAnimals: tier.minAnimals,
        monthlyFeeRub: rub(tier.monthlyFeeMinor),
        annualDiscountPercent: tier.annualDiscountPercent,
        planChangeFrequency: tier.planChangeFrequency,
        deliveryAddresses: tier.deliveryAddresses,
        farmVisitsPerYear: tier.farmVisitsPerYear,
        clubEventsPerYear: tier.clubEventsPerYear,
        agedCheeseAccess: tier.agedCheeseAccess,
        hasPersonalManager: tier.hasPersonalManager,
        features: asStringArray(tier.featureHighlights).slice(0, 8),
        limitations: asStringArray(tier.limitations).slice(0, 5),
      })),
      pricingUrl: SITE_LINKS.pricing,
    };
  },
});

export const calculateShare = mashaTool({
  name: "calculate_share",
  description: "Расчёт стоимости и выгоды доли конкретного животного (50 или 100 %): цена доли в каталоге, тариф, годовая рыночная стоимость продуктов. Вызывай на «сколько стоит половина козы» и подобные.",
  inputSchema: z.object({
    slug: z.string().min(1).max(120).describe("slug животного из list_animals"),
    percent: z.union([z.literal(50), z.literal(100)]).describe("Размер доли"),
  }),
  handler: async (args, ctx) => {
    const animal = await getAnimalBySlug(args.slug, ctx.userOpenId);
    if (!animal || !PUBLIC_STATUSES.has(animal.status)) {
      return { found: false, hint: "Такого животного нет в каталоге; список — list_animals." };
    }
    const mapped = mapBreedToCalculator(animal.breed, animal.species);
    const units = Math.max(1, Math.round(args.percent / animal.shareUnitPercent));
    const calculation = await calculateSharePricing(
      { breed: mapped.breed, sharePercent: args.percent, productAllocation: DEFAULT_ALLOCATION },
      { logSession: false },
    );
    return {
      found: true,
      animal: { name: animal.name, slug: animal.slug, url: animalUrl(animal.slug), breed: animal.breed },
      percent: args.percent,
      available: animal.availablePercent >= args.percent,
      catalogMonthlyPriceRub: rub(animal.shareUnitPriceMinor * units),
      calculator: {
        breedUsed: calculation.breed,
        breedApproximated: mapped.approximated,
        myAnnualMilkLiters: calculation.myAnnualMilk,
        tierName: calculation.tierName,
        monthlyFeeRub: calculation.monthlyFeeRub,
        annualFeeRub: calculation.annualFeeRub,
        annualMarketValueRub: calculation.totalMarketValueRub,
        annualSavingsRub: calculation.annualSavingsRub,
        savingsPercent: calculation.savingsPercent,
        assumedAllocation: DEFAULT_ALLOCATION,
      },
      calculatorUrl: SITE_LINKS.calculator,
    };
  },
});

export const searchKnowledge = mashaTool({
  name: "search_knowledge",
  description: "Поиск по базе знаний фермы: породы и их особенности, продукты, клуб владельцев, платформа, рынок, для кого проект. Возвращает до 3 самых релевантных записей (текст сокращён).",
  inputSchema: z.object({
    query: z.string().min(2).max(200),
    category: knowledgeCategorySchema.optional(),
  }),
  handler: async (args) => {
    const entries = await searchAssistantKnowledge("masha", args.query, { category: args.category, limit: SEARCH_KNOWLEDGE_LIMIT });
    const result = {
      results: entries
        .filter((entry) => entry.score > 0)
        .map((entry) => ({ title: entry.title, category: entry.category, content: compactKnowledgeContent(entry.content) })),
    };
    console.info(`[masha:search_knowledge] results=${result.results.length} bytes=${Buffer.byteLength(JSON.stringify(result))}`);
    return result;
  },
});

export const getDeliveryInfo = mashaTool({
  name: "get_delivery_info",
  description: "Условия доставки продуктов: регионы, как устроена. Вызывай на вопросы «доставляете ли в …».",
  inputSchema: z.object({}),
  handler: async () => {
    const entries = await listActiveKnowledgeByCategory("masha", "delivery");
    return { entries: entries.map((entry) => ({ title: entry.title, content: entry.content })) };
  },
});

export const getMyAnimals = mashaTool({
  name: "get_my_animals",
  description: "Животные текущего авторизованного пользователя (владельца): доли, статус участия. Только для авторизованных.",
  inputSchema: z.object({}),
  handler: async (_args, ctx) => {
    if (!ctx.userOpenId) return { authenticated: false, animals: [] };
    const db = await getDb();
    if (!db) return { authenticated: true, animals: [] };
    const rows = await db
      .select({
        name: animals.name,
        slug: animals.slug,
        species: animals.species,
        breed: animals.breed,
        ownershipStatus: animalOwnerships.status,
        endsAt: animalOwnerships.endsAt,
      })
      .from(animalOwnerships)
      .innerJoin(animals, eq(animalOwnerships.animalId, animals.id))
      .where(
        and(
          eq(animalOwnerships.ownerOpenId, ctx.userOpenId),
          or(
            eq(animalOwnerships.status, "active"),
            eq(animalOwnerships.status, "pending_payment"),
            eq(animalOwnerships.status, "frozen"),
          ),
        ),
      );
    const bySlug = new Map<string, { name: string; slug: string; species: string; breed: string | null; slots: number; status: string; endsAt: string | null; url: string }>();
    for (const row of rows) {
      const current = bySlug.get(row.slug);
      if (current) {
        current.slots += 1;
        continue;
      }
      bySlug.set(row.slug, {
        name: row.name,
        slug: row.slug,
        species: row.species,
        breed: row.breed ?? null,
        slots: 1,
        status: row.ownershipStatus,
        endsAt: row.endsAt ? String(row.endsAt).slice(0, 10) : null,
        url: animalUrl(row.slug),
      });
    }
    return {
      authenticated: true,
      animals: Array.from(bySlug.values()).map((item) => ({ ...item, sharePercent: item.slots * 50 })),
      dashboardUrl: SITE_LINKS.dashboard,
    };
  },
});

export const MASHA_GUEST_TOOLS: ToolDef<MashaToolContext>[] = [
  getFarmInfo,
  listAnimals,
  getAnimal,
  getPricingTiers,
  calculateShare,
  searchKnowledge,
  getDeliveryInfo,
];

export function mashaToolsFor(ctx: MashaToolContext): ToolDef<MashaToolContext>[] {
  return ctx.userOpenId ? [...MASHA_GUEST_TOOLS, getMyAnimals] : MASHA_GUEST_TOOLS;
}
