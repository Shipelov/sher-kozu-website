import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAnimalPhoto,
  deleteAnimalPhoto,
  getClubFeedData,
  getProductTrackerData,
  listAnimalPhotos,
  reorderAnimalPhotos,
  setAnimalPhotoCover,
} from "./db";
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

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

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
});

export type AppRouter = typeof appRouter;
