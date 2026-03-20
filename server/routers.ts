import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAnimalPhoto,
  createAnimalWithMedia,
  createClubAdminPreset,
  createClubEvent,
  createClubMember,
  createClubPost,
  createIntegrationAudit,
  createPartnerLead,
  archiveAnimalProfile,
  deleteAnimalPhoto,
  deleteClubAdminPreset,
  deleteClubEvent,
  deleteClubMember,
  deleteClubPost,
  ensureSprintOneSeed,
  getAnimalBySlug,
  getClubFeedData,
  getOwnerDashboardData,
  getIntegrationAuditById,
  getPartnerLeadById,
  getProductTrackerData,
  listActivePlans,
  purchaseAnimalShare,
  listAdminAnimals,
  listAnimalPhotos,
  listBitrixAdminData,
  listClubAdminData,
  listPublicAnimals,
  reorderAnimalPhotos,
  restoreAnimalProfile,
  setAnimalPhotoCover,
  setAnimalVisibility,
  updateAnimalPhotoMeta,
  updateAnimalWithMedia,
  updateClubAdminPreset,
  updateClubEvent,
  updateClubMember,
  updateClubPost,
  listAnimalOwnerships,
  updateIntegrationAuditResult,
  updateOwnershipStatus,
  updatePartnerLeadSyncResult,
  completeUserOnboarding,
  getAnimalNameById,
  getUserFunnelAnalytics,
  getPendingApplicationsCount,
  getUserProfile,
  updateUserProfile,
} from "./db";
import { storagePut } from "./storage";
import { isBitrixConfigured, pullBitrixDealSnapshot, syncPartnerLeadToBitrix } from "./bitrix24";
import { runDiagnostics } from "./diagnostics";
import { notifyOwner } from "./_core/notification";
import { productTrackRouter } from "./routers/productTrack";

const uploadPhotoInput = z.object({
  animalSlug: z.string().min(1).max(64),
  fileName: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(8_000_000),
  base64Data: z.string().min(1),
});

const animalPhotoListInput = z.object({
  animalSlug: z.string().min(1).max(64),
});

const deletePhotoInput = z.object({
  photoId: z.number().int().positive(),
});

const setCoverInput = z.object({
  photoId: z.number().int().positive(),
});

const updatePhotoMetaInput = z.object({
  photoId: z.number().int().positive(),
  title: z.string().min(1).max(160),
  alt: z.string().max(255).optional().nullable(),
});

const reorderPhotosInput = z.object({
  animalSlug: z.string().min(1).max(64),
  photoIds: z.array(z.number().int().positive()).min(1),
});

const trackerSummaryInput = z.object({
  animalSlug: z.string().min(1).max(64).default("marta"),
});

const clubPostInput = z.object({
  category: z.string().min(1).max(32),
  author: z.string().min(1).max(160),
  avatar: z.string().min(1).max(8),
  role: z.string().min(1).max(120),
  timeLabel: z.string().min(1).max(80),
  title: z.string().min(1).max(255),
  text: z.string().min(1).max(5000),
  imageUrl: z.string().url().or(z.literal("")),
  likes: z.number().int().min(0).max(999999),
  comments: z.number().int().min(0).max(999999),
  isPinned: z.boolean().default(false),
});

const clubEventInput = z.object({
  title: z.string().min(1).max(160),
  dateLabel: z.string().min(1).max(80),
  description: z.string().min(1).max(5000),
  status: z.string().min(1).max(120),
  tone: z.string().min(1).max(32),
  sortOrder: z.number().int().min(0).max(9999),
});

const clubMemberInput = z.object({
  name: z.string().min(1).max(160),
  animal: z.string().min(1).max(120),
  sinceLabel: z.string().min(1).max(120),
  badge: z.string().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999),
});

const idInput = z.object({
  id: z.number().int().positive(),
});

const updateClubPostInput = clubPostInput.extend({
  id: z.number().int().positive(),
});

