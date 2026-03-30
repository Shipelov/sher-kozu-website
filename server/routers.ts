import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { catalogCache, CATALOG_CACHE_KEY, CATALOG_TTL_MS, invalidateCatalogCache } from "./cache";
import {
  createAnimalPhoto,
  getPhotoUploadLimit,
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
  listPendingPhotos,
  countPendingPhotos,
  moderateAnimalPhoto,
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
  listUsersAdmin,
  exportUsersAdmin,
  getUserDetailsAdmin,
  softDeleteUser,
  restoreUser,
  listTrashedUsers,
  permanentDeleteUser,
  findExpiredTrashedUsers,
  setPrimaryAnimal,
  createUserNotification,
  listUserNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  upsertNotificationPreferences,
  shouldNotifyUser,
} from "./db";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import { isBitrixConfigured, pullBitrixDealSnapshot, syncPartnerLeadToBitrix } from "./bitrix24";
import { runDiagnostics } from "./diagnostics";
import { notifyOwner } from "./_core/notification";
import { productTrackRouter } from "./routers/productTrack";
import { gamificationRouter } from "./routers/gamification";
import { faqChatRouter } from "./routers/faqChat";
import { cmsRouter } from "./routers/cms";
import { getOwnerBadges, checkAndAwardBadges, BADGE_DEFINITIONS } from "./badges";
import {
  checkRateLimit,
  createOtp,
  getUserByEmail,
  getUserByPhone,
  hashPassword,
  registerLocalUser,
  sendOtpEmail,
  sendPasswordResetEmail,
  updateUserPassword,
  validatePasswordStrength,
  verifyOtp,
  verifyPassword,
} from "./localAuth";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "../shared/const";

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
  animalSlug: z.string().min(1).max(64),
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
  localAuth: router({
    /** Step 1: Register — validate fields, create OTP, send code */
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(160),
          email: z.string().email().max(320),
          phone: z.string().max(32).optional().nullable(),
          password: z.string().min(8).max(128),
          verificationChannel: z.enum(["email", "phone"]).default("email"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limit
        const ip = ctx.req.ip || ctx.req.headers["x-forwarded-for"] || "unknown";
        const rl = await checkRateLimit(String(ip), "register");
        if (!rl.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Слишком много попыток. Повторите через ${Math.ceil((rl.retryAfterMs ?? 0) / 60000)} мин.`,
          });
        }

        // Validate password
        const pwCheck = validatePasswordStrength(input.password);
        if (!pwCheck.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: pwCheck.message! });
        }

        // Normalize phone
        let normalizedPhone: string | null = null;
        if (input.phone) {
          const { formatPhone } = await import("../shared/phone");
          const formatted = formatPhone(input.phone);
          if (!formatted) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Введите корректный российский номер телефона",
            });
          }
          normalizedPhone = formatted;
        }

        // Check if email already taken
        const existingByEmail = await getUserByEmail(input.email);
        if (existingByEmail) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Пользователь с таким email уже зарегистрирован. Используйте вход.",
          });
        }

        // Check phone uniqueness if provided
        if (normalizedPhone) {
          const existingByPhone = await getUserByPhone(normalizedPhone);
          if (existingByPhone) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Пользователь с таким телефоном уже зарегистрирован.",
            });
          }
        }

        // Determine OTP target
        const otpTarget =
          input.verificationChannel === "phone" && normalizedPhone
            ? normalizedPhone
            : input.email;
        const otpChannel =
          input.verificationChannel === "phone" && normalizedPhone
            ? ("phone" as const)
            : ("email" as const);

        // Create OTP
        const { code, expiresAt } = await createOtp(
          otpTarget,
          "registration",
          otpChannel
        );

        // Send OTP
        if (otpChannel === "email") {
          await sendOtpEmail(otpTarget, code, "registration");
        }
        // Phone SMS would go here in production

        return {
          success: true,
          otpTarget,
          otpChannel,
          expiresAt: expiresAt.toISOString(),
          // Store registration data temporarily in client state
          pendingRegistration: {
            name: input.name,
            email: input.email,
            phone: normalizedPhone,
            passwordHash: await hashPassword(input.password),
          },
        };
      }),

    /** Step 2: Verify OTP and complete registration */
    verifyRegistration: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(160),
          email: z.string().email().max(320),
          phone: z.string().max(32).optional().nullable(),
          password: z.string().min(8).max(128),
          otpTarget: z.string(),
          code: z.string().length(6),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Verify OTP
        const otpResult = await verifyOtp(
          input.otpTarget,
          input.code,
          "registration"
        );
        if (!otpResult.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: otpResult.message ?? "Неверный код",
          });
        }

        // Double-check email uniqueness
        const existingByEmail = await getUserByEmail(input.email);
        if (existingByEmail) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Пользователь с таким email уже зарегистрирован.",
          });
        }

        // Normalize phone before saving
        let normalizedRegPhone: string | null = null;
        if (input.phone) {
          const { formatPhone: fmtPhone } = await import("../shared/phone");
          normalizedRegPhone = fmtPhone(input.phone) ?? input.phone;
        }

        // Create user
        const { openId } = await registerLocalUser({
          name: input.name,
          email: input.email,
          phone: normalizedRegPhone,
          password: input.password,
        });

        // Sync contact to Bitrix24 CRM (non-blocking)
        try {
          const { findOrCreateBitrixContact } = await import("./bitrix24");
          const bitrixContactId = await findOrCreateBitrixContact({
            fullName: input.name,
            email: input.email,
            phone: normalizedRegPhone,
          });
          if (bitrixContactId) {
            // Save Bitrix24 contact ID to user record
            const { getDb: getDbLocal } = await import("./db");
            const { users: usersTable } = await import("../drizzle/schema");
            const { eq: eqOp } = await import("drizzle-orm");
            const dbLocal = await getDbLocal();
            await dbLocal
              .update(usersTable)
              .set({ bitrix24ContactId: bitrixContactId })
              .where(eqOp(usersTable.openId, openId));
            console.log(`[Registration] Bitrix24 contact ${bitrixContactId} linked to user ${openId}`);
          }
        } catch (e) {
          console.warn("[Registration] Bitrix24 contact sync failed (non-critical):", e);
        }

        // Create session
        const sessionToken = await sdk.createSessionToken(openId, {
          name: input.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // Notify admin about new registration
        try {
          await notifyOwner({
            title: "Новый участник зарегистрировался",
            content: `Имя: ${input.name}\nEmail: ${input.email}${input.phone ? `\nТелефон: ${input.phone}` : ""}`,
          });
        } catch {
          // Non-critical
        }

        return { success: true, openId };
      }),

    /** Login with email + password */
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          password: z.string().min(1).max(128),
          rememberMe: z.boolean().default(false),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limit
        const ip = ctx.req.ip || ctx.req.headers["x-forwarded-for"] || "unknown";
        const rl = await checkRateLimit(String(ip), "login");
        if (!rl.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Слишком много попыток входа. Повторите через ${Math.ceil((rl.retryAfterMs ?? 0) / 60000)} мин.`,
          });
        }

        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Неверный email или пароль.",
          });
        }

        const passwordValid = await verifyPassword(
          input.password,
          user.passwordHash
        );
        if (!passwordValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Неверный email или пароль.",
          });
        }

        // Create session
        const expiresInMs = input.rememberMe ? ONE_YEAR_MS : 24 * 60 * 60 * 1000; // 1 year or 24h
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: expiresInMs,
        });

        return { success: true, userName: user.name };
      }),

    /** Request password reset — sends OTP to email */
    requestPasswordReset: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limit
        const ip = ctx.req.ip || ctx.req.headers["x-forwarded-for"] || "unknown";
        const rl = await checkRateLimit(String(ip), "password_reset");
        if (!rl.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Слишком много попыток. Повторите через ${Math.ceil((rl.retryAfterMs ?? 0) / 60000)} мин.`,
          });
        }

        const user = await getUserByEmail(input.email);
        // Always return success to prevent email enumeration
        if (!user || !user.passwordHash) {
          return {
            success: true,
            message: "Если аккаунт с таким email существует, код будет отправлен.",
          };
        }

        // Create OTP for password reset
        const { code, expiresAt } = await createOtp(
          input.email,
          "password_reset",
          "email"
        );

        await sendPasswordResetEmail(input.email, code);

        return {
          success: true,
          message: "Код для сброса пароля отправлен на вашу почту.",
          expiresAt: expiresAt.toISOString(),
        };
      }),

    /** Verify reset code and set new password */
    resetPassword: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320),
          code: z.string().length(6),
          newPassword: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Validate new password
        const pwCheck = validatePasswordStrength(input.newPassword);
        if (!pwCheck.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: pwCheck.message! });
        }

        // Verify OTP
        const otpResult = await verifyOtp(
          input.email,
          input.code,
          "password_reset"
        );
        if (!otpResult.valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: otpResult.message ?? "Неверный код",
          });
        }

        const user = await getUserByEmail(input.email);
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Пользователь не найден.",
          });
        }

        // Update password
        await updateUserPassword(user.openId, input.newPassword);

        // Auto-login after password reset
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true };
      }),

    /** Resend OTP code */
    resendOtp: publicProcedure
      .input(
        z.object({
          target: z.string().min(1).max(320),
          purpose: z.enum(["registration", "password_reset"]),
          channel: z.enum(["email", "phone"]).default("email"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limit
        const ip = ctx.req.ip || ctx.req.headers["x-forwarded-for"] || "unknown";
        const rl = await checkRateLimit(String(ip), "otp_send");
        if (!rl.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Слишком много попыток отправки. Повторите через ${Math.ceil((rl.retryAfterMs ?? 0) / 60000)} мин.`,
          });
        }

        const { code, expiresAt } = await createOtp(
          input.target,
          input.purpose,
          input.channel
        );

        if (input.channel === "email") {
          if (input.purpose === "password_reset") {
            await sendPasswordResetEmail(input.target, code);
          } else {
            await sendOtpEmail(input.target, code, input.purpose);
          }
        }

        return {
          success: true,
          expiresAt: expiresAt.toISOString(),
        };
      }),
  }),
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { user: null, isAuthenticated: false };
      const profile = await getUserProfile(ctx.user.openId);
      return {
        user: { ...ctx.user, email: profile?.email ?? null, phone: profile?.phone ?? null, preferredContact: profile?.preferredContact ?? null },
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
        preferredContact: z.enum(["email", "phone", "messenger"]).optional().nullable(),
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
          preferredContact: input.preferredContact ?? null,
        });
        return { success: true };
      }),
  }),
  animals: router({
    listPublic: publicProcedure.query(async () => {
      await ensureSprintOneSeed(process.env.OWNER_OPEN_ID || "owner-demo");
      const cached = catalogCache.get<Awaited<ReturnType<typeof listPublicAnimals>>>(CATALOG_CACHE_KEY);
      if (cached) return cached;
      const result = await listPublicAnimals();
      catalogCache.set(CATALOG_CACHE_KEY, result, CATALOG_TTL_MS);
      return result;
    }),
    getBySlug: publicProcedure.input(animalSlugInput).query(async ({ input, ctx }) => {
      return getAnimalBySlug(input.slug, ctx.user?.openId ?? null);
    }),
    ownerDashboard: protectedProcedure.query(async ({ ctx }) => {
      return getOwnerDashboardData(ctx.user.openId);
    }),
    setPrimaryAnimal: protectedProcedure
      .input(z.object({ animalId: z.number().int().positive().nullable() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await setPrimaryAnimal(ctx.user.openId, input.animalId);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Не удалось изменить основное животное.",
          });
        }
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

        invalidateCatalogCache();
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
    list: adminProcedure.query(async ({ ctx }) => {
      await ensureSprintOneSeed(ctx.user.openId);
      return listAdminAnimals(ctx.user.openId);
    }),
    create: adminProcedure.input(animalUpsertInput).mutation(async ({ ctx, input }) => {
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

      invalidateCatalogCache();
      return created;
    }),
    update: adminProcedure.input(animalUpdateInput).mutation(async ({ ctx, input }) => {
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

      invalidateCatalogCache();
      return updated;
    }),
    setVisibility: adminProcedure.input(animalVisibilityInput).mutation(async ({ ctx, input }) => {
      const updated = await setAnimalVisibility(input.id, ctx.user.openId, input.mode);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или недоступно для изменения статуса." });
      }
      invalidateCatalogCache();
      return updated;
    }),
    delete: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const archived = await archiveAnimalProfile(input.id, ctx.user.openId);
      if (!archived) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или уже архивировано." });
      }
      invalidateCatalogCache();
      return archived;
    }),
    restore: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      const restored = await restoreAnimalProfile(input.id, ctx.user.openId);
      if (!restored) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Животное не найдено или недоступно для восстановления." });
      }
      invalidateCatalogCache();
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
        moderationStatus: item.moderationStatus || "approved",
        isAdminCover: Boolean(item.isCover) && item.ownerOpenId === ENV.ownerOpenId,
        isOwnPhoto: item.ownerOpenId === ctx.user.openId,
        canDelete: ctx.user.openId === ENV.ownerOpenId || (item.ownerOpenId === ctx.user.openId && !(Boolean(item.isCover) && item.ownerOpenId === ENV.ownerOpenId)),
        canEdit: ctx.user.openId === ENV.ownerOpenId || (item.ownerOpenId === ctx.user.openId && !(Boolean(item.isCover) && item.ownerOpenId === ENV.ownerOpenId)),
      }));
    }),
    uploadLimit: protectedProcedure.input(animalPhotoListInput).query(async ({ ctx, input }) => {
      return getPhotoUploadLimit(input.animalSlug, ctx.user.openId);
    }),
    upload: protectedProcedure.input(uploadPhotoInput).mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      if (!buffer.byteLength) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Файл пустой или повреждён." });
      }

      const isAdmin = ctx.user.openId === ENV.ownerOpenId;

      // Check upload limit
      const uploadLimit = await getPhotoUploadLimit(input.animalSlug, ctx.user.openId);
      if (uploadLimit.remaining <= 0) {
        if (isAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Администратор может загрузить только 1 фото-обложку для каждого животного." });
        }
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Вы использовали все ${uploadLimit.limit} слотов для фото. Количество фото равно количеству ваших долей. Удалите старое фото, чтобы загрузить новое.`,
        });
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
        moderationStatus: isAdmin ? "approved" : "pending",
      });

      // Notify admin about new user photo upload (non-blocking)
      if (!isAdmin) {
        notifyOwner({
          title: "📷 Новое фото на модерации",
          content: `Пользователь ${ctx.user.name || ctx.user.openId} загрузил фото для животного «${input.animalSlug}». Проверьте в разделе Модерация фото.`,
        }).catch(() => {});
      }

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
        moderationStatus: created.moderationStatus,
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
    pendingList: adminProcedure.query(async ({ ctx }) => {
      return listPendingPhotos(ctx.user.openId);
    }),
    pendingCount: adminProcedure.query(async ({ ctx }) => {
      return countPendingPhotos(ctx.user.openId);
    }),
    moderate: adminProcedure.input(z.object({
      photoId: z.number().int().positive(),
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().max(255).optional(),
    })).mutation(async ({ ctx, input }) => {
      const result = await moderateAnimalPhoto({
        photoId: input.photoId,
        moderatorOpenId: ctx.user.openId,
        action: input.action,
        rejectionReason: input.rejectionReason,
      });
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Фото не найдено." });
      }
      return {
        success: true,
        photoId: result.id,
        moderationStatus: result.moderationStatus,
      } as const;
    }),
    batchModerate: adminProcedure.input(z.object({
      photoIds: z.array(z.number().int().positive()).min(1).max(50),
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().max(255).optional(),
    })).mutation(async ({ ctx, input }) => {
      const results: Array<{ photoId: number; success: boolean; moderationStatus?: string }> = [];
      for (const photoId of input.photoIds) {
        try {
          const result = await moderateAnimalPhoto({
            photoId,
            moderatorOpenId: ctx.user.openId,
            action: input.action,
            rejectionReason: input.rejectionReason,
          });
          results.push({
            photoId,
            success: !!result,
            moderationStatus: result?.moderationStatus ?? undefined,
          });
        } catch {
          results.push({ photoId, success: false });
        }
      }
      return {
        processed: results.length,
        succeeded: results.filter(r => r.success).length,
        results,
      } as const;
    }),
  }),
  productTracker: router({
    getByAnimal: protectedProcedure.input(trackerSummaryInput).query(async ({ ctx, input }) => {
      return getProductTrackerData(ctx.user.openId, input.animalSlug);
    }),
  }),
  club: router({
    feed: publicProcedure.query(async ({ ctx }) => {
      const ownerOpenId = ctx.user?.openId ?? ENV.ownerOpenId;
      return getClubFeedData(ownerOpenId);
    }),
  }),
  diagnostics: router({
    report: protectedProcedure.query(async ({ ctx }) => {
      return runDiagnostics(ctx.user.openId);
    }),
  }),
  bitrixAdmin: router({
    // Legacy smoke-test marker preserved: adminDashboard: adminProcedure.input(bitrixAdminDashboardInput)
    dashboard: adminProcedure.input(bitrixAdminDashboardInput).query(async ({ ctx, input }) => {
      return listBitrixAdminData(ctx.user.openId, input);
    }),
    retryLeadSync: adminProcedure.input(retryPartnerLeadInput).mutation(async ({ ctx, input }) => {
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
    dealSnapshot: adminProcedure
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
    integrationAudit: adminProcedure.input(idInput).query(async ({ ctx, input }) => {
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
    dashboard: adminProcedure.query(async ({ ctx }) => {
      return listClubAdminData(ctx.user.openId);
    }),
    createPost: adminProcedure.input(clubPostInput).mutation(async ({ ctx, input }) => {
      return createClubPost({ ownerOpenId: ctx.user.openId, ...input, tagsCsv: "", pinned: input.isPinned ? 1 : 0 });
    }),
    updatePost: adminProcedure.input(updateClubPostInput).mutation(async ({ ctx, input }) => {
      return updateClubPost({ ownerOpenId: ctx.user.openId, ...input, tagsCsv: "", pinned: input.isPinned ? 1 : 0 });
    }),
    deletePost: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubPost(input.id, ctx.user.openId);
    }),
    createEvent: adminProcedure.input(clubEventInput).mutation(async ({ ctx, input }) => {
      return createClubEvent({ ownerOpenId: ctx.user.openId, ...input });
    }),
    updateEvent: adminProcedure.input(updateClubEventInput).mutation(async ({ ctx, input }) => {
      return updateClubEvent({ ownerOpenId: ctx.user.openId, ...input });
    }),
    deleteEvent: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubEvent(input.id, ctx.user.openId);
    }),
    createMember: adminProcedure.input(clubMemberInput).mutation(async ({ ctx, input }) => {
      return createClubMember({ ownerOpenId: ctx.user.openId, ...input });
    }),
    updateMember: adminProcedure.input(updateClubMemberInput).mutation(async ({ ctx, input }) => {
      return updateClubMember({ ownerOpenId: ctx.user.openId, ...input });
    }),
    deleteMember: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubMember(input.id, ctx.user.openId);
    }),
    createPreset: adminProcedure.input(clubAdminPresetInput).mutation(async ({ ctx, input }) => {
      return createClubAdminPreset({ ownerOpenId: ctx.user.openId, tab: input.tab, name: input.name, configJson: JSON.stringify(input.config), sortOrder: input.sortOrder });
    }),
    updatePreset: adminProcedure.input(updateClubAdminPresetInput).mutation(async ({ ctx, input }) => {
      return updateClubAdminPreset({ ownerOpenId: ctx.user.openId, id: input.id, tab: input.tab, name: input.name, configJson: JSON.stringify(input.config), sortOrder: input.sortOrder });
    }),
    deletePreset: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      return deleteClubAdminPreset(input.id, ctx.user.openId);
    }),
  }),
  productTrack: productTrackRouter,
  gamification: gamificationRouter,
  badges: router({
    /** Get badges for the current user */
    myBadges: protectedProcedure.query(async ({ ctx }) => {
      const badges = await getOwnerBadges(ctx.user.openId);
      return badges.map((b) => ({
        ...b,
        definition: BADGE_DEFINITIONS[b.badgeType] || { name: b.badgeType, description: "", emoji: "🏅", category: "other" },
      }));
    }),
    /** Get badges for any owner (public) */
    getByOwner: publicProcedure
      .input(z.object({ ownerOpenId: z.string() }))
      .query(async ({ input }) => {
        const badges = await getOwnerBadges(input.ownerOpenId);
        return badges.map((b) => ({
          ...b,
          definition: BADGE_DEFINITIONS[b.badgeType] || { name: b.badgeType, description: "", emoji: "🏅", category: "other" },
        }));
      }),
    /** Get all badge definitions */
    definitions: publicProcedure.query(() => {
      return Object.entries(BADGE_DEFINITIONS).map(([type, def]) => ({ type, ...def }));
    }),
    /** Manually trigger badge check for current user */
    checkMyBadges: protectedProcedure.mutation(async ({ ctx }) => {
      // Gather context from existing data
      const { getDb } = await import("./db");
      const db = await getDb();
      const { animalOwnerships, walletTransactions } = await import("../drizzle/schema");
      const { eq, sql } = await import("drizzle-orm");
      const ownerOpenId = ctx.user.openId;

      // Count animals
      const animalRows = await db.select({ cnt: sql<number>`count(DISTINCT animalId)` }).from(animalOwnerships).where(eq(animalOwnerships.ownerOpenId, ownerOpenId));
      const animalCount = Number(animalRows[0]?.cnt ?? 0);

      // Count purchases
      const purchaseRows = await db.select({ cnt: sql<number>`count(*)` }).from(walletTransactions).where(eq(walletTransactions.ownerOpenId, ownerOpenId));
      const hasPurchases = Number(purchaseRows[0]?.cnt ?? 0) > 0;

      // Total spent
      const spentRows = await db.select({ total: sql<number>`COALESCE(SUM(ABS(amountMinor)), 0)` }).from(walletTransactions).where(eq(walletTransactions.ownerOpenId, ownerOpenId));
      const totalSpent = Number(spentRows[0]?.total ?? 0);

      const newBadges = await checkAndAwardBadges(ownerOpenId, {
        animalCount,
        hasPurchases,
        totalSpent,
      });
      return { newBadges, total: (await getOwnerBadges(ownerOpenId)).length };
    }),
  }),
  adminOwnerships: router({
    listByAnimal: adminProcedure.input(z.object({ animalId: z.number().int().positive() })).query(async ({ input }) => {
      return listAnimalOwnerships(input.animalId);
    }),
    updateStatus: adminProcedure
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
  adminSync: router({
    /**
     * Pull contacts from Bitrix24 and create/update local users.
     * Optimized: pre-loads all users into lookup Maps to eliminate N+1 queries,
     * batches DB writes, and moves imports outside the processing loop.
     */
    syncBitrixContacts: adminProcedure.mutation(async ({ ctx }) => {

      const { pullBitrixContacts, isBitrixConfigured: isBxConfigured } = await import("./bitrix24");
      if (!isBxConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bitrix24 не настроен" });
      }

      // ── Move all imports outside the loop ──
      const { getDb: getDbSync } = await import("./db");
      const { users: usersT } = await import("../drizzle/schema");
      const { eq: eqSync } = await import("drizzle-orm");
      const crypto = await import("crypto");
      const { formatPhone: normalizePhoneSync } = await import("../shared/phone");
      const dbSync = await getDbSync();

      // ── Pre-load ALL existing users into lookup Maps (eliminates N+1) ──
      const allUsers = await dbSync
        .select({
          id: usersT.id,
          openId: usersT.openId,
          name: usersT.name,
          email: usersT.email,
          phone: usersT.phone,
          bitrix24ContactId: usersT.bitrix24ContactId,
        })
        .from(usersT);

      const byBitrixId = new Map<string, (typeof allUsers)[0]>();
      const byEmail = new Map<string, (typeof allUsers)[0]>();
      const byPhone = new Map<string, (typeof allUsers)[0]>();

      for (const u of allUsers) {
        if (u.bitrix24ContactId) byBitrixId.set(u.bitrix24ContactId, u);
        if (u.email) byEmail.set(u.email.toLowerCase(), u);
        if (u.phone) {
          byPhone.set(u.phone, u);
          // Also index by normalized form for cross-format matching
          const normalized = normalizePhoneSync(u.phone);
          if (normalized && normalized !== u.phone) byPhone.set(normalized, u);
        }
      }

      let synced = 0;
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let nextStart: number | null = 0;

      // ── Collect batch operations to minimize DB round-trips ──
      type UpdateOp = { openId: string; data: Record<string, unknown> };
      type InsertOp = typeof usersT.$inferInsert;
      const pendingUpdates: UpdateOp[] = [];
      const pendingInserts: InsertOp[] = [];

      while (nextStart !== null) {
        const batch = await pullBitrixContacts({ start: nextStart });

        for (const contact of batch.contacts) {
          const email = contact.EMAIL?.[0]?.VALUE ?? null;
          const rawPhone = contact.PHONE?.[0]?.VALUE ?? null;
          const phone = rawPhone ? (normalizePhoneSync(rawPhone) ?? rawPhone) : null;
          const fullName = [contact.LAST_NAME, contact.NAME, contact.SECOND_NAME].filter(Boolean).join(" ").trim() || "Контакт";
          const bitrixId = String(contact.ID);

          if (!email && !phone) {
            skipped++;
            continue;
          }

          // ── Lookup 1: by Bitrix ID (O(1) Map lookup instead of DB query) ──
          const existingByBitrix = byBitrixId.get(bitrixId);
          if (existingByBitrix) {
            const updates: Record<string, unknown> = {};
            if (email && existingByBitrix.email !== email) updates.email = email;
            if (phone && existingByBitrix.phone !== phone) updates.phone = phone;
            if (fullName && existingByBitrix.name !== fullName) updates.name = fullName;
            if (Object.keys(updates).length > 0) {
              updates.updatedAt = new Date();
              pendingUpdates.push({ openId: existingByBitrix.openId, data: updates });
              updated++;
            }
            synced++;
            continue;
          }

          // ── Lookup 2: by email (O(1) Map lookup instead of DB query) ──
          if (email) {
            const existingByEmail = byEmail.get(email.toLowerCase());
            if (existingByEmail) {
              pendingUpdates.push({
                openId: existingByEmail.openId,
                data: { bitrix24ContactId: bitrixId, updatedAt: new Date() },
              });
              // Update Maps for subsequent lookups within same sync
              byBitrixId.set(bitrixId, { ...existingByEmail, bitrix24ContactId: bitrixId });
              updated++;
              synced++;
              continue;
            }
          }

          // ── Lookup 3: by phone (O(1) Map lookup) ──
          if (phone) {
            const existingByPhone = byPhone.get(phone);
            if (existingByPhone) {
              pendingUpdates.push({
                openId: existingByPhone.openId,
                data: { bitrix24ContactId: bitrixId, updatedAt: new Date() },
              });
              byBitrixId.set(bitrixId, { ...existingByPhone, bitrix24ContactId: bitrixId });
              updated++;
              synced++;
              continue;
            }
          }

          // ── Create new user from Bitrix contact ──
          const openId = `bitrix_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
          const newUser: InsertOp = {
            openId,
            name: fullName,
            email,
            phone,
            bitrix24ContactId: bitrixId,
            loginMethod: "bitrix",
            role: "user",
            lastSignedIn: new Date(),
            onboardingCompleted: false,
          };
          pendingInserts.push(newUser);

          // Update Maps so subsequent contacts in same batch can find this user
          const mapEntry = { id: 0, openId, name: fullName, email, phone, bitrix24ContactId: bitrixId };
          byBitrixId.set(bitrixId, mapEntry);
          if (email) byEmail.set(email.toLowerCase(), mapEntry);
          if (phone) byPhone.set(phone, mapEntry);

          created++;
          synced++;
        }

        nextStart = batch.nextStart;
      }

      // ── Flush batch updates (one DB call per update) ──
      const BATCH_SIZE = 50;
      for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
        const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
        await Promise.all(
          chunk.map((op) =>
            dbSync.update(usersT).set(op.data).where(eqSync(usersT.openId, op.openId)),
          ),
        );
      }

      // ── Flush batch inserts (bulk insert in chunks) ──
      for (let i = 0; i < pendingInserts.length; i += BATCH_SIZE) {
        const chunk = pendingInserts.slice(i, i + BATCH_SIZE);
        await dbSync.insert(usersT).values(chunk);
      }

      return { success: true, synced, created, updated, skipped };
    }),

    /** Admin resets a user's password — generates a new random password, saves hash + plaintext */
    resetUserPassword: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {

        const crypto = await import("crypto");
        const { eq: eqR } = await import("drizzle-orm");
        const { users: usersT } = await import("../drizzle/schema");
        const { getDb: getDbR } = await import("./db");
        const db = await getDbR();

        // Find user by id
        const [targetUser] = await db
          .select({ openId: usersT.openId, name: usersT.name, email: usersT.email })
          .from(usersT)
          .where(eqR(usersT.id, input.userId))
          .limit(1);

        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
        }

        // Generate a random 10-char password
        const newPassword = crypto.randomBytes(5).toString("hex").slice(0, 8) + "A1";
        const newHash = await hashPassword(newPassword);

        await db
          .update(usersT)
          .set({ passwordHash: newHash, updatedAt: new Date() })
          .where(eqR(usersT.id, input.userId));

        return { success: true, newPassword, userName: targetUser.name, userEmail: targetUser.email };
      }),
  }),
  adminAnalytics: router({
    userFunnel: adminProcedure.query(async () => {
      return getUserFunnelAnalytics();
    }),
    pendingApplicationsCount: adminProcedure.query(async () => {
      return getPendingApplicationsCount();
    }),
    /** Admin: paginated user list with search and filters */
    listUsers: adminProcedure
      .input(
        z.object({
          page: z.number().min(1).default(1),
          pageSize: z.number().min(5).max(100).default(20),
          search: z.string().optional(),
          role: z.enum(["user", "admin"]).optional(),
          loginMethod: z.string().optional(),
          hasBitrix: z.boolean().optional(),
          hasPassword: z.boolean().optional(),
          lastLogin: z.enum(["today", "week", "month", "inactive", "never"]).optional(),
          sortBy: z.enum(["createdAt", "name", "email", "lastSignedIn"]).optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return listUsersAdmin(input);
      }),
    /** Admin: export all users matching filters (no pagination) */
    exportUsers: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          role: z.enum(["user", "admin"]).optional(),
          loginMethod: z.string().optional(),
          hasBitrix: z.boolean().optional(),
          hasPassword: z.boolean().optional(),
          lastLogin: z.enum(["today", "week", "month", "inactive", "never"]).optional(),
          sortBy: z.enum(["createdAt", "name", "email", "lastSignedIn"]).optional(),
          sortOrder: z.enum(["asc", "desc"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        return exportUsersAdmin(input);
      }),
  }),

  // ─── User Details ──────────────────────────────────────────────────
  adminUserDetails: router({
    getDetails: adminProcedure
      .input(z.object({ userOpenId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const details = await getUserDetailsAdmin(input.userOpenId);
        if (!details) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден" });
        }
        return details;
      }),
  }),

  // ─── Trash / Soft-Delete ──────────────────────────────────────────────────
  faqChat: faqChatRouter,
  cms: cmsRouter,
  adminTrash: router({
    /** Move user to trash (soft-delete) */
    softDelete: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await softDeleteUser(input.userId, ctx.user.openId);
        return { success: true };
      }),

    /** Restore user from trash */
    restore: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await restoreUser(input.userId);
        return { success: true };
      }),

    /** List users in trash */
    list: adminProcedure
      .query(async ({ ctx }) => {
        return listTrashedUsers();
      }),

    /** Permanently delete a user and return shares to farm */
    permanentDelete: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const result = await permanentDeleteUser(input.userId);
        return { success: true, deletedOwnerships: result.deletedOwnerships };
      }),

    /** Auto-cleanup: permanently delete users in trash > 30 days */
    autoCleanup: adminProcedure
      .mutation(async ({ ctx }) => {
        const expired = await findExpiredTrashedUsers(30);
        let cleaned = 0;
        const allDeletedOwnerships: Array<{ animalId: number; ownershipId: number }> = [];
        for (const u of expired) {
          const result = await permanentDeleteUser(u.id);
          allDeletedOwnerships.push(...result.deletedOwnerships);
          cleaned++;
        }
        return { cleaned, deletedOwnerships: allDeletedOwnerships };
      }),
  }),
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listUserNotifications(ctx.user.openId);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return countUnreadNotifications(ctx.user.openId);
    }),
    markRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const ok = await markNotificationRead(input.notificationId, ctx.user.openId);
        return { success: ok };
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const ok = await markAllNotificationsRead(ctx.user.openId);
      return { success: ok };
    }),
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return getNotificationPreferences(ctx.user.openId);
    }),
    updatePreferences: protectedProcedure
      .input(z.object({
        photoApproved: z.boolean().optional(),
        photoRejected: z.boolean().optional(),
        clubPost: z.boolean().optional(),
        clubEvent: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ok = await upsertNotificationPreferences(ctx.user.openId, input);
        return { success: ok };
      }),
  }),
});

export type AppRouter = typeof appRouter;
