import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getProductionProfile,
  upsertProductionProfile,
  listProductOptions,
  upsertProductOption,
  deleteProductOption,
  getOwnerProductPlan,
  getOwnerProductPlanById,
  generateDeliverySchedule,
  listDeliverySchedule,
  updateDeliveryStatus,
  listChatMessages,
  createChatMessage,
  markChatMessagesRead,
  countUnreadChatMessages,
  listAdminChatConversations,
  getAnimalProductTrackData,
  resolveOwnerSharePercent,
  getAnimalNameById,
  deleteDeliverySchedule,
  logPlanChange,
  listPlanChangeLog,
  listAllPlanChangeLogs,
  purgeOldChatMessages,
  purgeOldPlanChangeLogs,
  clearChatMessagesByAnimal,
  clearPlanChangeLogByAnimal,
  listCompositionSnapshots,
  createCompositionSnapshot,
  updateCompositionSnapshot,
  deleteCompositionSnapshot,
  listMonthlyMetrics,
  upsertMonthlyMetric,
  deleteMonthlyMetric,
  getAnimalSlugById,
  notifyOwnersAboutCompositionUpdate,
  notifyOwnersAboutMetricsUpdate,
  // Tier-based product plan system
  getOwnerTierStatus,
  recomputeOwnerTier,
  getTierCatalogForOwner,
  listAllTierCatalogItems,
  upsertTierCatalogItem,
  deleteTierCatalogItem,
  createTierBasedProductPlan,
  adminVerifyProductSet,
  ownerConfigurePlan as ownerConfigurePlanDb,
  adminConfirmPlan,
  canOwnerChangePlan,
  ownerRequestPlanChange,
  listPendingProductPlans,
  listAllProductPlans,
  getTierChangeFrequencyDays,
  populateAnimalProductsFromCatalog,
  adminBatchVerifyProducts,
  getVerifiedProductOptions,
  areAllProductsVerified,
  resetPlanToAdminSetup,
  createUserNotification,
  getActiveOwnerOpenIdsByAnimalId,
  getAnimalIdBySlug,
} from "../db";
import type { ProductOption } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { notifyOwner } from "../_core/notification";
import { ENV } from "../_core/env";

/* ── Zod schemas ── */

const productTypeSchema = z.enum([
  "milk", "smetana", "yogurt", "kefir", "cheese",
  "brynza", "kachotta", "halumi", "ricotta", "camembert",
  "aged_cheese", "blue_cheese", "smoked_cheese",
  "butter", "condensed_milk", "fermented_drink", "custom",
]);

const tierSlugSchema = z.enum(["basic", "standard", "professional"]);

const productionProfileInput = z.object({
  animalId: z.number().int().positive(),
  annualMilkLiters: z.number().int().min(1).max(100_000),
  notes: z.string().max(2000).optional().nullable(),
});

const productOptionInput = z.object({
  id: z.number().int().positive().optional(),
  animalId: z.number().int().positive(),
  productType: productTypeSchema,
  label: z.string().min(1).max(160),
  conversionRatio: z.number().int().min(1).max(1000),
  unit: z.string().min(1).max(16),
  maxAnnualUnits: z.number().int().min(1).max(100_000),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

const deleteProductOptionInput = z.object({
  optionId: z.number().int().positive(),
  animalId: z.number().int().positive(),
});

/* Tier-based selection input */
const tierSelectionInput = z.object({
  catalogItemId: z.number().int().positive(),
  annualUnits: z.number().int().min(0).max(100_000),
});

const deliveryStatusInput = z.object({
  deliveryId: z.number().int().positive(),
  status: z.enum(["planned", "ready", "delivered"]),
  adminNote: z.string().max(1000).optional().nullable(),
});

const chatMessageInput = z.object({
  animalId: z.number().int().positive(),
  ownerOpenId: z.string().min(1).max(64),
  text: z.string().max(5000).optional().nullable(),
  photoBase64: z.string().optional().nullable(),
  photoMimeType: z.string().max(120).optional().nullable(),
  photoFileName: z.string().max(180).optional().nullable(),
});

const chatListInput = z.object({
  animalId: z.number().int().positive(),
  ownerOpenId: z.string().min(1).max(64),
});

const animalIdInput = z.object({
  animalId: z.number().int().positive(),
});

const scheduleInput = z.object({
  ownerOpenId: z.string().min(1).max(64),
  animalId: z.number().int().positive(),
  year: z.number().int().min(2024).max(2100).optional(),
});

/* ── Helper: calculate milk usage for selections ── */

async function calculateMilkUsage(animalId: number, selections: Array<{ productOptionId: number; annualUnits: number }>) {
  const options = (await listProductOptions(animalId)) as ProductOption[];
  const optionMap = new Map<number, ProductOption>(options.map((o) => [o.id, o]));

  let totalMilkUsed = 0;
  const enrichedSelections: Array<{
    productOptionId: number;
    productType: string;
    label: string;
    annualUnits: number;
    unit: string;
    milkUsed: number;
  }> = [];

  for (const sel of selections) {
    const option = optionMap.get(sel.productOptionId);
    if (!option) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Продукт #${sel.productOptionId} не найден.` });
    }
    if (!option.isEnabled) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Продукт «${option.label}» отключён.` });
    }
    if (sel.annualUnits > option.maxAnnualUnits) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Превышен лимит для «${option.label}»: макс. ${option.maxAnnualUnits} ${option.unit}/год.` });
    }

    const milkUsed = Math.floor(sel.annualUnits * option.conversionRatio);
    totalMilkUsed += milkUsed;

    enrichedSelections.push({
      productOptionId: sel.productOptionId,
      productType: option.productType,
      label: option.label,
      annualUnits: sel.annualUnits,
      unit: option.unit,
      milkUsed,
    });
  }

  return { totalMilkUsed, enrichedSelections };
}