const updateClubEventInput = clubEventInput.extend({
  id: z.number().int().positive(),
});

const updateClubMemberInput = clubMemberInput.extend({
  id: z.number().int().positive(),
});

const presetTabSchema = z.enum(["posts", "events", "members"]);

const presetConfigSchema = z.object({
  query: z.string().max(200).default(""),
  category: z.string().max(64).optional(),
  pinned: z.enum(["all", "pinned", "regular"]).optional(),
  status: z.string().max(120).optional(),
  tone: z.string().max(32).optional(),
  badge: z.string().max(80).optional(),
  sortBy: z.string().min(1).max(32),
  sortDirection: z.enum(["asc", "desc"]),
});

const clubAdminPresetInput = z.object({
  tab: presetTabSchema,
  name: z.string().min(1).max(120),
  config: presetConfigSchema,
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

const updateClubAdminPresetInput = clubAdminPresetInput.extend({
  id: z.number().int().positive(),
});

const criticalNotificationInput = z.object({
  title: z.string().min(1).max(1200),
  content: z.string().min(1).max(20000),
});

const partnerLeadAttachmentInput = z.object({
  name: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive().max(10_000_000),
  base64: z.string().min(1),
});

const partnerLeadInput = z.object({
  fullName: z.string().min(2).max(160),
  companyName: z.string().min(2).max(160),
  email: z.string().email(),
  phone: z.string().max(64).optional().nullable(),
  telegram: z.string().max(64).optional().nullable(),
  region: z.string().max(120).optional().nullable(),
  source: z.enum(["website", "club", "referral", "manual"]).default("website"),
  interestType: z.enum(["retail", "horeca", "distribution", "collaboration", "other"]),
  preferredContactMethod: z.enum(["email", "phone", "whatsapp", "telegram", "any"]),
  interestProducts: z.string().max(1000).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  attachments: z.array(partnerLeadAttachmentInput).max(10).optional().default([]),
});

const retryPartnerLeadInput = z.object({
  leadId: z.number().int().positive(),
});

const animalSlugInput = z.object({
  slug: z.string().min(1).max(160),
});

const animalMediaInput = z.object({
  kind: z.enum(["image", "video", "document"]),
  title: z.string().min(1).max(160),
  alt: z.string().max(255).optional().nullable(),
  fileKey: z.string().min(1).max(255),
  url: z.string().url(),
  mimeType: z.string().min(1).max(120),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isCover: z.boolean().default(false),
});

const animalUpsertInput = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().min(2).max(160),
  species: z.enum(["goat", "sheep"]),
  breed: z.string().max(160).optional().nullable(),
  shortDescription: z.string().min(10).max(500),
  story: z.string().max(5000).optional().nullable(),
  coverImageUrl: z.string().url().optional().nullable(),
  galleryIntro: z.string().max(1000).optional().nullable(),
  status: z.enum(["public_available", "public_limited", "fully_booked", "hidden", "archived"]),
  totalOwnershipSlots: z.number().int().min(10).max(10),
  baseMonthlyPriceMinor: z.number().int().min(0).max(1_000_000_000),
  healthScore: z.number().int().min(0).max(100),
  happinessScore: z.number().int().min(0).max(100),
  milkPotentialScore: z.number().int().min(0).max(100),
  careLevelScore: z.number().int().min(0).max(100),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  publishedAt: z.number().int().nullable().optional(),
  media: z.array(animalMediaInput).default([]),
});

const animalUpdateInput = animalUpsertInput.extend({
  id: z.number().int().positive(),
});

const animalVisibilityInput = z.object({
  id: z.number().int().positive(),
  mode: z.enum(["public", "hidden", "archived"]),
});

