/**
 * Pricing Router — tRPC procedures for the Pricing section.
 *
 * Public:
 *   - pricing.getTiers          → all active tiers for pricing pages
 *   - pricing.getTierBySlug     → single tier detail
 *   - pricing.getMarketPrices   → market prices for calculator
 *   - pricing.getConversions    → milk-to-product conversion rates
 *   - pricing.calculate         → run calculator with user inputs
 *   - pricing.logPageView       → analytics: track pricing page visits
 *
 * Admin:
 *   - pricing.adminListMarketPrices   → full list with edit capabilities
 *   - pricing.adminUpdateMarketPrice  → update a market price entry
 *   - pricing.adminListConversions    → full list of conversions
 *   - pricing.adminUpdateConversion   → update a conversion entry
 *   - pricing.adminListTiers          → full list of tiers
 *   - pricing.adminUpdateTier         → update tier parameters
 *   - pricing.adminGetAnalytics       → pricing page analytics
 */

import { z } from "zod";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  pricingTiers,
  marketPrices,
  productConversions,
  calculatorSessions,
  pricingPageViews,
} from "../../drizzle/schema";
import { publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAdmin(ctx: { user?: { role?: string } | null }) {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Только для администраторов" });
  }
}

/**
 * MySQL JSON columns via Drizzle return already-parsed objects.
 * This helper safely handles both pre-parsed objects and raw JSON strings.
 */
function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Annual milk yield per breed (liters)
const BREED_ANNUAL_MILK: Record<string, number> = {
  "anglo-nubian": 800,
  "alpine": 900,
  "lacaune": 350,
  "east-friesian": 500,
};

const BREED_SPECIES: Record<string, string> = {
  "anglo-nubian": "goat",
  "alpine": "goat",
  "lacaune": "sheep",
  "east-friesian": "sheep",
};

const BREED_NAMES_RU: Record<string, string> = {
  "anglo-nubian": "Англо-нубийская коза",
  "alpine": "Альпийская коза",
  "lacaune": "Овца Лакон",
  "east-friesian": "Остфризская овца",
};

// ─── Public Procedures ───────────────────────────────────────────────────────

const getTiers = publicProcedure.query(async () => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(pricingTiers)
    .where(eq(pricingTiers.isActive, true))
    .orderBy(pricingTiers.displayOrder);
  return rows.map((r: any) => ({
    ...r,
    monthlyFee: r.monthlyFeeMinor / 100,
    featureHighlights: safeJsonArray(r.featureHighlights),
    limitations: safeJsonArray(r.limitations),
  }));
});

const getTierBySlug = publicProcedure
  .input(z.object({ slug: z.string() }))
  .query(async ({ input }) => {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(pricingTiers)
      .where(and(eq(pricingTiers.slug, input.slug), eq(pricingTiers.isActive, true)));
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Тариф не найден" });
    return {
      ...row,
      monthlyFee: row.monthlyFeeMinor / 100,
      featureHighlights: safeJsonArray(row.featureHighlights),
      limitations: safeJsonArray(row.limitations),
    };
  });

const getMarketPrices = publicProcedure
  .input(z.object({ species: z.enum(["goat", "sheep"]).optional() }).optional())
  .query(async ({ input }) => {
    const db = await getDb();
    let rows;
    if (input?.species) {
      rows = await db
        .select()
        .from(marketPrices)
        .where(and(eq(marketPrices.isActive, true), eq(marketPrices.species, input.species)))
        .orderBy(marketPrices.displayOrder);
    } else {
      rows = await db
        .select()
        .from(marketPrices)
        .where(eq(marketPrices.isActive, true))
        .orderBy(marketPrices.displayOrder);
    }
    return rows.map((r: any) => ({
      ...r,
      minPrice: r.minPriceMinor / 100,
      maxPrice: r.maxPriceMinor / 100,
      avgPrice: r.avgPriceMinor / 100,
    }));
  });

const getConversions = publicProcedure.query(async () => {
  const db = await getDb();
  const rows = await db
    .select({
      id: productConversions.id,
      marketPriceId: productConversions.marketPriceId,
      milkLitersPerUnit: productConversions.milkLitersPerUnit,
      outputUnit: productConversions.outputUnit,
      notes: productConversions.notes,
      productName: marketPrices.productName,
      productSlug: marketPrices.productSlug,
      species: marketPrices.species,
      category: marketPrices.category,
      avgPrice: marketPrices.avgPriceMinor,
      tierAvailability: marketPrices.tierAvailability,
    })
    .from(productConversions)
    .innerJoin(marketPrices, eq(productConversions.marketPriceId, marketPrices.id));
  return rows.map((r: any) => ({
    ...r,
    avgPrice: r.avgPrice / 100,
  }));
});

