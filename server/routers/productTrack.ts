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
  createOwnerProductPlan,
  adminUpdateOwnerProductPlan,
  generateDeliverySchedule,
  listDeliverySchedule,
  updateDeliveryStatus,
  listChatMessages,
  createChatMessage,
  markChatMessagesRead,
  countUnreadChatMessages,
  listAdminChatConversations,
  getAnimalProductTrackData,
  listOwnerProductPlansByAnimal,
  resolveOwnershipId,
  resolveOwnerSharePercent,
  getAnimalNameById,
  resetOwnerProductPlan,
  deleteDeliverySchedule,
} from "../db";
import type { ProductOption } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { notifyOwner } from "../_core/notification";

/* ── Zod schemas ── */

const productTypeSchema = z.enum(["milk", "smetana", "yogurt", "kefir", "cheese"]);

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

const ownerProductPlanInput = z.object({
  animalId: z.number().int().positive(),
  ownershipId: z.number().int().positive().optional(), // auto-resolved on server if not provided or omitted
  selections: z.array(z.object({
    productOptionId: z.number().int().positive(),
    annualUnits: z.number().min(0).max(100_000),
  })).min(1),
});

const adminUpdatePlanInput = z.object({
  planId: z.number().int().positive(),
  selections: z.array(z.object({
    productOptionId: z.number().int().positive(),
    annualUnits: z.number().min(0).max(100_000),
  })).min(1),
  adminNotes: z.string().max(2000).optional().nullable(),
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

    const milkUsed = sel.annualUnits * option.conversionRatio;
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
        .reduce((sum: number, o: any) => sum + o.maxAnnualUnits * o.conversionRatio, 0);
      const thisOptionMilk = (input.maxAnnualUnits ?? 0) * input.conversionRatio;
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

  // ── Owner: Product Plan ──
  getMyPlan: protectedProcedure.input(animalIdInput).query(async ({ ctx, input }) => {
    return getOwnerProductPlan(ctx.user.openId, input.animalId);
  }),

  confirmPlan: protectedProcedure.input(ownerProductPlanInput).mutation(async ({ ctx, input }) => {
    // Check if owner already has a confirmed plan
    const existing = await getOwnerProductPlan(ctx.user.openId, input.animalId);
    if (existing && existing.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Продуктовый план уже подтверждён. Для изменений обратитесь к администратору фермы." });
    }

    // Auto-resolve ownershipId from the database
    let resolvedOwnershipId = input.ownershipId ?? 0;
    if (!resolvedOwnershipId) {
      const ownership = await resolveOwnershipId(ctx.user.openId, input.animalId);
      if (!ownership) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Не найдено активное владение этим животным." });
      }
      resolvedOwnershipId = ownership;
    }

    // Validate milk budget
    const profile = await getProductionProfile(input.animalId);
    if (!profile) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Производственный профиль животного ещё не настроен." });
    }

    const { totalMilkUsed, enrichedSelections } = await calculateMilkUsage(input.animalId, input.selections);

    // Owner's share of milk = (sharePercent / 100) * annualMilkLiters
    const sharePercent = await resolveOwnerSharePercent(ctx.user.openId, input.animalId);
    const ownerMilkBudget = Math.floor((profile.annualMilkLiters * sharePercent) / 100);

    if (totalMilkUsed > ownerMilkBudget) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Выбранные продукты требуют ${totalMilkUsed} л молока, но доступно только ${ownerMilkBudget} л (ваша доля ${sharePercent}%).` });
    }

    const plan = await createOwnerProductPlan({
      ownerOpenId: ctx.user.openId,
      animalId: input.animalId,
      ownershipId: resolvedOwnershipId,
      selectionsJson: JSON.stringify(enrichedSelections),
      totalMilkUsed,
    });

    if (!plan) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось сохранить продуктовый план." });
    }

    // Auto-generate delivery schedule for current year
    const currentYear = new Date().getFullYear();
    await generateDeliverySchedule({
      ownerOpenId: ctx.user.openId,
      animalId: input.animalId,
      ownershipId: resolvedOwnershipId,
      productPlanId: plan.id,
      selections: enrichedSelections,
      year: currentYear,
    });

    return plan;
  }),

  // ── Admin: Update owner's plan ──
  adminUpdatePlan: protectedProcedure.input(adminUpdatePlanInput).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор может изменять планы." });
    }

    // Get the existing plan to find animalId and ownerOpenId
    const existingPlan = await getOwnerProductPlanById(input.planId);
    if (!existingPlan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
    }

    const { totalMilkUsed, enrichedSelections } = await calculateMilkUsage(
      existingPlan.animalId,
      input.selections,
    );

    // Validate milk budget against owner's share
    const profile = await getProductionProfile(existingPlan.animalId);
    if (profile) {
      const sharePercent = await resolveOwnerSharePercent(existingPlan.ownerOpenId, existingPlan.animalId);
      const ownerMilkBudget = Math.floor((profile.annualMilkLiters * sharePercent) / 100);
      if (totalMilkUsed > ownerMilkBudget) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Выбранные продукты требуют ${totalMilkUsed} л молока, но доступно только ${ownerMilkBudget} л (доля владельца ${sharePercent}%).`,
        });
      }
    }

    // Update the plan
    const updatedPlan = await adminUpdateOwnerProductPlan(input.planId, {
      selectionsJson: JSON.stringify(enrichedSelections),
      totalMilkUsed,
      adminNotes: input.adminNotes,
    });

    // Regenerate delivery schedule with new selections
    const currentYear = new Date().getFullYear();
    await generateDeliverySchedule({
      ownerOpenId: existingPlan.ownerOpenId,
      animalId: existingPlan.animalId,
      ownershipId: existingPlan.ownershipId,
      productPlanId: existingPlan.id,
      selections: enrichedSelections,
      year: currentYear,
    });

    return updatedPlan;
  }),

  // ── Admin: Reset owner's plan to draft ──
  adminResetPlan: protectedProcedure.input(z.object({ planId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор может сбрасывать планы." });
    }

    const existingPlan = await getOwnerProductPlanById(input.planId);
    if (!existingPlan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "План не найден." });
    }

    // Reset plan to draft with empty selections
    const updatedPlan = await resetOwnerProductPlan(input.planId);

    // Delete existing delivery schedule since plan is reset
    await deleteDeliverySchedule(existingPlan.ownerOpenId, existingPlan.animalId);

    return updatedPlan;
  }),

  // ── Admin: Get single plan by ID ──
  getPlanById: protectedProcedure.input(z.object({ planId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Только администратор." });
    }
    return getOwnerProductPlanById(input.planId);
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
    return listAdminChatConversations();
  }),
});
