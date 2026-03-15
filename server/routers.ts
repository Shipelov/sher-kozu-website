import { COOKIE_NAME, NOT_ADMIN_ERR_MSG } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAnimalPhoto,
  createClubAdminPreset,
  createClubEvent,
  createClubMember,
  createClubPost,
  deleteAnimalPhoto,
  deleteClubAdminPreset,
  deleteClubEvent,
  deleteClubMember,
  deleteClubPost,
  getClubFeedData,
  getProductTrackerData,
  listAnimalPhotos,
  listClubAdminData,
  reorderAnimalPhotos,
  setAnimalPhotoCover,
  updateClubAdminPreset,
  updateClubEvent,
  updateClubMember,
  updateClubPost,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";

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
  tagsCsv: z.string().max(255),
  pinned: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
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

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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
        isUploaded: true,
        ownerOpenId: created.ownerOpenId,
        createdAt: created.createdAt,
        isCover: Boolean(created.isCover),
        sortOrder: created.sortOrder,
      };
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
    summary: protectedProcedure.input(trackerSummaryInput).query(async ({ ctx, input }) => {
      return getProductTrackerData(ctx.user.openId, input.animalSlug);
    }),
  }),
  club: router({
    feed: protectedProcedure.query(async ({ ctx }) => {
      return getClubFeedData(ctx.user.openId);
    }),
  }),
  adminClub: router({
    dashboard: adminProcedure.query(async ({ ctx }) => {
      return listClubAdminData(ctx.user.openId);
    }),
    createPost: adminProcedure.input(clubPostInput).mutation(async ({ ctx, input }) => {
      return createClubPost({ ...input, ownerOpenId: ctx.user.openId, pinned: input.pinned ? 1 : 0 });
    }),
    updatePost: adminProcedure.input(updateClubPostInput).mutation(async ({ ctx, input }) => {
      return updateClubPost({ ...input, ownerOpenId: ctx.user.openId, pinned: input.pinned ? 1 : 0 });
    }),
    deletePost: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const deleted = await deleteClubPost(input.id, ctx.user.openId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден." });
      }
      return { success: true, id: input.id } as const;
    }),
    createEvent: adminProcedure.input(clubEventInput).mutation(async ({ ctx, input }) => {
      return createClubEvent({ ...input, ownerOpenId: ctx.user.openId });
    }),
    updateEvent: adminProcedure.input(updateClubEventInput).mutation(async ({ ctx, input }) => {
      return updateClubEvent({ ...input, ownerOpenId: ctx.user.openId });
    }),
    deleteEvent: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const deleted = await deleteClubEvent(input.id, ctx.user.openId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Событие не найдено." });
      }
      return { success: true, id: input.id } as const;
    }),
    createMember: adminProcedure.input(clubMemberInput).mutation(async ({ ctx, input }) => {
      return createClubMember({ ...input, ownerOpenId: ctx.user.openId });
    }),
    updateMember: adminProcedure.input(updateClubMemberInput).mutation(async ({ ctx, input }) => {
      return updateClubMember({ ...input, ownerOpenId: ctx.user.openId });
    }),
    deleteMember: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const deleted = await deleteClubMember(input.id, ctx.user.openId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Участник не найден." });
      }
      return { success: true, id: input.id } as const;
    }),
    createPreset: adminProcedure.input(clubAdminPresetInput).mutation(async ({ ctx, input }) => {
      return createClubAdminPreset({
        ownerOpenId: ctx.user.openId,
        tab: input.tab,
        name: input.name,
        configJson: JSON.stringify(input.config),
        sortOrder: input.sortOrder,
      });
    }),
    updatePreset: adminProcedure.input(updateClubAdminPresetInput).mutation(async ({ ctx, input }) => {
      return updateClubAdminPreset({
        id: input.id,
        ownerOpenId: ctx.user.openId,
        tab: input.tab,
        name: input.name,
        configJson: JSON.stringify(input.config),
        sortOrder: input.sortOrder,
      });
    }),
    deletePreset: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const deleted = await deleteClubAdminPreset(input.id, ctx.user.openId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Пресет не найден." });
      }
      return { success: true, id: input.id } as const;
    }),
    notifyCriticalAction: adminProcedure.input(criticalNotificationInput).mutation(async ({ input }) => {
      const delivered = await notifyOwner({
        title: input.title,
        content: input.content,
      });

      return {
        delivered,
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