export const calculateInputSchema = z.object({
  breed: z.enum(["anglo-nubian", "alpine", "lacaune", "east-friesian"]),
  sharePercent: z.union([z.literal(50), z.literal(100)]),
  productAllocation: z.record(z.string(), z.number().min(0).max(100)),
  animalPriceRub: z.number().positive().optional(),
});
export type CalculateInput = z.infer<typeof calculateInputSchema>;
export type CalculatorBreed = CalculateInput["breed"];

/**
 * Расчёт выгоды доли: используется калькулятором на сайте и инструментом
 * calculate_share Маши. logSession=false — не писать в calculatorSessions.
 */
export async function calculateSharePricing(input: CalculateInput, options: { logSession?: boolean } = {}) {
    const db = await getDb();
    const { breed, sharePercent, productAllocation } = input;
    const species = BREED_SPECIES[breed];
    const annualMilk = BREED_ANNUAL_MILK[breed];
    const myMilk = (annualMilk * sharePercent) / 100;

    // Get market prices and conversions for this species
    const pricesRows = await db
      .select({
        productSlug: marketPrices.productSlug,
        productName: marketPrices.productName,
        avgPriceMinor: marketPrices.avgPriceMinor,
        unit: marketPrices.unit,
        category: marketPrices.category,
        milkPerUnit: productConversions.milkLitersPerUnit,
        tierAvailability: marketPrices.tierAvailability,
      })
      .from(marketPrices)
      .innerJoin(productConversions, eq(productConversions.marketPriceId, marketPrices.id))
      .where(and(eq(marketPrices.species, species as "goat" | "sheep"), eq(marketPrices.isActive, true)));

    // Validate allocation sums to 100
    const totalAlloc = Object.values(productAllocation).reduce((s, v) => s + v, 0);
    if (Math.abs(totalAlloc - 100) > 1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Сумма распределения должна быть 100%, сейчас: ${totalAlloc}%`,
      });
    }

    // Map product slugs: frontend uses short slugs (fresh-milk, tvorog, kefir, yogurt, soft-cheese)
    // but DB uses species-prefixed slugs (goat-milk, goat-tvorog, goat-kefir, etc.)
    const SLUG_MAP: Record<string, Record<string, string>> = {
      goat: {
        "fresh-milk": "goat-milk",
        "tvorog": "goat-tvorog",
        "kefir": "goat-kefir",
        "yogurt": "goat-smetana",
        "smetana": "goat-smetana",
        "soft-cheese": "goat-soft-cheese",
        "semi-hard-cheese": "goat-semi-hard-cheese",
        "aged-cheese": "goat-aged-cheese",
      },
      sheep: {
        "fresh-milk": "sheep-milk",
        "tvorog": "sheep-tvorog",
        "kefir": "sheep-kefir",
        "yogurt": "sheep-smetana",
        "smetana": "sheep-smetana",
        "soft-cheese": "sheep-soft-cheese",
        "semi-hard-cheese": "sheep-semi-hard-cheese",
        "hard-cheese": "sheep-hard-cheese",
        "aged-cheese": "sheep-aged-cheese",
        "butter": "sheep-butter",
      },
    };

    // Calculate products and market value
    const products: Array<{
      productSlug: string;
      productName: string;
      allocPercent: number;
      milkUsed: number;
      outputQuantity: number;
      unit: string;
      marketValueRub: number;
    }> = [];

    let totalMarketValue = 0;

    for (const [slug, allocPercent] of Object.entries(productAllocation)) {
      if (allocPercent <= 0) continue;

      // Try direct slug match first, then mapped slug
      const mappedSlug = SLUG_MAP[species]?.[slug] || slug;
      const priceRow = pricesRows.find((p: { productSlug: string }) => p.productSlug === mappedSlug || p.productSlug === slug);
      if (!priceRow) continue;

      const milkForProduct = (myMilk * allocPercent) / 100;
      const outputQty = milkForProduct / priceRow.milkPerUnit;
      const marketValue = (outputQty * priceRow.avgPriceMinor) / 100;

      products.push({
        productSlug: slug,
        productName: priceRow.productName,
        allocPercent,
        milkUsed: Math.round(milkForProduct * 10) / 10,
        outputQuantity: Math.round(outputQty * 100) / 100,
        unit: priceRow.unit,
        marketValueRub: Math.round(marketValue),
      });

      totalMarketValue += marketValue;
    }

    // Get tier info
    const tierSlug = sharePercent === 50 ? "basic" : "standard";
    const [tier] = await db
      .select()
      .from(pricingTiers)
      .where(eq(pricingTiers.slug, tierSlug));

    const monthlyFee = tier ? tier.monthlyFeeMinor / 100 : sharePercent === 50 ? 7500 : 14900;
    const annualFee = monthlyFee * 12;
    const animalPrice = input.animalPriceRub || 0;
    const ownershipCost = (animalPrice * sharePercent) / 100;
    const totalFirstYearCost = ownershipCost + annualFee;
    const savings = totalMarketValue - annualFee;
    const savingsPercent = totalMarketValue > 0 ? Math.round((savings / totalMarketValue) * 100) : 0;

    const result = {
      breed: BREED_NAMES_RU[breed],
      species,
      sharePercent,
      annualMilkTotal: annualMilk,
      myAnnualMilk: myMilk,
      products,
      totalMarketValueRub: Math.round(totalMarketValue),
      ownershipCostRub: Math.round(ownershipCost),
      monthlyFeeRub: monthlyFee,
      annualFeeRub: annualFee,
      totalFirstYearCostRub: Math.round(totalFirstYearCost),
      annualSavingsRub: Math.round(savings),
      savingsPercent,
      tierSlug,
      tierName: tier?.name || tierSlug,
    };

    // Log calculator session
    if (options.logSession === false) return result;
    try {
      await db.insert(calculatorSessions).values({
        species: species as "goat" | "sheep",
        breedSlug: input.breed,
        sharePercent: input.sharePercent,
        animalCount: 1,
        tierSlug,
        annualCostMinor: Math.round(totalFirstYearCost * 100),
        marketValueMinor: Math.round(totalMarketValue * 100),
        savingsPercent,
        productDistribution: input.productAllocation,
      });
    } catch {
      // non-critical, don't fail the calculation
    }

    return result;
}

const calculate = publicProcedure
  .input(calculateInputSchema)
  .mutation(async ({ input }) => calculateSharePricing(input));

const logPageView = publicProcedure
  .input(
    z.object({
      pagePath: z.string(),
      referrer: z.string().optional(),
      sessionId: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    await db.insert(pricingPageViews).values({
      pagePath: input.pagePath,
      referrer: input.referrer || null,
      sessionId: input.sessionId || null,
    });
    return { ok: true };
  });

// ─── Admin Procedures ────────────────────────────────────────────────────────

const adminListMarketPrices = protectedProcedure.query(async ({ ctx }) => {
  isAdmin(ctx);
  const db = await getDb();
  const rows = await db.select().from(marketPrices).orderBy(marketPrices.species, marketPrices.displayOrder);
  return rows.map((r: any) => ({
    ...r,
    minPrice: r.minPriceMinor / 100,
    maxPrice: r.maxPriceMinor / 100,
    avgPrice: r.avgPriceMinor / 100,
  }));
});

const adminUpdateMarketPrice = protectedProcedure
  .input(
    z.object({
      id: z.number(),
      productName: z.string().optional(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      avgPrice: z.number().optional(),
      source: z.string().optional(),
      tierAvailability: z.enum(["all", "standard_plus", "professional_only"]).optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    isAdmin(ctx);
    const db = await getDb();
    const updates: Record<string, unknown> = {};
    if (input.productName !== undefined) updates.productName = input.productName;
    if (input.minPrice !== undefined) updates.minPriceMinor = Math.round(input.minPrice * 100);
    if (input.maxPrice !== undefined) updates.maxPriceMinor = Math.round(input.maxPrice * 100);
    if (input.avgPrice !== undefined) updates.avgPriceMinor = Math.round(input.avgPrice * 100);
    if (input.source !== undefined) updates.source = input.source;
    if (input.tierAvailability !== undefined) updates.tierAvailability = input.tierAvailability;
    if (input.isActive !== undefined) updates.isActive = input.isActive;
    updates.lastVerifiedAt = new Date();

    await db.update(marketPrices).set(updates).where(eq(marketPrices.id, input.id));
    return { ok: true };
  });

const adminListConversions = protectedProcedure.query(async ({ ctx }) => {
  isAdmin(ctx);
  const db = await getDb();
  const rows = await db
    .select({
      id: productConversions.id,
      marketPriceId: productConversions.marketPriceId,
      milkLitersPerUnit: productConversions.milkLitersPerUnit,
      outputUnit: productConversions.outputUnit,
      notes: productConversions.notes,
      productName: marketPrices.productName,
      productSlug: marketPrices.productSlug,
    })
    .from(productConversions)
    .innerJoin(marketPrices, eq(productConversions.marketPriceId, marketPrices.id));
  return rows as any[];
});

const adminUpdateConversion = protectedProcedure
  .input(
    z.object({
      id: z.number(),
      milkLitersPerUnit: z.number().positive().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    isAdmin(ctx);
    const db = await getDb();
    const updates: Record<string, unknown> = {};
    if (input.milkLitersPerUnit !== undefined) updates.milkLitersPerUnit = input.milkLitersPerUnit;
    if (input.notes !== undefined) updates.notes = input.notes;
    await db.update(productConversions).set(updates).where(eq(productConversions.id, input.id));
    return { ok: true };
  });

const adminListTiers = protectedProcedure.query(async ({ ctx }) => {
  isAdmin(ctx);
  const db = await getDb();
  const rows = await db.select().from(pricingTiers).orderBy(pricingTiers.displayOrder);
  return rows.map((r: any) => ({
    ...r,
    monthlyFee: r.monthlyFeeMinor / 100,
    featureHighlights: safeJsonArray(r.featureHighlights),
    limitations: safeJsonArray(r.limitations),
  }));
});

const adminUpdateTier = protectedProcedure
  .input(
    z.object({
      id: z.number(),
      monthlyFee: z.number().optional(),
      annualDiscountPercent: z.number().optional(),
      renewalDiscountPercent: z.number().optional(),
      packageDiscountPercent: z.number().optional(),
      shopDiscountPercent: z.number().optional(),
      farmVisitsPerYear: z.number().optional(),
      clubEventsPerYear: z.number().optional(),
      deliveryAddresses: z.number().optional(),
      heroDescription: z.string().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    isAdmin(ctx);
    const db = await getDb();
    const updates: Record<string, unknown> = {};
    if (input.monthlyFee !== undefined) updates.monthlyFeeMinor = Math.round(input.monthlyFee * 100);
    if (input.annualDiscountPercent !== undefined) updates.annualDiscountPercent = input.annualDiscountPercent;
    if (input.renewalDiscountPercent !== undefined) updates.renewalDiscountPercent = input.renewalDiscountPercent;
    if (input.packageDiscountPercent !== undefined) updates.packageDiscountPercent = input.packageDiscountPercent;
    if (input.shopDiscountPercent !== undefined) updates.shopDiscountPercent = input.shopDiscountPercent;
    if (input.farmVisitsPerYear !== undefined) updates.farmVisitsPerYear = input.farmVisitsPerYear;
    if (input.clubEventsPerYear !== undefined) updates.clubEventsPerYear = input.clubEventsPerYear;
    if (input.deliveryAddresses !== undefined) updates.deliveryAddresses = input.deliveryAddresses;
    if (input.heroDescription !== undefined) updates.heroDescription = input.heroDescription;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    await db.update(pricingTiers).set(updates).where(eq(pricingTiers.id, input.id));
    return { ok: true };
  });

const adminGetAnalytics = protectedProcedure
  .input(
    z.object({
      days: z.number().int().min(1).max(365).default(30),
    }).optional()
  )
  .query(async ({ ctx, input }) => {
    isAdmin(ctx);
    const db = await getDb();
    const days = input?.days || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Page views by page
    const pageViewsRaw = await db
      .select({
        pagePath: pricingPageViews.pagePath,
        count: sql<number>`count(*)`,
      })
      .from(pricingPageViews)
      .where(gte(pricingPageViews.createdAt, since))
      .groupBy(pricingPageViews.pagePath);

    // Calculator sessions
    const calcSessionsRaw = await db
      .select({
        breed: calculatorSessions.breedSlug,
        tierSlug: calculatorSessions.tierSlug,
        count: sql<number>`count(*)`,
        avgSavings: sql<number>`AVG(savingsPercent)`,
      })
      .from(calculatorSessions)
      .where(gte(calculatorSessions.createdAt, since))
      .groupBy(calculatorSessions.breedSlug, calculatorSessions.tierSlug);

    // Most popular product allocations
    const popularConfigs = await db
      .select({
        breed: calculatorSessions.breedSlug,
        sharePercent: calculatorSessions.sharePercent,
        count: sql<number>`count(*)`,
      })
      .from(calculatorSessions)
      .where(gte(calculatorSessions.createdAt, since))
      .groupBy(calculatorSessions.breedSlug, calculatorSessions.sharePercent)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    return {
      period: { days, since: since.toISOString() },
      pageViews: pageViewsRaw,
      calculatorSessions: calcSessionsRaw,
      popularConfigs,
    };
  });

// ─── Export ──────────────────────────────────────────────────────────────────

export const pricingRouter = {
  getTiers,
  getTierBySlug,
  getMarketPrices,
  getConversions,
  calculate,
  logPageView,
  adminListMarketPrices,
  adminUpdateMarketPrice,
  adminListConversions,
  adminUpdateConversion,
  adminListTiers,
  adminUpdateTier,
  adminGetAnalytics,
};
