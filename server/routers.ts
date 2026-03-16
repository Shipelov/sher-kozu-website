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
  createIntegrationAudit,
  createPartnerLead,
  deleteAnimalPhoto,
  deleteClubAdminPreset,
  deleteClubEvent,
  deleteClubMember,
  deleteClubPost,
  getClubFeedData,
  getIntegrationAuditById,
  getPartnerLeadById,
  getProductTrackerData,
  listAnimalPhotos,
  listBitrixAdminData,
  listClubAdminData,
  reorderAnimalPhotos,
  setAnimalPhotoCover,
  updateClubAdminPreset,
  updateClubEvent,
  updateClubMember,
  updateClubPost,
  updateIntegrationAuditResult,
  updatePartnerLeadSyncResult,
} from "./db";
import { notifyOwner } from "./_core/notification";
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
  notes: z.string().max(3000).optional().nullable(),
  attachments: z.array(partnerLeadAttachmentInput).max(3).default([]),
});

const retryPartnerLeadInput = z.object({
  leadId: z.number().int().positive(),
});

const bitrixAdminDashboardInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(50).default(10),
  query: z.string().max(200).default(""),
  syncStatus: z.enum(["all", "pending", "success", "failed", "retried"]).default("all"),
  onlyFailed: z.boolean().default(false),
  source: z.enum(["all", "website", "club", "referral", "manual"]).default("all"),
});

async function notifyBitrixOperationalEvent(args: {
  title: string;
  lines: Array<string | null | undefined>;
}) {
  const content = args.lines.filter(Boolean).join("\n");
  if (!content.trim()) {
    return false;
  }

  return notifyOwner({
    title: args.title,
    content,
  });
}

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({ ctx });
});