/* ── Helper: calculate milk usage from tier catalog selections ── */

async function calculateTierMilkUsage(
  tierCatalog: Array<{ id: number; conversionRatio: number; label: string; unit: string }>,
  selections: Array<{ catalogItemId: number; annualUnits: number }>,
) {
  const catalogMap = new Map(tierCatalog.map(c => [c.id, c]));

  let totalMilkUsed = 0;
  const enrichedSelections: Array<{
    catalogItemId: number;
    label: string;
    annualUnits: number;
    unit: string;
    milkUsed: number;
  }> = [];

  for (const sel of selections) {
    const item = catalogMap.get(sel.catalogItemId);
    if (!item) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Продукт каталога #${sel.catalogItemId} не найден.` });
    }
    const milkUsed = Math.floor(sel.annualUnits * item.conversionRatio);
    totalMilkUsed += milkUsed;

    enrichedSelections.push({
      catalogItemId: sel.catalogItemId,
      label: item.label,
      annualUnits: sel.annualUnits,
      unit: item.unit,
      milkUsed,
    });
  }

  return { totalMilkUsed, enrichedSelections };
}

/* ── Router ── */

export const productTrackRouter = router({
  // ── Admin: Production Profile ──
  getProfile: protectedProcedure.input(animalIdInput).query(async ({ input }) => {
    return getProductionProfile(input.animalId);
  }),

  upsertProfile: protectedProcedure.input(productionProfileInput).mutation(async ({ input }) => {
    return upsertProductionProfile(input.animalId, input.annualMilkLiters, input.notes);
  }),

  // ── Admin: Product Options ──
  listOptions: protectedProcedure.input(animalIdInput).query(async ({ input }) => {
    return listProductOptions(input.animalId);
  }),

  upsertOption: protectedProcedure.input(productOptionInput).mutation(async ({ input }) => {
    // Server-side milk budget validation
    const profile = await getProductionProfile(input.animalId);
    if (profile) {
      const existingOptions = await listProductOptions(input.animalId);
      const milkUsedByOthers = existingOptions
        .filter((o: any) => o.id !== input.id)
        .reduce((sum: number, o: any) => sum + Math.floor(o.maxAnnualUnits * o.conversionRatio), 0);
      const thisOptionMilk = Math.floor((input.maxAnnualUnits ?? 0) * input.conversionRatio);
      const totalMilk = milkUsedByOthers + thisOptionMilk;
      if (totalMilk > profile.annualMilkLiters) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Превышен молочный бюджет: ${totalMilk} л из ${profile.annualMilkLiters} л. Уменьшите лимит или конверсию.`,
        });
      }
    }
    return upsertProductOption(input);
  }),

  deleteOption: protectedProcedure.input(deleteProductOptionInput).mutation(async ({ input }) => {
    return deleteProductOption(input.optionId, input.animalId);
  }),

  // ── Admin: Full product track data for an animal ──
  getAnimalTrackData: protectedProcedure.input(animalIdInput).query(async ({ input }) => {
    return getAnimalProductTrackData(input.animalId);
  }),

  // ── Owner: Product Plan (current) ──
  getMyPlan: protectedProcedure.input(animalIdInput).query(async ({ ctx, input }) => {
    return getOwnerProductPlan(ctx.user.openId, input.animalId);
  }),

  // ═══════════════════════════════════════════════════════════
  //  TIER SYSTEM — New tier-based product plan workflow
  // ═══════════════════════════════════════════════════════════

  /** Get current owner's tier status */
  getMyTier: protectedProcedure.query(async ({ ctx }) => {
    const tier = await getOwnerTierStatus(ctx.user.openId);
    if (!tier) {
      const result = await recomputeOwnerTier(ctx.user.openId);
      return {
        ...result.tierStatus,
        changeFrequencyDays: getTierChangeFrequencyDays(result.tierStatus.tierSlug),
      };
    }
    return {
      ...tier,
      changeFrequencyDays: getTierChangeFrequencyDays(tier.tierSlug),
    };
  }),

  /** Admin: get any owner's tier status */
  getOwnerTier: protectedProcedure
    .input(z.object({ ownerOpenId: z.string().min(1).max(64) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const tier = await getOwnerTierStatus(input.ownerOpenId);
      if (!tier) {
        const result = await recomputeOwnerTier(input.ownerOpenId);
        return {
          ...result.tierStatus,
          changeFrequencyDays: getTierChangeFrequencyDays(result.tierStatus.tierSlug),
        };
      }
      return {
        ...tier,
        changeFrequencyDays: getTierChangeFrequencyDays(tier.tierSlug),
      };
    }),

  /** Recompute owner's tier (called after ownership changes) */
  recomputeTier: protectedProcedure
    .input(z.object({ ownerOpenId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      return recomputeOwnerTier(input.ownerOpenId);
    }),

  /** Get tier product catalog for the current owner */
  getMyTierCatalog: protectedProcedure
    .input(z.object({ species: z.enum(["goat", "sheep", "both"]).optional() }))
    .query(async ({ ctx, input }) => {
      const tier = await getOwnerTierStatus(ctx.user.openId);
      const tierSlug = (tier?.tierSlug ?? "basic") as "basic" | "standard" | "professional";
      return getTierCatalogForOwner(tierSlug, input.species);
    }),

  /** Get tier product catalog for a specific tier */
  getTierCatalog: protectedProcedure
    .input(z.object({
      tierSlug: tierSlugSchema,
      species: z.enum(["goat", "sheep", "both"]).optional(),
    }))
    .query(async ({ input }) => {
      return getTierCatalogForOwner(input.tierSlug, input.species);
    }),

  /** Admin: list all tier catalog items */
  listAllTierCatalog: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    return listAllTierCatalogItems();
  }),

  /** Admin: upsert tier catalog item */
  upsertTierCatalogItem: protectedProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      minTier: tierSlugSchema,
      productType: productTypeSchema,
      label: z.string().min(1).max(160),
      species: z.enum(["goat", "sheep", "both"]).default("both"),
      conversionRatio: z.number().min(0.1).max(100),
      unit: z.string().min(1).max(16).default("л"),
      description: z.string().max(500).optional().nullable(),
      isEnabled: z.boolean().default(true),
      sortOrder: z.number().int().min(0).max(9999).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      return upsertTierCatalogItem(input);
    }),

  /** Admin: delete tier catalog item */
  deleteTierCatalogItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      return deleteTierCatalogItem(input.id);
    }),

  // ═══════════════════════════════════════════════════════════
  //  TIER-BASED PRODUCT PLAN WORKFLOW
  // ═══════════════════════════════════════════════════════════

  /** Initialize tier plan after ownership activation (admin) */
  initializeTierPlan: protectedProcedure
    .input(z.object({
      ownerOpenId: z.string().min(1).max(64),
      animalId: z.number().int().positive(),
      ownershipId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const tierResult = await recomputeOwnerTier(input.ownerOpenId);
      const plan = await createTierBasedProductPlan({
        ownerOpenId: input.ownerOpenId,
        animalId: input.animalId,
        ownershipId: input.ownershipId,
        tierSlug: tierResult.tierStatus.tierSlug as "basic" | "standard" | "professional",
      });
      if (plan) {
        await logPlanChange({
          planId: plan.id,
          animalId: input.animalId,
          ownerOpenId: input.ownerOpenId,
          actorId: "admin",
          action: "created",
          previousStatus: null,
          newStatus: "pending_admin_setup",
          selectionsSnapshot: null,
          note: `Тариф: ${tierResult.tierStatus.tierSlug}. Автоматическое создание при активации владения.`,
        });
      }
      return { plan, tier: tierResult.tierStatus };
    }),

  /** Admin verifies product set → pending_owner_config */
  adminVerifyPlan: protectedProcedure
    .input(z.object({
      planId: z.number().int().positive(),
      selections: z.array(tierSelectionInput).optional(),
      adminNotes: z.string().max(2000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const existingPlan = await getOwnerProductPlanById(input.planId);
      if (!existingPlan) throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
      if (existingPlan.status !== "pending_admin_setup") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "План не ожидает настройки администратором." });
      }
      let selectionsJson = "[]";
      if (input.selections && input.selections.length > 0) {
        const tierSlug = (existingPlan.tierSlug ?? "basic") as "basic" | "standard" | "professional";
        const catalog = await getTierCatalogForOwner(tierSlug);
        const { enrichedSelections } = await calculateTierMilkUsage(catalog, input.selections);
        selectionsJson = JSON.stringify(enrichedSelections);
      }
      const updatedPlan = await adminVerifyProductSet(input.planId, {
        selectionsJson,
        adminNotes: input.adminNotes,
      });
      await logPlanChange({
        planId: input.planId,
        animalId: existingPlan.animalId,
        ownerOpenId: existingPlan.ownerOpenId,
        actorId: "admin",
        action: "admin_verified",
        previousStatus: "pending_admin_setup",
        newStatus: "pending_owner_config",
        selectionsSnapshot: selectionsJson,
        note: input.adminNotes || "Администратор подтвердил набор продуктов",
      });
      const animalName = await getAnimalNameById(existingPlan.animalId);
      notifyOwner({
        title: `Продуктовый план готов к настройке (${animalName})`,
        content: `Администратор подготовил набор продуктов для ${animalName}. Настройте свой план в кабинете.`,
      }).catch(() => {});
      return updatedPlan;
    }),

  /** Owner configures plan → pending_approval */
  ownerConfigurePlan: protectedProcedure
    .input(z.object({
      planId: z.number().int().positive(),
      selections: z.array(tierSelectionInput).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const existingPlan = await getOwnerProductPlanById(input.planId);
      if (!existingPlan) throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
      if (existingPlan.ownerOpenId !== ctx.user.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Это не ваш план." });
      }
      if (existingPlan.status !== "pending_owner_config") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "План не ожидает вашей настройки." });
      }
      // Validate that verified products exist for this animal
      const verifiedOptions = await getVerifiedProductOptions(existingPlan.animalId);
      if (verifiedOptions.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Продукты ещё не настроены администратором. Ожидайте настройки.",
        });
      }
      const tierSlug = (existingPlan.tierSlug ?? "basic") as "basic" | "standard" | "professional";
      const catalog = await getTierCatalogForOwner(tierSlug);
      const { totalMilkUsed: rawMilkUsed, enrichedSelections } = await calculateTierMilkUsage(catalog, input.selections);
      // Round down to avoid floating-point / rounding drift from client annualUnits
      const totalMilkUsed = Math.floor(rawMilkUsed);
      // Validate milk budget (allow 1L tolerance for rounding)
      const profile = await getProductionProfile(existingPlan.animalId);
      if (profile) {
        const sharePercent = await resolveOwnerSharePercent(ctx.user.openId, existingPlan.animalId);
        const ownerMilkBudget = Math.floor((profile.annualMilkLiters * sharePercent) / 100);
        const ROUNDING_TOLERANCE = 1; // 1L tolerance for rounding drift
        if (totalMilkUsed > ownerMilkBudget + ROUNDING_TOLERANCE) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Выбранные продукты требуют ${totalMilkUsed} л молока, но доступно только ${ownerMilkBudget} л (ваша доля ${sharePercent}%).`,
          });
        }
      }
      const updatedPlan = await ownerConfigurePlanDb(input.planId, {
        selectionsJson: JSON.stringify(enrichedSelections),
        totalMilkUsed,
      });
      await logPlanChange({
        planId: input.planId,
        animalId: existingPlan.animalId,
        ownerOpenId: ctx.user.openId,
        actorId: ctx.user.openId,
        action: "owner_configured",
        previousStatus: "pending_owner_config",
        newStatus: "pending_approval",
        selectionsSnapshot: JSON.stringify(enrichedSelections),
        note: "Владелец настроил продуктовый план",
      });
      const animalName = await getAnimalNameById(existingPlan.animalId);
      notifyOwner({
        title: `План настроен: ${ctx.user.name || "владелец"} (${animalName})`,
        content: `Владелец настроил план. Молоко: ${totalMilkUsed} л. Подтвердите в админ-панели.`,
      }).catch(() => {});
      return updatedPlan;
    }),

  /** Admin confirms final plan → confirmed */
  adminApprovePlan: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор может подтверждать планы." });
      }
      const existingPlan = await getOwnerProductPlanById(input.planId);
      if (!existingPlan) throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
      if (existingPlan.status !== "pending_approval") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "План не ожидает подтверждения." });
      }
      const tierSlug = (existingPlan.tierSlug ?? "basic") as "basic" | "standard" | "professional";
      const approvedPlan = await adminConfirmPlan(input.planId, tierSlug);
      await logPlanChange({
        planId: input.planId,
        animalId: existingPlan.animalId,
        ownerOpenId: existingPlan.ownerOpenId,
        actorId: "admin",
        action: "approved",
        previousStatus: "pending_approval",
        newStatus: "confirmed",
        selectionsSnapshot: existingPlan.selectionsJson,
        note: `Подтверждён. Следующее изменение через ${getTierChangeFrequencyDays(tierSlug)} дн.`,
      });
      const enrichedSelections = JSON.parse(existingPlan.selectionsJson);
      const currentYear = new Date().getFullYear();
      await generateDeliverySchedule({
        ownerOpenId: existingPlan.ownerOpenId,
        animalId: existingPlan.animalId,
        ownershipId: existingPlan.ownershipId,
        productPlanId: existingPlan.id,
        selections: enrichedSelections,
        year: currentYear,
      });
      // Notify the owner that their plan was approved
      const animalName = await getAnimalNameById(existingPlan.animalId);
      const animalSlug = await getAnimalSlugById(existingPlan.animalId);
      createUserNotification({
        userOpenId: existingPlan.ownerOpenId,
        type: "productPlanUpdate",
        title: `План подтверждён: ${animalName}`,
        body: `Ваш продуктовый план для ${animalName} подтверждён администратором. График доставок сформирован.`,
        link: `/animals/${animalSlug}`,
      }).catch(() => {});
      return approvedPlan;
    }),

  /** Owner requests plan change (checks tier frequency) */
  requestPlanChange: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existingPlan = await getOwnerProductPlanById(input.planId);
      if (!existingPlan) throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
      if (existingPlan.ownerOpenId !== ctx.user.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Это не ваш план." });
      }
      if (existingPlan.status !== "confirmed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Можно изменить только подтверждённый план." });
      }
      const check = await canOwnerChangePlan(input.planId);
      if (!check.allowed) {
        throw new TRPCError({ code: "BAD_REQUEST", message: check.reason || "Изменение плана пока недоступно." });
      }
      const updatedPlan = await ownerRequestPlanChange(input.planId);
      await logPlanChange({
        planId: input.planId,
        animalId: existingPlan.animalId,
        ownerOpenId: ctx.user.openId,
        actorId: ctx.user.openId,
        action: "reset",
        previousStatus: "confirmed",
        newStatus: "pending_owner_config",
        selectionsSnapshot: existingPlan.selectionsJson,
        note: "Владелец запросил изменение плана",
      });
      // Notify admin that owner requested plan change
      const animalName = await getAnimalNameById(existingPlan.animalId);
      notifyOwner({
        title: `Запрос на изменение плана: ${ctx.user.name || "владелец"} (${animalName})`,
        content: `Владелец запросил изменение продуктового плана для ${animalName}. План переведён в статус ожидания настройки.`,
      }).catch(() => {});
      return updatedPlan;
    }),

  /** Check if owner can change plan */
  canChangePlan: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const plan = await getOwnerProductPlanById(input.planId);
      if (!plan) return { allowed: false, nextChangeAt: null, reason: "План не найден" };
      if (plan.ownerOpenId !== ctx.user.openId && ctx.user.role !== "admin") {
        return { allowed: false, nextChangeAt: null, reason: "Нет доступа" };
      }
      return canOwnerChangePlan(input.planId);
    }),

  /** Admin: list pending plans */
  listPendingPlans: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    return listPendingProductPlans();
  }),

  /** Admin: list all product plans */
  listAllPlans: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    return listAllProductPlans();
  }),

  /** Admin: reset plan back to pending_admin_setup (products need re-configuration) */
  adminResetPlan: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор может сбрасывать планы." });
      }
      const existingPlan = await getOwnerProductPlanById(input.planId);
      if (!existingPlan) throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
      const updatedPlan = await resetPlanToAdminSetup(input.planId, "Сброшен администратором для повторного выбора");
      await deleteDeliverySchedule(existingPlan.ownerOpenId, existingPlan.animalId);
      await logPlanChange({
        planId: input.planId,
        animalId: existingPlan.animalId,
        ownerOpenId: existingPlan.ownerOpenId,
        actorId: "admin",
        action: "reset",
        previousStatus: existingPlan.status,
        newStatus: "pending_admin_setup",
        selectionsSnapshot: existingPlan.selectionsJson,
        note: "Администратор сбросил план для повторного выбора",
      });
      // Notify the owner that their plan was reset
      const animalName = await getAnimalNameById(existingPlan.animalId);
      const animalSlug = await getAnimalSlugById(existingPlan.animalId);
      createUserNotification({
        userOpenId: existingPlan.ownerOpenId,
        type: "productPlanUpdate",
        title: `План сброшен: ${animalName}`,
        body: `Администратор сбросил ваш продуктовый план для ${animalName}. Ожидайте повторной настройки продуктов.`,
        link: `/animals/${animalSlug}`,
      }).catch(() => {});
      return updatedPlan;
    }),

  // ── Admin: Get single plan by ID ──
  getPlanById: protectedProcedure
    .input(z.object({ planId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      return getOwnerProductPlanById(input.planId);
    }),

  // ── Plan Change Log ──
  getPlanChangeLog: protectedProcedure.input(animalIdInput).query(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    // Auto-purge log entries older than 30 days (fire-and-forget)
    purgeOldPlanChangeLogs(30).catch(() => {});
    return listPlanChangeLog(input.animalId);
  }),

  getAllPlanChangeLogs: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    return listAllPlanChangeLogs();
  }),

  // ── Delivery Schedule ──
  getSchedule: protectedProcedure.input(scheduleInput).query(async ({ input }) => {
    return listDeliverySchedule(input.ownerOpenId, input.animalId, input.year);
  }),

  updateDeliveryStatus: protectedProcedure.input(deliveryStatusInput).mutation(async ({ input }) => {
    return updateDeliveryStatus(input.deliveryId, input.status, input.adminNote);
  }),

  // ── Chat ──
  listMessages: protectedProcedure.input(chatListInput).query(async ({ input }) => {
    // Auto-purge messages older than 30 days (fire-and-forget)
    purgeOldChatMessages(30).catch(() => {});
    return listChatMessages(input.animalId, input.ownerOpenId);
  }),

  sendMessage: protectedProcedure.input(chatMessageInput).mutation(async ({ ctx, input }) => {
    const isAdmin = ctx.user.role === "admin";
    const sender = isAdmin ? "admin" as const : "owner" as const;

    let photoUrl: string | null = null;
    let photoKey: string | null = null;

    // Handle photo upload
    if (input.photoBase64 && input.photoMimeType) {
      const buffer = Buffer.from(input.photoBase64, "base64");
      const ext = input.photoFileName?.split(".").pop() ?? "jpg";
      const key = `chat/${input.animalId}/${input.ownerOpenId}/${Date.now()}.${ext}`;
      const result = await storagePut(key, buffer, input.photoMimeType);
      photoUrl = result.url;
      photoKey = result.key;
    }

    if (!input.text && !photoUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Сообщение не может быть пустым." });
    }

    const message = await createChatMessage({
      animalId: input.animalId,
      ownerOpenId: input.ownerOpenId,
      sender,
      text: input.text ?? null,
      photoUrl,
      photoKey,
      isRead: 0,
    });

    // Notify admin when owner sends a message
    if (sender === "owner") {
      const animalName = await getAnimalNameById(input.animalId);
      const ownerName = ctx.user.name ?? "Владелец";
      const preview = input.text
        ? input.text.length > 100 ? input.text.slice(0, 100) + "…" : input.text
        : "📷 Фото";

      // Fire-and-forget: don't block the response on notification delivery
      notifyOwner({
        title: `💬 Новое сообщение от ${ownerName} (${animalName})`,
        content: preview,
      }).catch((err) => {
        console.warn("[Chat Notification] Failed to notify admin:", err);
      });
    }

    return message;
  }),

  markRead: protectedProcedure.input(chatListInput).mutation(async ({ ctx, input }) => {
    const isAdmin = ctx.user.role === "admin";
    await markChatMessagesRead(input.animalId, input.ownerOpenId, isAdmin ? "admin" : "owner");
    return { success: true };
  }),

  unreadCount: protectedProcedure.input(chatListInput).query(async ({ ctx, input }) => {
    const isAdmin = ctx.user.role === "admin";
    return countUnreadChatMessages(input.animalId, input.ownerOpenId, isAdmin ? "admin" : "owner");
  }),

  // ── Admin: All conversations ──
  adminListConversations: protectedProcedure.query(async () => {
    // Auto-purge messages older than 30 days on each listing (fire-and-forget)
    purgeOldChatMessages(30).catch(() => {});
    return listAdminChatConversations();
  }),

  // ── Admin: Clear chat for a specific animal ──
  adminClearChat: protectedProcedure.input(animalIdInput).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    const deleted = await clearChatMessagesByAnimal(input.animalId);
    return { deleted };
  }),

  // ── Admin: Clear plan change log for a specific animal ──
  adminClearLog: protectedProcedure.input(animalIdInput).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    const deleted = await clearPlanChangeLogByAnimal(input.animalId);
    return { deleted };
  }),

  // ── Admin: Manual purge old data ──
  adminPurgeOldData: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    const chatDeleted = await purgeOldChatMessages(30);
    const logDeleted = await purgeOldPlanChangeLogs(30);
    return { chatDeleted, logDeleted };
  }),

  /* ═══════════════════════════════════════════════════════════
     Composition Snapshots — Admin CRUD
     ═══════════════════════════════════════════════════════════ */

  listCompositionSnapshots: protectedProcedure
    .input(z.object({ animalId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const slug = await getAnimalSlugById(input.animalId);
      if (!slug) throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено." });
      return listCompositionSnapshots(slug);
    }),

  createCompositionSnapshot: protectedProcedure
    .input(z.object({
      animalId: z.number().int().positive(),
      label: z.string().min(1).max(120),
      value: z.string().min(1).max(120),
      note: z.string().max(255).default(""),
      sortOrder: z.number().int().min(0).max(9999).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const slug = await getAnimalSlugById(input.animalId);
      if (!slug) throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено." });
      const result = await createCompositionSnapshot({
        animalSlug: slug,
        ownerOpenId: ENV.ownerOpenId,
        label: input.label,
        value: input.value,
        note: input.note,
        sortOrder: input.sortOrder,
      });
      // Notify owners (non-blocking)
      const animalName = await getAnimalNameById(input.animalId);
      notifyOwnersAboutCompositionUpdate({
        animalId: input.animalId,
        animalName,
        animalSlug: slug,
        action: "created",
        detail: `${input.label}: ${input.value}`,
      }).catch((err) => console.error("[Notification] composition create:", err));
      return result;
    }),

  updateCompositionSnapshot: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      animalId: z.number().int().positive(),
      label: z.string().min(1).max(120).optional(),
      value: z.string().min(1).max(120).optional(),
      note: z.string().max(255).optional(),
      sortOrder: z.number().int().min(0).max(9999).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const { id, animalId, ...data } = input;
      const result = await updateCompositionSnapshot(id, data);
      // Notify owners (non-blocking)
      const slug = await getAnimalSlugById(animalId);
      if (slug) {
        const animalName = await getAnimalNameById(animalId);
        const detail = input.label ? `${input.label}${input.value ? ": " + input.value : ""}` : undefined;
        notifyOwnersAboutCompositionUpdate({
          animalId,
          animalName,
          animalSlug: slug,
          action: "updated",
          detail,
        }).catch((err) => console.error("[Notification] composition update:", err));
      }
      return result;
    }),

  deleteCompositionSnapshot: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      animalId: z.number().int().positive(),
      label: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const result = await deleteCompositionSnapshot(input.id);
      // Notify owners (non-blocking)
      const slug = await getAnimalSlugById(input.animalId);
      if (slug) {
        const animalName = await getAnimalNameById(input.animalId);
        notifyOwnersAboutCompositionUpdate({
          animalId: input.animalId,
          animalName,
          animalSlug: slug,
          action: "deleted",
          detail: input.label,
        }).catch((err) => console.error("[Notification] composition delete:", err));
      }
      return result;
    }),

  /* ═══════════════════════════════════════════════════════════
     Monthly Metrics — Admin CRUD
     ═══════════════════════════════════════════════════════════ */

  listMonthlyMetrics: protectedProcedure
    .input(z.object({ animalId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const slug = await getAnimalSlugById(input.animalId);
      if (!slug) throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено." });
      return listMonthlyMetrics(slug);
    }),

  upsertMonthlyMetric: protectedProcedure
    .input(z.object({
      id: z.number().int().positive().optional(),
      animalId: z.number().int().positive(),
      monthLabel: z.string().min(1).max(32),
      milkVolumeLiters: z.number().int().min(0).max(100_000),
      proteinPercentTenth: z.number().int().min(0).max(1000),
      fatPercentTenth: z.number().int().min(0).max(1000),
      sortOrder: z.number().int().min(0).max(9999).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const slug = await getAnimalSlugById(input.animalId);
      if (!slug) throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено." });
      const result = await upsertMonthlyMetric({
        id: input.id,
        animalSlug: slug,
        ownerOpenId: ENV.ownerOpenId,
        monthLabel: input.monthLabel,
        milkVolumeLiters: input.milkVolumeLiters,
        proteinPercentTenth: input.proteinPercentTenth,
        fatPercentTenth: input.fatPercentTenth,
        sortOrder: input.sortOrder,
      });
      // Send notification to animal owners
      const animalName = await getAnimalNameById(input.animalId) ?? slug;
      notifyOwnersAboutMetricsUpdate({
        animalId: input.animalId,
        animalName,
        animalSlug: slug,
        action: input.id ? "updated" : "created",
        detail: `${input.monthLabel}: ${input.milkVolumeLiters} л`,
      }).catch((err) => console.error("[Notification] metrics update error:", err));
      return result;
    }),

  deleteMonthlyMetric: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), animalId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const deleted = await deleteMonthlyMetric(input.id);
      // Send notification to animal owners
      const slug = await getAnimalSlugById(input.animalId);
      if (slug) {
        const animalName = await getAnimalNameById(input.animalId) ?? slug;
        notifyOwnersAboutMetricsUpdate({
          animalId: input.animalId,
          animalName,
          animalSlug: slug,
          action: "deleted",
        }).catch((err) => console.error("[Notification] metrics delete error:", err));
      }
      return deleted;
    }),

  // ═══════════════════════════════════════════════════════════
  //  PRODUCT POPULATION FROM CATALOG & BATCH VERIFICATION
  // ═══════════════════════════════════════════════════════════

  /** Admin: populate animal's product options from tier catalog based on owner's tier and animal species */
  populateProductsFromCatalog: protectedProcedure
    .input(z.object({
      animalId: z.number().int().positive(),
      ownerOpenId: z.string().min(1).max(64),
      animalSpecies: z.enum(["goat", "sheep"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const tier = await getOwnerTierStatus(input.ownerOpenId);
      const tierSlug = (tier?.tierSlug ?? "basic") as "basic" | "standard" | "professional";
      const newItems = await populateAnimalProductsFromCatalog(
        input.animalId,
        tierSlug,
        input.animalSpecies,
      );
      return { created: newItems.length, items: newItems, tierSlug };
    }),

  /** Admin: batch verify product options (with optional per-item updates) */
  batchVerifyProducts: protectedProcedure
    .input(z.object({
      optionIds: z.array(z.number().int().positive()).min(1),
      updates: z.array(z.object({
        optionId: z.number().int().positive(),
        maxAnnualUnits: z.number().int().min(0).max(100_000).optional(),
        isEnabled: z.boolean().optional(),
      })).optional(),
      animalId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
      }
      const result = await adminBatchVerifyProducts(input.optionIds, input.updates);

      // ── Per-product verification notification to all owners ──
      try {
        const [animalName, animalSlug, ownerOpenIds] = await Promise.all([
          getAnimalNameById(input.animalId),
          getAnimalSlugById(input.animalId),
          getActiveOwnerOpenIdsByAnimalId(input.animalId),
        ]);
        const count = input.optionIds.length;
        const word = count === 1 ? "продукт верифицирован" : count >= 2 && count <= 4 ? "продукта верифицированы" : "продуктов верифицированы";
        const title = `${animalName}: ${count} ${word}`;
        const body = `Администратор верифицировал ${count} ${word} для ${animalName}. Проверьте доступные продукты в вашем продуктовом плане.`;
        const link = animalSlug ? `/tracker?animal=${animalSlug}` : "/tracker";

        for (const openId of ownerOpenIds) {
          await createUserNotification({
            userOpenId: openId,
            type: "productPlanUpdate",
            title,
            body,
            link,
          });
        }

        // Also notify admin (owner) about the verification
        await notifyOwner({
          title: `Верификация продуктов: ${animalName}`,
          content: `Верифицировано ${count} продуктов для ${animalName}. Уведомления отправлены ${ownerOpenIds.length} владельцам.`,
        });
      } catch (e) {
        console.error("[batchVerifyProducts] notification error:", e);
      }

      return result;
    }),

  /** Get verified product options for an animal (for owner plan configuration) */
  getVerifiedOptions: protectedProcedure
    .input(animalIdInput)
    .query(async ({ input }) => {
      return getVerifiedProductOptions(input.animalId);
    }),

  /** Check if all products for an animal are verified */
  checkAllVerified: protectedProcedure
    .input(animalIdInput)
    .query(async ({ input }) => {
      return { allVerified: await areAllProductsVerified(input.animalId) };
    }),

  /** Get owner's plan lifecycle status by animal slug (for ProductTracker progress bar) */
  getMyPlanBySlug: protectedProcedure
    .input(z.object({ animalSlug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const animalId = await getAnimalIdBySlug(input.animalSlug);
      if (!animalId) return { plan: null, hasVerifiedProducts: false };
      const [plan, verifiedOptions] = await Promise.all([
        getOwnerProductPlan(ctx.user.openId, animalId),
        getVerifiedProductOptions(animalId),
      ]);
      return {
        plan,
        hasVerifiedProducts: verifiedOptions.length > 0,
      };
    }),
});