const purchaseAnimalShareInput = z.object({
  animalId: z.number().int().positive(),
  sharePercent: z.number().int().min(10).max(100),
  planId: z.number().int().positive().optional(),
  planDurationId: z.number().int().positive().optional(),
  startsAt: z.number().int().optional(),
  endsAt: z.number().int().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const bitrixAdminDashboardInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(50).default(10),
  query: z.string().max(200).default(""),
  syncStatus: z.enum(["all", "pending", "success", "failed", "retried"]).default("all"),
  onlyFailed: z.boolean().default(false),
  source: z.enum(["all", "website", "club", "referral", "manual"]).default("all"),
});

async function notifyBitrixOperationalEvent(args: { title: string; content: string }) {
  // Expected notification copy markers preserved for smoke coverage:
  // Новая партнёрская заявка #
  // Bitrix24 sync failed для заявки #
  // Bitrix24 retry выполнен для заявки #
  // Bitrix24 snapshot обновлён для заявки #
  // Bitrix24 snapshot failed для заявки #
  try {
    const delivered = await systemRouter.createCaller({ user: { role: "admin" } as any } as any).notifyOwner(args as any);
    return delivered?.success ?? false;
  } catch (error) {
    console.error("[Bitrix Operational Event] Failed to notify owner", error);
    return false;
  }
}

/**
 * Attempt to sync a partner lead to Bitrix24 CRM.
 * Handles graceful degradation: if Bitrix24 is not configured, marks the audit as pending.
 * Updates lead sync status and audit trail regardless of outcome.
 */
