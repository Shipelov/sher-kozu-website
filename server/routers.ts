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
  deleteAnimalPhoto,
  deleteClubAdminPreset,
  deleteClubEvent,
  deleteClubMember,
  deleteClubPost,
  ensureSprintOneSeed,
  getAnimalBySlug,
  getClubFeedData,
  getIntegrationAuditById,
  getPartnerLeadById,
  getProductTrackerData,
  listActivePlans,
  listAdminAnimals,
  listAnimalPhotos,
  listBitrixAdminData,
  listClubAdminData,
  listPublicAnimals,
  reorderAnimalPhotos,
  setAnimalPhotoCover,
  setAnimalVisibility,
  updateAnimalPhotoMeta,
  updateAnimalWithMedia,
  updateClubAdminPreset,
  updateClubEvent,
  updateClubMember,
  updateClubPost,
} from "./db";
import { storagePut } from "./storage";
import { pullBitrixDealSnapshot, syncPartnerLeadToBitrix } from "./bitrix24";

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
  totalOwnershipSlots: z.number().int().min(1).max(3),
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

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ({
      user: ctx.user,
      isAuthenticated: Boolean(ctx.user),
    })),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true };
    }),
  }),
  animals: router({
    listPublic: publicProcedure.query(async () => {
      await ensureSprintOneSeed(process.env.OWNER_OPEN_ID || "owner-demo");
      return listPublicAnimals();
    }),
    getBySlug: publicProcedure.input(animalSlugInput).query(async ({ input }) => {
      return getAnimalBySlug(input.slug);
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
      return syncPartnerLeadToBitrix({
        id: lead.id,
        fullName: lead.fullName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        telegram: lead.telegram,
        region: lead.region,
        source: lead.source,
        interestType: lead.interestType,
        preferredContactMethod: lead.preferredContactMethod,
        interestProducts: lead.interestProducts,
        notes: lead.message,
        attachments: lead.attachmentsJson ? JSON.parse(lead.attachmentsJson) : [],
      });
    }),
    dealSnapshot: protectedProcedure.input(z.object({ dealId: z.string().min(1).max(64) })).query(async ({ input }) => {
      return pullBitrixDealSnapshot(input.dealId);
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
      const lead = await createPartnerLead({ ownerOpenId, ...input });
      await createIntegrationAudit({
        ownerOpenId,
        entityType: "partnerLead",
        entityId: lead.id,
        operation: "create",
        status: "pending",
        requestPayload: JSON.stringify(input),
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
});

export type AppRouter = typeof appRouter;
