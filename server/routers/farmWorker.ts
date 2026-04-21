/**
 * Farm Worker tRPC Router.
 *
 * Provides:
 * - farmAuth.login / farmAuth.logout / farmAuth.me / farmAuth.changePassword
 * - farmAdmin.listWorkers / farmAdmin.createWorker / farmAdmin.toggleActive / farmAdmin.resetPassword
 *
 * Farm worker auth uses a separate JWT cookie (farm_session) from site user auth.
 */

import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  loginFarmWorker,
  changeFarmWorkerPassword,
  getFarmWorkerById,
  listFarmWorkers,
  createFarmWorker,
  toggleFarmWorkerActive,
  hashFarmPassword,
  verifyFarmToken,
  FARM_COOKIE_NAME,
  logMilkAudit,
} from "../farmAuth";
import { farmWorkers } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

// ─── Helper: extract farm worker from request cookie ─────────

function extractFarmWorkerFromReq(
  req: any,
): { workerId: number; login: string; role: string } | null {
  // Express populates req.cookies when cookie-parser is used,
  // otherwise fall back to manual header parsing.
  const token = req.cookies?.[FARM_COOKIE_NAME]
    ?? parseCookieHeader(req.headers?.cookie ?? "")[FARM_COOKIE_NAME];
  if (!token) return null;
  return verifyFarmToken(token);
}

/** Minimal cookie header parser (no external dep). */
function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

// ─── Farm Auth Router ────────────────────────────────────────

export const farmAuthRouter = router({
  /**
   * Login — sets farm_session cookie.
   */
  login: publicProcedure
    .input(
      z.object({
        login: z.string().min(1).max(64),
        password: z.string().min(1).max(128),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await loginFarmWorker(input.login, input.password);

      if (!result.success || !result.token || !result.worker) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: result.error ?? "Ошибка авторизации",
        });
      }

      // Set cookie via Express helper
      ctx.res.cookie(FARM_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      });

      return {
        worker: {
          id: result.worker.id,
          login: result.worker.login,
          name: result.worker.name,
          role: result.worker.role,
        },
        mustChangePassword: result.mustChangePassword ?? false,
      };
    }),

  /**
   * Logout — clears farm_session cookie.
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(FARM_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return { success: true };
  }),

  /**
   * Me — returns current farm worker from cookie.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    const payload = extractFarmWorkerFromReq(ctx.req);
    if (!payload) return null;

    const worker = await getFarmWorkerById(payload.workerId);
    if (!worker || !worker.isActive) return null;

    return {
      id: worker.id,
      login: worker.login,
      name: worker.name,
      role: worker.role,
      mustChangePassword: worker.mustChangePassword,
      telegramChatId: worker.telegramChatId,
    };
  }),

  /**
   * Change password — requires current password (unless mustChangePassword).
   */
  changePassword: publicProcedure
    .input(
      z.object({
        currentPassword: z.string().max(128).default(""),
        newPassword: z.string().min(6).max(128),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const payload = extractFarmWorkerFromReq(ctx.req);
      if (!payload) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Необходимо войти в систему",
        });
      }

      const result = await changeFarmWorkerPassword(
        payload.workerId,
        input.currentPassword,
        input.newPassword,
      );

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Ошибка смены пароля",
        });
      }

      return { success: true };
    }),
});

// ─── Farm Admin Router (site admin only) ─────────────────────

export const farmAdminRouter = router({
  /**
   * List all farm workers.
   */
  listWorkers: adminProcedure.query(async () => {
    const workers = await listFarmWorkers();
    return workers.map((w) => ({
      id: w.id,
      login: w.login,
      name: w.name,
      role: w.role,
      isActive: w.isActive,
      mustChangePassword: w.mustChangePassword,
      phone: w.phone,
      telegramChatId: w.telegramChatId,
      lastLoginAt: w.lastLoginAt,
      createdAt: w.createdAt,
    }));
  }),

  /**
   * Create a new farm worker.
   */
  createWorker: adminProcedure
    .input(
      z.object({
        login: z.string().min(2).max(64),
        name: z.string().min(1).max(160),
        password: z.string().min(6).max(128),
        role: z.enum(["milker", "cheesemaker", "vet", "manager"]),
      }),
    )
    .mutation(async ({ input }) => {
      // Check for duplicate login
      const { getFarmWorkerByLogin } = await import("../farmAuth");
      const existing = await getFarmWorkerByLogin(input.login);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Логин "${input.login}" уже занят`,
        });
      }

      const worker = await createFarmWorker(input);
      return {
        id: worker.id,
        login: worker.login,
        name: worker.name,
        role: worker.role,
      };
    }),

  /**
   * Toggle worker active/inactive.
   */
  toggleActive: adminProcedure
    .input(
      z.object({
        workerId: z.number().int().positive(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      await toggleFarmWorkerActive(input.workerId, input.isActive);
      return { success: true };
    }),

  /**
   * Reset worker password (admin sets a new temp password).
   */
  resetPassword: adminProcedure
    .input(
      z.object({
        workerId: z.number().int().positive(),
        newPassword: z.string().min(6).max(128),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const passwordHash = await hashFarmPassword(input.newPassword);
      await db
        .update(farmWorkers)
        .set({ passwordHash, mustChangePassword: true })
        .where(eq(farmWorkers.id, input.workerId));

      await logMilkAudit({
        action: "worker_password_changed",
        adminOpenId: ctx.user.openId,
        entityType: "worker",
        entityId: input.workerId,
        detailsJson: JSON.stringify({ resetByAdmin: true }),
      });

      return { success: true };
    }),

  /**
   * Update worker details (name, role, phone, telegramChatId).
   */
  updateWorker: adminProcedure
    .input(
      z.object({
        workerId: z.number().int().positive(),
        name: z.string().min(1).max(160).optional(),
        role: z.enum(["milker", "cheesemaker", "vet", "manager"]).optional(),
        phone: z.string().max(32).optional().nullable(),
        telegramChatId: z.string().max(64).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const updates: Record<string, any> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.role !== undefined) updates.role = input.role;
      if (input.phone !== undefined) updates.phone = input.phone;
      if (input.telegramChatId !== undefined) updates.telegramChatId = input.telegramChatId;

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Нет данных для обновления",
        });
      }

      await db
        .update(farmWorkers)
        .set(updates)
        .where(eq(farmWorkers.id, input.workerId));

      return { success: true };
    }),

  /**
   * Soft-delete a worker (sets isActive=false and marks as deleted).
   * Farm workers are not hard-deleted to preserve audit trail.
   */
  deleteWorker: adminProcedure
    .input(
      z.object({
        workerId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Soft-delete: deactivate and prefix login to free it
      const [worker] = await db
        .select({ login: farmWorkers.login, name: farmWorkers.name })
        .from(farmWorkers)
        .where(eq(farmWorkers.id, input.workerId));

      if (!worker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сотрудник не найден" });
      }

      await db
        .update(farmWorkers)
        .set({
          isActive: false,
          login: `__deleted_${Date.now()}_${worker.login}`,
        })
        .where(eq(farmWorkers.id, input.workerId));

      await logMilkAudit({
        action: "worker_password_changed",
        adminOpenId: ctx.user.openId,
        entityType: "worker",
        entityId: input.workerId,
        detailsJson: JSON.stringify({ action: "deleted", workerName: worker.name }),
      });

      return { success: true };
    }),
});