async function runBitrixLeadSync(ownerOpenId: string, leadId: number, markAsRetried: boolean) {
  const lead = await getPartnerLeadById(leadId, ownerOpenId);
  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Партнёрская заявка не найдена." });
  }

  const audit = await createIntegrationAudit({
    ownerOpenId,
    integration: "bitrix24",
    entityType: "partnerLead",
    entityId: lead.id,
    operation: markAsRetried ? "retry" : "sync",
    status: "pending",
    requestPayload: JSON.stringify({
      leadId: lead.id,
      email: lead.email,
      companyName: lead.companyName,
      source: lead.source,
    }),
    responsePayload: null,
    errorMessage: null,
    externalId: lead.bitrixDealId ?? null,
  });

  try {
    const attachments = lead.attachmentsJson ? JSON.parse(lead.attachmentsJson) as Array<{
      name: string;
      mimeType: string;
      size: number;
      url: string;
      key?: string;
    }> : [];

    const syncResult = await syncPartnerLeadToBitrix({
      id: lead.id,
      fullName: lead.fullName,
      companyName: lead.companyName,
      email: lead.email,
      phone: lead.phone,
      telegram: lead.telegram,
      region: lead.region,
      source: lead.source as "website" | "club" | "referral" | "manual",
      interestType: lead.interestType as "retail" | "horeca" | "distribution" | "collaboration" | "other",
      preferredContactMethod: lead.preferredContactMethod as "email" | "phone" | "whatsapp" | "telegram" | "any",
      interestProducts: lead.interestProducts,
      notes: lead.notes,
      attachments,
    });

    const updatedLead = await updatePartnerLeadSyncResult({
      id: lead.id,
      ownerOpenId,
      syncStatus: markAsRetried ? "retried" : "success",
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

    if (audit) {
      await updateIntegrationAuditResult({
        id: audit.id,
        ownerOpenId,
        status: "success",
        responsePayload: syncResult.responsePayload,
        errorMessage: null,
        externalId: syncResult.dealId ?? syncResult.contactId ?? null,
      });
    }

    if (markAsRetried) {
      await notifyBitrixOperationalEvent({
        title: `Bitrix24 retry выполнен для заявки #${updatedLead?.id ?? lead.id}`,
        lines: [
          `Заявка: #${updatedLead?.id ?? lead.id} · ${lead.companyName}`,
          `Контакт: ${lead.fullName} · ${lead.email}`,
          `Sync status: ${updatedLead?.syncStatus ?? "retried"}`,
          `Deal ID: ${updatedLead?.bitrixDealId ?? syncResult.dealId ?? "—"}`,
          `Stage ID: ${updatedLead?.bitrixStageId ?? syncResult.stageId ?? "—"}`,
          `Менеджер: ${updatedLead?.assignedManagerName ?? syncResult.assignedManagerName ?? "не назначен"}`,
          `Следующая активность: ${updatedLead?.nextActivityAt ? new Date(updatedLead.nextActivityAt).toLocaleString("ru-RU") : "не запланирована"}`,
          audit ? `Audit ID: ${audit.id}` : null,
        ],
      });
    }

    return {
      lead: updatedLead,
      auditId: audit?.id ?? null,
      syncResult,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить синхронизацию Bitrix24.";

    const updatedLead = await updatePartnerLeadSyncResult({
      id: lead.id,
      ownerOpenId,
      syncStatus: "failed",
      lastSyncError: message,
      bitrixContactId: lead.bitrixContactId,
      bitrixCompanyId: lead.bitrixCompanyId,
      bitrixDealId: lead.bitrixDealId,
      bitrixLeadId: lead.bitrixLeadId,
      bitrixStageId: lead.bitrixStageId,
      assignedManagerId: lead.assignedManagerId,
      assignedManagerName: lead.assignedManagerName,
      nextActivityAt: lead.nextActivityAt,
    });

    if (audit) {
      await updateIntegrationAuditResult({
        id: audit.id,
        ownerOpenId,
        status: "failed",
        responsePayload: null,
        errorMessage: message,
        externalId: lead.bitrixDealId ?? null,
      });
    }

    await notifyBitrixOperationalEvent({
      title: `Bitrix24 sync failed для заявки #${updatedLead?.id ?? lead.id}`,
      lines: [
        `Заявка: #${updatedLead?.id ?? lead.id} · ${lead.companyName}`,
        `Контакт: ${lead.fullName} · ${lead.email}`,
        `Операция: ${markAsRetried ? "retry sync" : "initial sync"}`,
        `Текущий статус: ${updatedLead?.syncStatus ?? "failed"}`,
        `Ошибка: ${message}`,
        `Deal ID: ${updatedLead?.bitrixDealId ?? lead.bitrixDealId ?? "—"}`,
        audit ? `Audit ID: ${audit.id}` : null,
      ],
    });

    return {
      lead: updatedLead,
      auditId: audit?.id ?? null,
      errorMessage: message,
    };
  }
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
  bitrix24: router({
    createPartnerLead: protectedProcedure.input(partnerLeadInput).mutation(async ({ ctx, input }) => {
      const uploadedAttachments = await Promise.all(
        input.attachments.map(async (attachment, index) => {
          const safeName = sanitizeFileName(attachment.name);
          const binary = Buffer.from(attachment.base64, "base64");
          const storageResult = await storagePut(
            `partner-leads/${ctx.user.openId}/${Date.now()}-${index}-${safeName}`,
            binary,
            attachment.mimeType
          );
          return {
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            url: storageResult.url,
            key: storageResult.key,
          };
        })
      );

      const createdLead = await createPartnerLead({
        ownerOpenId: ctx.user.openId,
        fullName: input.fullName,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone ?? null,
        telegram: input.telegram ?? null,
        region: input.region ?? null,
        source: input.source,
        interestType: input.interestType,
        preferredContactMethod: input.preferredContactMethod,
        interestProducts: input.interestProducts ?? null,
        notes: input.notes ?? null,
        attachmentsJson: uploadedAttachments.length ? JSON.stringify(uploadedAttachments) : null,
        syncStatus: "pending",
        syncAttemptCount: 0,
        lastSyncAt: null,
        lastSyncError: null,
        bitrixContactId: null,
        bitrixCompanyId: null,
        bitrixDealId: null,
        bitrixLeadId: null,
        bitrixStageId: null,
        assignedManagerId: null,
        assignedManagerName: null,
        nextActivityAt: null,
      });

      if (!createdLead) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Не удалось создать партнёрскую заявку." });
      }

      const syncOutcome = await runBitrixLeadSync(ctx.user.openId, createdLead.id, false);

      await notifyBitrixOperationalEvent({
        title: `Новая партнёрская заявка #${createdLead.id}`,
        lines: [
          `Компания: ${createdLead.companyName}`,
          `Контакт: ${createdLead.fullName} · ${createdLead.email}`,
          `Источник: ${createdLead.source}`,
          `Интерес: ${createdLead.interestType}`,
          `Предпочтительный контакт: ${createdLead.preferredContactMethod}`,
          `Синхронизация: ${syncOutcome.errorMessage ? `с ошибкой — ${syncOutcome.errorMessage}` : "успешно отправлена в Bitrix24"}`,
          syncOutcome.auditId ? `Audit ID: ${syncOutcome.auditId}` : null,
        ],
      });

      return {
        lead: syncOutcome.lead,
        auditId: syncOutcome.auditId,
        synced: !syncOutcome.errorMessage,
        errorMessage: syncOutcome.errorMessage ?? null,
      } as const;
    }),
    adminDashboard: adminProcedure.input(bitrixAdminDashboardInput).query(async ({ ctx, input }) => {
      return listBitrixAdminData(ctx.user.openId, input);
    }),
    retryLeadSync: adminProcedure.input(retryPartnerLeadInput).mutation(async ({ ctx, input }) => {
      const outcome = await runBitrixLeadSync(ctx.user.openId, input.leadId, true);
      return {
        lead: outcome.lead,
        auditId: outcome.auditId,
        synced: !outcome.errorMessage,
        errorMessage: outcome.errorMessage ?? null,
      } as const;
    }),
    refreshDealSnapshot: adminProcedure.input(retryPartnerLeadInput).mutation(async ({ ctx, input }) => {
      const lead = await getPartnerLeadById(input.leadId, ctx.user.openId);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Партнёрская заявка не найдена." });
      }
      if (!lead.bitrixDealId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "У заявки ещё нет связанной сделки в Bitrix24." });
      }

      const audit = await createIntegrationAudit({
        ownerOpenId: ctx.user.openId,
        integration: "bitrix24",
        entityType: "partnerLead",
        entityId: lead.id,
        operation: "pull",
        status: "pending",
        requestPayload: JSON.stringify({ leadId: lead.id, bitrixDealId: lead.bitrixDealId }),
        responsePayload: null,
        errorMessage: null,
        externalId: lead.bitrixDealId,
      });

      try {
        const snapshot = await pullBitrixDealSnapshot(lead.bitrixDealId);
        const updatedLead = await updatePartnerLeadSyncResult({
          id: lead.id,
          ownerOpenId: ctx.user.openId,
          syncStatus: lead.syncStatus as "pending" | "success" | "failed" | "retried",
          lastSyncError: lead.lastSyncError,
          bitrixContactId: lead.bitrixContactId,
          bitrixCompanyId: lead.bitrixCompanyId,
          bitrixDealId: lead.bitrixDealId,
          bitrixLeadId: lead.bitrixLeadId,
          bitrixStageId: snapshot.stageId,
          assignedManagerId: snapshot.assignedManagerId,
          assignedManagerName: lead.assignedManagerName,
          nextActivityAt: snapshot.nextActivityAt,
        });

        if (audit) {
          await updateIntegrationAuditResult({
            id: audit.id,
            ownerOpenId: ctx.user.openId,
            status: "success",
            responsePayload: snapshot.responsePayload,
            errorMessage: null,
            externalId: lead.bitrixDealId,
          });
        }

        await notifyBitrixOperationalEvent({
          title: `Bitrix24 snapshot обновлён для заявки #${updatedLead?.id ?? lead.id}`,
          lines: [
            `Заявка: #${updatedLead?.id ?? lead.id} · ${lead.companyName}`,
            `Deal ID: ${lead.bitrixDealId}`,
            `Stage ID: ${snapshot.stageId ?? "—"}`,
            `Следующая активность: ${snapshot.nextActivityAt ? new Date(snapshot.nextActivityAt).toLocaleString("ru-RU") : "не запланирована"}`,
            audit ? `Audit ID: ${audit.id}` : null,
          ],
        });

        return {
          lead: updatedLead,
          auditId: audit?.id ?? null,
        } as const;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось обновить снимок сделки Bitrix24.";

        if (audit) {
          await updateIntegrationAuditResult({
            id: audit.id,
            ownerOpenId: ctx.user.openId,
            status: "failed",
            responsePayload: null,
            errorMessage: message,
            externalId: lead.bitrixDealId,
          });
        }

        await notifyBitrixOperationalEvent({
          title: `Bitrix24 snapshot failed для заявки #${lead.id}`,
          lines: [
            `Заявка: #${lead.id} · ${lead.companyName}`,
            `Deal ID: ${lead.bitrixDealId}`,
            `Ошибка: ${message}`,
            audit ? `Audit ID: ${audit.id}` : null,
          ],
        });

        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    auditById: adminProcedure.input(idInput).query(async ({ ctx, input }) => {
      const audit = await getIntegrationAuditById(input.id, ctx.user.openId);
      if (!audit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Запись аудита интеграции не найдена." });
      }
      return audit;
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
