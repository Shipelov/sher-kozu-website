/**
 * Gamification Router — "Забота" Ecosystem
 * tRPC procedures for token economy, marketplace, wellness, ratings.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  ensureFarmAccounts,
  getFarmAccounts,
  adjustBankBalance,
  grantTokensToOwner,
  bulkGrantTokens,
  refundTokensToOwner,
  getFarmTransactions,
  getOwnerBalance,
  getOwnerTransactions,
  listMarketplaceCategories,
  createMarketplaceCategory,
  updateMarketplaceCategory,
  deleteMarketplaceCategory,
  listMarketplaceItems,
  getMarketplaceItem,
  createMarketplaceItem,
  updateMarketplaceItem,
  deleteMarketplaceItem,
  purchaseMarketplaceItem,
  getAnimalWellness,
  ensureAnimalMetrics,
  applyDailyDecay,
  getHerdLeaderboard,
  getOwnerLeaderboard,
  updateOwnerRating,
  recalculateHerdRanks,
  listFarmerChecklists,
  completeFarmerChecklist,
  getUnreadFeedback,
  getAnimalFeedback,
  markFeedbackRead,
  getAutoAllocationSettings,
  updateAutoAllocationSettings,
  getTokenAnalytics,
  getMarketplaceAnalytics,
  getHerdWellnessOverview,
  getOwnerPurchaseHistory,
  listOwnerWallets,
  backfillWallets,
  freezeWallet,
  unfreezeWallet,
  getWalletStatus,
} from "../gamification";

// ─── Admin guard ─────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор" });
  }
  return next({ ctx });
});

export const gamificationRouter = router({
  // ─── Farm Accounts (Admin) ───────────────────────────
  farmAccounts: router({
    get: adminProcedure.query(async () => {
      return getFarmAccounts();
    }),

    ownerWallets: adminProcedure.query(async () => {
      // Auto-backfill wallets for any users missing them
      await backfillWallets();
      return listOwnerWallets();
    }),

    backfillWallets: adminProcedure.mutation(async () => {
      const created = await backfillWallets();
      return { created };
    }),

    adjustBank: adminProcedure
      .input(z.object({
        newBalanceSKC: z.number().int().min(0).max(10000000),
        memo: z.string().max(500).default("Корректировка баланса Банка"),
      }))
      .mutation(async ({ ctx, input }) => {
        return adjustBankBalance(input.newBalanceSKC, input.memo, ctx.user.openId);
      }),

    grantTokens: adminProcedure
      .input(z.object({
        ownerOpenId: z.string().min(1),
        amountSKC: z.number().int().positive().max(100000),
        memo: z.string().max(500).default("Начисление токенов"),
      }))
      .mutation(async ({ ctx, input }) => {
        return grantTokensToOwner(input.ownerOpenId, input.amountSKC, input.memo, ctx.user.openId);
      }),

    bulkGrant: adminProcedure
      .input(z.object({
        ownerOpenIds: z.array(z.string().min(1)).min(1),
        amountSKC: z.number().int().positive().max(100000),
        memo: z.string().max(500).default("Массовое начисление"),
      }))
      .mutation(async ({ ctx, input }) => {
        return bulkGrantTokens(input.ownerOpenIds, input.amountSKC, input.memo, ctx.user.openId);
      }),

    refund: adminProcedure
      .input(z.object({
        ownerOpenId: z.string().min(1),
        amountSKC: z.number().int().positive(),
        memo: z.string().max(500).default("Возврат токенов"),
      }))
      .mutation(async ({ ctx, input }) => {
        return refundTokensToOwner(input.ownerOpenId, input.amountSKC, input.memo, ctx.user.openId);
      }),

    transactions: adminProcedure
      .input(z.object({
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().min(0).default(0),
        txType: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return getFarmTransactions(input?.limit ?? 50, input?.offset ?? 0, input?.txType);
      }),

    freezeWallet: adminProcedure
      .input(z.object({
        ownerOpenId: z.string().min(1),
        memo: z.string().max(500).default("Блокировка счёта"),
      }))
      .mutation(async ({ ctx, input }) => {
        return freezeWallet(input.ownerOpenId, input.memo, ctx.user.openId);
      }),

    unfreezeWallet: adminProcedure
      .input(z.object({
        ownerOpenId: z.string().min(1),
        memo: z.string().max(500).default("Разблокировка счёта"),
      }))
      .mutation(async ({ ctx, input }) => {
        return unfreezeWallet(input.ownerOpenId, input.memo, ctx.user.openId);
      }),

    walletStatus: adminProcedure
      .input(z.object({ ownerOpenId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getWalletStatus(input.ownerOpenId);
      }),

    autoAllocation: router({
      get: adminProcedure.query(async () => {
        return getAutoAllocationSettings();
      }),
      update: adminProcedure
        .input(z.object({
          isEnabled: z.number().int().min(0).max(1).optional(),
          amountSKC: z.number().int().positive().optional(),
          manualAllocationEnabled: z.number().int().min(0).max(1).optional(),
          dayOfMonth: z.number().int().min(1).max(28).optional(),
        }))
        .mutation(async ({ input }) => {
          return updateAutoAllocationSettings(input);
        }),
    }),
  }),

  // ─── Marketplace Categories (Admin) ──────────────────
  categories: router({
    list: protectedProcedure
      .input(z.object({ includeHidden: z.boolean().default(false) }).optional())
      .query(async ({ ctx, input }) => {
        const includeHidden = ctx.user.role === "admin" && (input?.includeHidden ?? false);
        return listMarketplaceCategories(includeHidden);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(64),
        description: z.string().max(500).optional(),
        emoji: z.string().max(10).optional(),
        sortOrder: z.number().int().default(0),
        isVisible: z.number().int().min(0).max(1).default(1),
      }))
      .mutation(async ({ input }) => {
        return createMarketplaceCategory(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        slug: z.string().min(1).max(64).optional(),
        description: z.string().max(500).optional(),
        emoji: z.string().max(10).optional(),
        sortOrder: z.number().int().optional(),
        isVisible: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateMarketplaceCategory(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        return deleteMarketplaceCategory(input.id);
      }),
  }),

  // ─── Marketplace Items (Admin + Owner) ─────────────
  items: router({
    list: protectedProcedure
      .input(z.object({
        categoryId: z.number().int().positive().optional(),
        includeHidden: z.boolean().default(false),
      }).optional())
      .query(async ({ ctx, input }) => {
        const includeHidden = ctx.user.role === "admin" && (input?.includeHidden ?? false);
        return listMarketplaceItems(input?.categoryId, includeHidden);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getMarketplaceItem(input.id);
      }),

    create: adminProcedure
      .input(z.object({
        categoryId: z.number().int().positive(),
        name: z.string().min(1).max(150),
        slug: z.string().min(1).max(64),
        description: z.string().max(1000).optional(),
        imageUrl: z.string().max(500).optional(),
        priceSKC: z.number().int().positive(),
        stock: z.number().int().default(-1),
        metricEffectsJson: z.string().default("{}"),
        requiresChecklist: z.number().int().min(0).max(1).default(0),
        checklistTemplateJson: z.string().optional(),
        feedbackTemplate: z.string().max(500).optional(),
        season: z.enum(["all", "spring", "summer", "autumn", "winter"]).default("all"),
        applicableSpecies: z.string().max(50).optional(),
        dailyLimitPerOwner: z.number().int().default(0),
        weeklyLimitPerOwner: z.number().int().default(0),
        monthlyLimitPerOwner: z.number().int().default(0),
        sortOrder: z.number().int().default(0),
        isVisible: z.number().int().min(0).max(1).default(1),
      }))
      .mutation(async ({ input }) => {
        return createMarketplaceItem(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        categoryId: z.number().int().positive().optional(),
        name: z.string().min(1).max(150).optional(),
        slug: z.string().min(1).max(64).optional(),
        description: z.string().max(1000).optional(),
        imageUrl: z.string().max(500).optional(),
        priceSKC: z.number().int().positive().optional(),
        stock: z.number().int().optional(),
        metricEffectsJson: z.string().optional(),
        requiresChecklist: z.number().int().min(0).max(1).optional(),
        checklistTemplateJson: z.string().optional(),
        feedbackTemplate: z.string().max(500).optional(),
        season: z.enum(["all", "spring", "summer", "autumn", "winter"]).optional(),
        applicableSpecies: z.string().max(50).optional(),
        dailyLimitPerOwner: z.number().int().optional(),
        weeklyLimitPerOwner: z.number().int().optional(),
        monthlyLimitPerOwner: z.number().int().optional(),
        sortOrder: z.number().int().optional(),
        isVisible: z.number().int().min(0).max(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateMarketplaceItem(id, data);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        return deleteMarketplaceItem(input.id);
      }),
  }),

  // ─── Purchase Flow (Owner) ─────────────────────────
  purchase: protectedProcedure
    .input(z.object({
      animalId: z.number().int().positive(),
      itemId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      return purchaseMarketplaceItem(ctx.user.openId, input.animalId, input.itemId);
    }),

  // ─── Owner Wallet ──────────────────────────────────
  wallet: router({
    balance: protectedProcedure.query(async ({ ctx }) => {
      return getOwnerBalance(ctx.user.openId);
    }),

    transactions: protectedProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        return getOwnerTransactions(ctx.user.openId, input?.limit ?? 20);
      }),

    purchaseHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        return getOwnerPurchaseHistory(ctx.user.openId, input?.limit ?? 20);
      }),
  }),

  // ─── Animal Wellness ───────────────────────────────
  wellness: router({
    get: protectedProcedure
      .input(z.object({ animalId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getAnimalWellness(input.animalId);
      }),

    herdOverview: adminProcedure.query(async () => {
      return getHerdWellnessOverview();
    }),

    triggerDecay: adminProcedure.mutation(async () => {
      await applyDailyDecay();
      return { success: true };
    }),
  }),

  // ─── Leaderboard ───────────────────────────────────
  leaderboard: router({
    herd: protectedProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return getHerdLeaderboard(input?.limit ?? 20);
      }),

    owners: protectedProcedure
      .input(z.object({ limit: z.number().int().positive().max(50).default(20) }).optional())
      .query(async ({ input }) => {
        return getOwnerLeaderboard(input?.limit ?? 20);
      }),

    myRating: protectedProcedure.query(async ({ ctx }) => {
      await updateOwnerRating(ctx.user.openId);
      const db = await import("../gamification");
      // Re-fetch after update
      const { getDb } = await import("../db");
      const dbConn = await getDb();
      if (!dbConn) return null;
      const { ownerRatings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [rating] = await dbConn.select().from(ownerRatings).where(eq(ownerRatings.ownerOpenId, ctx.user.openId));
      return rating ?? null;
    }),
  }),

  // ─── Farmer Checklists (Admin) ─────────────────────
  checklists: router({
    list: adminProcedure
      .input(z.object({ status: z.enum(["pending", "completed", "cancelled"]).optional() }).optional())
      .query(async ({ input }) => {
        return listFarmerChecklists(input?.status);
      }),

    complete: adminProcedure
      .input(z.object({
        checklistId: z.number().int().positive(),
        tasksJson: z.string(),
        farmerNotes: z.string().max(1000).default(""),
        photoUrlsJson: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return completeFarmerChecklist(
          input.checklistId,
          input.tasksJson,
          input.farmerNotes,
          input.photoUrlsJson ?? null,
          ctx.user.openId
        );
      }),
  }),

  // ─── Animal Feedback (Owner) ───────────────────────
  feedback: router({
    unread: protectedProcedure.query(async ({ ctx }) => {
      return getUnreadFeedback(ctx.user.openId);
    }),

    byAnimal: protectedProcedure
      .input(z.object({ animalId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        return getAnimalFeedback(input.animalId, ctx.user.openId);
      }),

    markRead: protectedProcedure
      .input(z.object({ feedbackId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await markFeedbackRead(input.feedbackId);
        return { success: true };
      }),
  }),

  // ─── Analytics (Admin) ─────────────────────────────
  analytics: router({
    tokens: adminProcedure.query(async () => {
      return getTokenAnalytics();
    }),

    marketplace: adminProcedure.query(async () => {
      return getMarketplaceAnalytics();
    }),

    herdWellness: adminProcedure.query(async () => {
      return getHerdWellnessOverview();
    }),
  }),
});