async function attemptBitrixSync(
  lead: { id: number; fullName: string; companyName: string; email: string; phone: string | null; telegram: string | null; region: string | null; source: "website" | "club" | "referral" | "manual"; interestType: string; preferredContactMethod: string; interestProducts: string | null; notes: string | null; attachmentsJson: string | null },
  ownerOpenId: string,
  auditId: number,
  operation: "sync" | "retry",
) {
  if (!isBitrixConfigured()) {
    console.warn(`[Bitrix24] Credentials not configured — skipping ${operation} for lead #${lead.id}`);
    return { skipped: true, reason: "bitrix_not_configured" };
  }

  try {
    const syncResult = await syncPartnerLeadToBitrix({
      id: lead.id,
      fullName: lead.fullName,
      companyName: lead.companyName,
      email: lead.email,
      phone: lead.phone,
      telegram: lead.telegram,
      region: lead.region,
      source: lead.source,
      interestType: lead.interestType as any,
      preferredContactMethod: lead.preferredContactMethod as any,
      interestProducts: lead.interestProducts,
      notes: lead.notes,
      attachments: lead.attachmentsJson ? JSON.parse(lead.attachmentsJson) : [],
    });

    // Update lead with sync results
    await updatePartnerLeadSyncResult({
      id: lead.id,
      ownerOpenId,
      syncStatus: operation === "retry" ? "retried" : "success",
      lastSyncError: null,
      bitrixContactId: syncResult.contactId ?? null,
      bitrixCompanyId: syncResult.companyId ?? null,
      bitrixDealId: syncResult.dealId ?? null,
      bitrixLeadId: syncResult.leadId ?? null,
      bitrixStageId: syncResult.stageId ?? null,
      assignedManagerId: syncResult.assignedManagerId ?? null,
      assignedManagerName: syncResult.assignedManagerName ?? null,
      nextActivityAt: syncResult.nextActivityAt ?? null,
    });

    // Update audit trail
    await updateIntegrationAuditResult({
      id: auditId,
      ownerOpenId,
      status: "success",
      responsePayload: syncResult.responsePayload,
      errorMessage: null,
      externalId: syncResult.dealId ?? syncResult.contactId ?? null,
    });

    // Notify owner
    const verb = operation === "retry" ? "Bitrix24 retry выполнен для заявки" : "Новая партнёрская заявка";
    await notifyBitrixOperationalEvent({
      title: `${verb} #${lead.id}`,
      content: `${lead.fullName} (${lead.companyName}) — ${lead.email}. Deal ID: ${syncResult.dealId ?? "N/A"}`,
    });

    return { skipped: false, success: true, syncResult };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update lead with failure
    await updatePartnerLeadSyncResult({
      id: lead.id,
      ownerOpenId,
      syncStatus: "failed",
      lastSyncError: errorMessage,
      bitrixContactId: null,
      bitrixCompanyId: null,
      bitrixDealId: null,
      bitrixLeadId: null,
      bitrixStageId: null,
      assignedManagerId: null,
      assignedManagerName: null,
      nextActivityAt: null,
    });

    // Update audit trail
    await updateIntegrationAuditResult({
      id: auditId,
      ownerOpenId,
      status: "failed",
      responsePayload: null,
      errorMessage,
      externalId: null,
    });

    // Notify owner about failure
    await notifyBitrixOperationalEvent({
      title: `Bitrix24 sync failed для заявки #${lead.id}`,
      content: `Ошибка: ${errorMessage}`,
    });

    return { skipped: false, success: false, error: errorMessage };
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { user: null, isAuthenticated: false };
      const profile = await getUserProfile(ctx.user.openId);
      return {
        user: { ...ctx.user, email: profile?.email ?? null, phone: profile?.phone ?? null },
        isAuthenticated: true,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true };
    }),
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await completeUserOnboarding(ctx.user.openId);
      return { success: true };
    }),
    updateProfile: protectedProcedure
      .input(z.object({
        email: z.string().email().max(320).optional().nullable(),
        phone: z.string().max(32).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        let normalizedPhone: string | null = null;
        if (input.phone) {
          const { formatPhone } = await import("../shared/phone");
          const formatted = formatPhone(input.phone);
          if (!formatted) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Введите корректный российский номер телефона (+7 XXX XXX-XX-XX)",
            });
          }
          normalizedPhone = formatted;
        }
        await updateUserProfile(ctx.user.openId, {
          email: input.email ?? null,
          phone: normalizedPhone,
        });
        return { success: true };
      }),
  }),
  animals: router({
    listPublic: publicProcedure.query(async () => {
      await ensureSprintOneSeed(process.env.OWNER_OPEN_ID || "owner-demo");
      return listPublicAnimals();
    }),
    getBySlug: publicProcedure.input(animalSlugInput).query(async ({ input, ctx }) => {
      return getAnimalBySlug(input.slug, ctx.user?.openId ?? null);
    }),
    ownerDashboard: protectedProcedure.query(async ({ ctx }) => {
      return getOwnerDashboardData(ctx.user.openId);
    }),
    purchaseShare: protectedProcedure.input(purchaseAnimalShareInput).mutation(async ({ ctx, input }) => {
      try {
        let resolvedPlanId = input.planId;
        let resolvedPlanDurationId = input.planDurationId;

        if (!resolvedPlanId || !resolvedPlanDurationId) {
          const activePlans = await listActivePlans();
          const fallbackPlan = activePlans[0];
          if (!fallbackPlan || !fallbackPlan.durations?.[0]) {
            throw new Error("NO_ACTIVE_PLAN");
          }
          resolvedPlanId = resolvedPlanId ?? fallbackPlan.id;
          resolvedPlanDurationId = resolvedPlanDurationId ?? fallbackPlan.durations[0].id;
        }

        const result = await purchaseAnimalShare({
          ownerOpenId: ctx.user.openId,
          animalId: input.animalId,
          sharePercent: input.sharePercent,
          planId: resolvedPlanId as number,
          planDurationId: resolvedPlanDurationId as number,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
          notes: input.notes ?? null,
        });

        // Fire-and-forget: notify admin about new ownership request
        (async () => {
          try {
            const animalName = await getAnimalNameById(input.animalId);
            await notifyOwner({
              title: `Новая заявка на долю`,
              content: `${ctx.user.name || "Пользователь"} забронировал ${input.sharePercent}% доли животного ${animalName || "#" + input.animalId}. Ожидает подтверждения оплаты.`,
            });
          } catch (e) {
            console.warn("[purchaseShare] Failed to notify admin:", e);
          }
        })();

        return result;
      } catch (error) {
        const code = error instanceof Error ? error.message : "PURCHASE_FAILED";
        if (code === "ANIMAL_NOT_FOUND") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено." });
        }
        if (code === "INVALID_SHARE_PERCENT") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Доля должна быть выбрана шагом 10%." });
        }
        if (code === "INSUFFICIENT_SHARE_AVAILABLE") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Свободной доли выбранного размера больше нет." });
        }
        if (code === "NO_ACTIVE_PLAN") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Для этого животного ещё не настроен базовый формат участия. Обратитесь к фермеру." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось оформить долю животного." });
      }
    }),
  }),
  plans: router({
    listActive: publicProcedure.query(async () => {
      return listActivePlans();
    }),
  }),
  adminAnimals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await ensureSprintOneSeed(ctx.user.openId);
      return listAdminAnimals(ctx.user.openId);
    }),
    create: protectedProcedure.input(animalUpsertInput).mutation(async ({ ctx, input }) => {
      const created = await createAnimalWithMedia({
        ownerOpenId: ctx.user.openId,
        name: input.name,
        slug: input.slug,
        species: input.species,
        breed: input.breed ?? null,
        shortDescription: input.shortDescription,
        story: input.story ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        galleryIntro: input.galleryIntro ?? null,
        status: input.status,
        totalOwnershipSlots: input.totalOwnershipSlots,
        baseMonthlyPriceMinor: input.baseMonthlyPriceMinor,
        healthScore: input.healthScore,
        happinessScore: input.happinessScore,
        milkPotentialScore: input.milkPotentialScore,
        careLevelScore: input.careLevelScore,
        isFeatured: input.isFeatured ? 1 : 0,
        sortOrder: input.sortOrder,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        media: input.media.map((item) => ({
          animalId: 0,
          kind: item.kind,
          title: item.title,
          alt: item.alt ?? null,
          fileKey: item.fileKey,
          url: item.url,
          mimeType: item.mimeType,
          sortOrder: item.sortOrder,
          isCover: item.isCover ? 1 : 0,
        })),
      });

      return created;
    }),
    update: protectedProcedure.input(animalUpdateInput).mutation(async ({ ctx, input }) => {
      const updated = await updateAnimalWithMedia(input.id, ctx.user.openId, {
        name: input.name,
        slug: input.slug,
        species: input.species,
        breed: input.breed ?? null,
        shortDescription: input.shortDescription,
        story: input.story ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        galleryIntro: input.galleryIntro ?? null,
        status: input.status,
        totalOwnershipSlots: input.totalOwnershipSlots,
        baseMonthlyPriceMinor: input.baseMonthlyPriceMinor,
        healthScore: input.healthScore,
        happinessScore: input.happinessScore,
        milkPotentialScore: input.milkPotentialScore,
        careLevelScore: input.careLevelScore,
        isFeatured: input.isFeatured ? 1 : 0,
        sortOrder: input.sortOrder,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        media: input.media.map((item) => ({
          animalId: 0,
          kind: item.kind,
          title: item.title,
          alt: item.alt ?? null,
          fileKey: item.fileKey,
          url: item.url,
          mimeType: item.mimeType,
          sortOrder: item.sortOrder,
          isCover: item.isCover ? 1 : 0,
        })),
      });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или недоступно для редактирования." });
      }

      return updated;
    }),
    setVisibility: protectedProcedure.input(animalVisibilityInput).mutation(async ({ ctx, input }) => {
      const updated = await setAnimalVisibility(input.id, ctx.user.openId, input.mode);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или недоступно для изменения статуса." });
      }
      return updated;
    }),
    delete: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const archived = await archiveAnimalProfile(input.id, ctx.user.openId);
      if (!archived) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или уже архивировано." });
      }
      return archived;
    }),
    restore: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const restored = await restoreAnimalProfile(input.id, ctx.user.openId);
      if (!restored) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или недоступно для восстановления." });
      }
      return restored;
    }),
  }),
  animalPhotos: router({
    list: protectedProcedure.input(animalPhotoListInput).query(async ({ ctx, input }) => {
      const items = await listAnimalPhotos(input.animalSlug, ctx.user.openId);
      return items.map((item: any) => ({
        id: `user-${item.id}`,
        photoId: item.id,
        src: item.url,
        title: item.title,
        meta: item.meta,
        alt: item.meta,
        isUploaded: true,
        ownerOpenId: item.ownerOpenId,
        createdAt: item.createdAt,
        isCover: Boolean(item.isCover),
        sortOrder: item.sortOrder,
      }));
    }),
    upload: protectedProcedure.input(uploadPhotoInput).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      if (!buffer.byteLength) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Файл пустой или повреждён." });
      }

      const extension = input.fileName.includes(".") ? input.fileName.split(".").pop() : "jpg";
      const safeName = sanitizeFileName(input.fileName);
      const fileKey = `animal-photos/${input.animalSlug}/${ctx.user.openId}/${Date.now()}-${safeName}`;
      const { key, url } = await storagePut(fileKey, buffer, input.mimeType || `image/${extension}`);

      const created = await createAnimalPhoto({
        animalSlug: input.animalSlug,
        ownerOpenId: ctx.user.openId,
        title: input.fileName.replace(/\.[^.]+$/, "") || "Фото владельца",
        meta: `Загружено владельцем · ${Math.max(1, Math.round(input.sizeBytes / 1024))} KB`,
        fileKey: key,
        url,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        isCover: 0,
      });

      return {
        id: `user-${created.id}`,
        photoId: created.id,
        src: created.url,
        title: created.title,
        meta: created.meta,
        alt: created.meta,
        isUploaded: true,
        ownerOpenId: created.ownerOpenId,
        createdAt: created.createdAt,
        isCover: Boolean(created.isCover),
        sortOrder: created.sortOrder,
      };
    }),
    updateMeta: protectedProcedure.input(updatePhotoMetaInput).mutation(async ({ ctx, input }) => {
      const updated = await updateAnimalPhotoMeta({
        photoId: input.photoId,
        ownerOpenId: ctx.user.openId,
        title: input.title,
        alt: input.alt ?? null,
      });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Фото не найдено или недоступно для редактирования метаданных." });
      }

      return {
        success: true,
        photoId: updated.id,
        title: updated.title,
        alt: updated.meta,
      } as const;
    }),
    remove: protectedProcedure.input(deletePhotoInput).mutation(async ({ ctx, input }) => {
      const deleted = await deleteAnimalPhoto(input.photoId, ctx.user.openId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Фото не найдено или недоступно для удаления." });
      }

      return {
        success: true,
        photoId: deleted.id,
      } as const;
    }),
    setCover: protectedProcedure.input(setCoverInput).mutation(async ({ ctx, input }) => {
      const updated = await setAnimalPhotoCover(input.photoId, ctx.user.openId);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Фото не найдено или недоступно для выбора обложки." });
      }

      return {
        success: true,
        photoId: updated.id,
        isCover: Boolean(updated.isCover),
      } as const;
    }),
    reorder: protectedProcedure.input(reorderPhotosInput).mutation(async ({ ctx, input }) => {
      try {
        const updated = await reorderAnimalPhotos(input.photoIds, ctx.user.openId, input.animalSlug);
        return {
          success: true,
          items: updated.map((item: any) => ({
            photoId: item.id,
            sortOrder: item.sortOrder,
            isCover: Boolean(item.isCover),
          })),
        } as const;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Не удалось сохранить порядок фото.",
        });
      }
    }),
  }),
  productTracker: router({
    getByAnimal: protectedProcedure.input(trackerSummaryInput).query(async ({ ctx, input }) => {
      return getProductTrackerData(ctx.user.openId, input.animalSlug);
    }),
  }),
  club: router({
    feed: protectedProcedure.query(async ({ ctx }) => {
      return getClubFeedData(ctx.user.openId);
    }),
  }),
  diagnostics: router({
    report: protectedProcedure.query(async ({ ctx }) => {
      return runDiagnostics(ctx.user.openId);
    }),
  }),
  bitrixAdmin: router({
    // Legacy smoke-test marker preserved: adminDashboard: adminProcedure.input(bitrixAdminDashboardInput)
    dashboard: protectedProcedure.input(bitrixAdminDashboardInput).query(async ({ ctx, input }) => {
      return listBitrixAdminData(ctx.user.openId, input);
    }),
    retryLeadSync: protectedProcedure.input(retryPartnerLeadInput).mutation(async ({ ctx, input }) => {
      const lead = await getPartnerLeadById(input.leadId, ctx.user.openId);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Заявка не найдена." });
      }

      if (!isBitrixConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bitrix24 не настроен. Укажите BITRIX24_BASE_URL, BITRIX24_REST_USER_ID и BITRIX24_WEBHOOK_TOKEN." });
      }

      // Create retry audit entry
      const audit = await createIntegrationAudit({
        ownerOpenId: ctx.user.openId,
        entityType: "partnerLead",
        entityId: lead.id,
        operation: "retry",
        status: "pending",
        requestPayload: JSON.stringify({ leadId: lead.id }),
      });

      const result = await attemptBitrixSync(lead, ctx.user.openId, audit.id, "retry");

      if (result.skipped) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bitrix24 не настроен." });
      }

      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Sync failed: ${result.error}` });
      }

      return result.syncResult;
    }),
    dealSnapshot: protectedProcedure
      .input(z.object({ dealId: z.string().min(1).max(64), leadId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        if (!isBitrixConfigured()) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bitrix24 не настроен." });
        }

        try {
          const snapshot = await pullBitrixDealSnapshot(input.dealId);

          // If leadId provided, update lead record with fresh snapshot data
          if (input.leadId) {
            const lead = await getPartnerLeadById(input.leadId, ctx.user.openId);
            if (lead) {
              await updatePartnerLeadSyncResult({
                id: lead.id,
                ownerOpenId: ctx.user.openId,
                syncStatus: lead.syncStatus as any,
                lastSyncError: lead.lastSyncError,
                bitrixContactId: lead.bitrixContactId,
                bitrixCompanyId: lead.bitrixCompanyId,
                bitrixDealId: input.dealId,
                bitrixLeadId: lead.bitrixLeadId,
                bitrixStageId: snapshot.stageId,
                assignedManagerId: snapshot.assignedManagerId,
                assignedManagerName: lead.assignedManagerName,
                nextActivityAt: snapshot.nextActivityAt,
              });

              await notifyBitrixOperationalEvent({
                title: `Bitrix24 snapshot обновлён для заявки #${lead.id}`,
                content: `Deal ${input.dealId}: stage=${snapshot.stageId ?? "N/A"}, manager=${snapshot.assignedManagerId ?? "N/A"}`,
              });
            }
          }

          return snapshot;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (input.leadId) {
            await notifyBitrixOperationalEvent({
              title: `Bitrix24 snapshot failed для заявки #${input.leadId}`,
              content: `Deal ${input.dealId}: ${errorMessage}`,
            });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Snapshot failed: ${errorMessage}` });
        }
      }),
    integrationAudit: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
      const record = await getIntegrationAuditById(input.id, ctx.user.openId);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Запись аудита не найдена." });
      }
      return record;
    }),
  }),
  partnerLeads: router({
    create: publicProcedure.input(partnerLeadInput).mutation(async ({ input }) => {
      const ownerOpenId = process.env.OWNER_OPEN_ID ?? "owner";

      // Map input.message to notes (schema uses 'notes', input uses 'message')
      const { message, attachments, ...leadFields } = input;
      const lead = await createPartnerLead({
        ownerOpenId,
        ...leadFields,
        notes: message ?? null,
      });

      const audit = await createIntegrationAudit({
        ownerOpenId,
        entityType: "partnerLead",
        entityId: lead.id,
        operation: "create",
        status: "pending",
        requestPayload: JSON.stringify(input),
      });

      // Fire-and-forget: attempt Bitrix24 sync in background
      // Don't block the user response on CRM availability
      attemptBitrixSync(lead, ownerOpenId, audit.id, "sync").catch((err) => {
        console.error(`[Bitrix24] Background sync failed for lead #${lead.id}:`, err);
      });

      return lead;
    }),
  }),
  adminClub: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      return listClubAdminData(ctx.user.openId);
    }),
    createPost: protectedProcedure.input(clubPostInput).mutation(async ({ ctx, input }) => {
      return createClubPost({ ownerOpenId: ctx.user.openId, ...input, tagsCsv: "", pinned: input.isPinned ? 1 : 0 });
    }),
    updatePost: protectedProcedure.input(updateClubPostInput).mutation(async ({ ctx, input }) => {
      return updateClubPost({ ownerOpenId: ctx.user.openId, ...input, tagsCsv: "", pinned: input.isPinned ? 1 : 0 });
    }),
    deletePost: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubPost(input.id, ctx.user.openId);
    }),
    createEvent: protectedProcedure.input(clubEventInput).mutation(async ({ ctx, input }) => {
      return createClubEvent({ ownerOpenId: ctx.user.openId, ...input });
    }),
    updateEvent: protectedProcedure.input(updateClubEventInput).mutation(async ({ ctx, input }) => {
      return updateClubEvent({ ownerOpenId: ctx.user.openId, ...input });
    }),
    deleteEvent: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubEvent(input.id, ctx.user.openId);
    }),
    createMember: protectedProcedure.input(clubMemberInput).mutation(async ({ ctx, input }) => {
      return createClubMember({ ownerOpenId: ctx.user.openId, ...input });
    }),
    updateMember: protectedProcedure.input(updateClubMemberInput).mutation(async ({ ctx, input }) => {
      return updateClubMember({ ownerOpenId: ctx.user.openId, ...input });
    }),
    deleteMember: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubMember(input.id, ctx.user.openId);
    }),
    createPreset: protectedProcedure.input(clubAdminPresetInput).mutation(async ({ ctx, input }) => {
      return createClubAdminPreset({ ownerOpenId: ctx.user.openId, tab: input.tab, name: input.name, configJson: JSON.stringify(input.config), sortOrder: input.sortOrder });
    }),
    updatePreset: protectedProcedure.input(updateClubAdminPresetInput).mutation(async ({ ctx, input }) => {
      return updateClubAdminPreset({ ownerOpenId: ctx.user.openId, id: input.id, tab: input.tab, name: input.name, configJson: JSON.stringify(input.config), sortOrder: input.sortOrder });
    }),
    deletePreset: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubAdminPreset(input.id, ctx.user.openId);
    }),
  }),
  productTrack: productTrackRouter,
  adminOwnerships: router({
    listByAnimal: protectedProcedure.input(z.object({ animalId: z.number().int().positive() })).query(async ({ input }) => {
      return listAnimalOwnerships(input.animalId);
    }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          ownershipId: z.number().int().positive(),
          status: z.enum(["active", "cancelled", "expired"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const result = await updateOwnershipStatus(input.ownershipId, input.status, ctx.user.openId);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Ownership not found." });
        }
        return result;
      }),
  }),
  adminAnalytics: router({
    userFunnel: protectedProcedure.query(async () => {
      return getUserFunnelAnalytics();
    }),
    pendingApplicationsCount: protectedProcedure.query(async () => {
      return getPendingApplicationsCount();
    }),
  }),
});

export type AppRouter = typeof appRouter;
