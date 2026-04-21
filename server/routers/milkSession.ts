/**
 * Milk Session tRPC Router.
 *
 * Provides milker ARM endpoints:
 * - milkSession.create — start a new milking session
 * - milkSession.submit — finalize session (set to pending_confirm)
 * - milkSession.myToday — get today's sessions for current worker
 * - milkSession.myHistory — paginated history for current worker
 * - milkSession.getById — get session details
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifyFarmToken, FARM_COOKIE_NAME, logMilkAudit } from "../farmAuth";
import { milkSessions, milkSessionAnimals } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Helper: extract farm worker from request cookie ─────────

function extractFarmWorker(req: any): { workerId: number; login: string; role: string } | null {
  const cookieHeader = req.headers?.cookie ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  const token = req.cookies?.[FARM_COOKIE_NAME] ?? cookies[FARM_COOKIE_NAME];
  if (!token) return null;
  return verifyFarmToken(token);
}

/** Require milker role */
function requireMilker(req: any) {
  const worker = extractFarmWorker(req);
  if (!worker) throw new TRPCError({ code: "UNAUTHORIZED", message: "Необходимо войти" });
  if (worker.role !== "milker" && worker.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Доступ только для дояров" });
  }
  return worker;
}

/** Require any farm worker */
function requireFarmWorker(req: any) {
  const worker = extractFarmWorker(req);
  if (!worker) throw new TRPCError({ code: "UNAUTHORIZED", message: "Необходимо войти" });
  return worker;
}

/** Generate session code: SK-DDMMYY-M or SK-DDMMYY-E */
function generateSessionCode(date: Date, shift: "morning" | "evening"): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const s = shift === "morning" ? "M" : "E";
  return `SK-${dd}${mm}${yy}-${s}`;
}

/** Format date as YYYY-MM-DD */
function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const milkSessionRouter = router({
  /**
   * Create a new milking session.
   * Milker fills in: shift, head counts, total volume, optional temp/density/note.
   */
  create: publicProcedure
    .input(
      z.object({
        shift: z.enum(["morning", "evening"]),
        totalVolumeMl: z.number().int().positive().max(500_000),
        goatHeadCount: z.number().int().min(0).max(500),
        sheepHeadCount: z.number().int().min(0).max(500),
        cowHeadCount: z.number().int().min(0).max(200),
        temperatureCelsius: z.number().min(0).max(50).optional(),
        densityGCm3: z.number().min(0.9).max(1.2).optional(),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const worker = requireMilker(ctx.req);
      const db = await getDb();

      // Use current date (Moscow timezone, UTC+3)
      const now = new Date();
      const moscowOffset = 3 * 60 * 60 * 1000;
      const moscowDate = new Date(now.getTime() + moscowOffset);
      const milkingDate = formatDateISO(moscowDate);
      const sessionCode = generateSessionCode(moscowDate, input.shift);

      // Check for duplicate session (same date + shift)
      const [existing] = await db
        .select({ id: milkSessions.id })
        .from(milkSessions)
        .where(eq(milkSessions.sessionCode, sessionCode))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Дойка ${sessionCode} уже зарегистрирована. Используйте существующую запись.`,
        });
      }

      // Validate at least one head
      if (input.goatHeadCount + input.sheepHeadCount + input.cowHeadCount === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Укажите количество дойных голов (козы, овцы и/или коровы)",
        });
      }

      // Auto-confirm deadline: +72h
      const autoConfirmAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

      const temperatureTenths = input.temperatureCelsius != null
        ? Math.round(input.temperatureCelsius * 10)
        : null;
      const densityThousandths = input.densityGCm3 != null
        ? Math.round(input.densityGCm3 * 1000)
        : null;

      const [result] = await db.insert(milkSessions).values({
        sessionCode,
        workerId: worker.workerId,
        milkingDate,
        shift: input.shift,
        totalVolumeMl: input.totalVolumeMl,
        goatHeadCount: input.goatHeadCount,
        sheepHeadCount: input.sheepHeadCount,
        cowHeadCount: input.cowHeadCount,
        temperatureTenths,
        densityThousandths,
        note: input.note ?? null,
        status: "pending_confirm",
        autoConfirmAt,
      });

      // Audit log
      await logMilkAudit({
        action: "session_created",
        workerId: worker.workerId,
        entityType: "session",
        entityId: result.insertId,
        detailsJson: JSON.stringify({
          sessionCode,
          shift: input.shift,
          totalVolumeMl: input.totalVolumeMl,
          goatHeadCount: input.goatHeadCount,
          sheepHeadCount: input.sheepHeadCount,
          cowHeadCount: input.cowHeadCount,
        }),
      });

      return {
        id: result.insertId,
        sessionCode,
        status: "pending_confirm" as const,
        autoConfirmAt: autoConfirmAt.toISOString(),
      };
    }),

  /**
   * Get today's sessions for the current worker.
   */
  myToday: publicProcedure.query(async ({ ctx }) => {
    const worker = requireFarmWorker(ctx.req);
    const db = await getDb();

    // Moscow date
    const now = new Date();
    const moscowOffset = 3 * 60 * 60 * 1000;
    const moscowDate = new Date(now.getTime() + moscowOffset);
    const today = formatDateISO(moscowDate);

    const sessions = await db
      .select()
      .from(milkSessions)
      .where(
        and(
          eq(milkSessions.workerId, worker.workerId),
          eq(milkSessions.milkingDate, today),
        ),
      )
      .orderBy(desc(milkSessions.createdAt));

    return sessions.map(formatSession);
  }),

  /**
   * Paginated history for the current worker.
   */
  myHistory: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const worker = requireFarmWorker(ctx.req);
      const db = await getDb();

      const offset = (input.page - 1) * input.pageSize;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkSessions)
        .where(eq(milkSessions.workerId, worker.workerId));

      const sessions = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.workerId, worker.workerId))
        .orderBy(desc(milkSessions.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return {
        sessions: sessions.map(formatSession),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Get session by ID (any farm worker can view).
   */
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      requireFarmWorker(ctx.req);
      const db = await getDb();

      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.id))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      return formatSession(session);
    }),

  /**
   * List all sessions (for admin dashboard / cheesemaker).
   */
  listAll: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
        status: z.enum(["in_progress", "pending_confirm", "confirmed", "disputed"]).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      requireFarmWorker(ctx.req);
      const db = await getDb();

      const conditions = [];
      if (input.status) conditions.push(eq(milkSessions.status, input.status));
      if (input.dateFrom) conditions.push(sql`${milkSessions.milkingDate} >= ${input.dateFrom}`);
      if (input.dateTo) conditions.push(sql`${milkSessions.milkingDate} <= ${input.dateTo}`);

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkSessions)
        .where(whereClause);

      const sessions = await db
        .select()
        .from(milkSessions)
        .where(whereClause)
        .orderBy(desc(milkSessions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        sessions: sessions.map(formatSession),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});

// ─── Format helper ──────────────────────────────────────────

function formatSession(s: typeof milkSessions.$inferSelect) {
  return {
    id: s.id,
    sessionCode: s.sessionCode,
    workerId: s.workerId,
    milkingDate: s.milkingDate,
    shift: s.shift,
    totalVolumeMl: s.totalVolumeMl,
    totalVolumeLiters: +(s.totalVolumeMl / 1000).toFixed(2),
    goatHeadCount: s.goatHeadCount,
    sheepHeadCount: s.sheepHeadCount,
    cowHeadCount: s.cowHeadCount,
    temperatureCelsius: s.temperatureTenths != null ? +(s.temperatureTenths / 10).toFixed(1) : null,
    densityGCm3: s.densityThousandths != null ? +(s.densityThousandths / 1000).toFixed(3) : null,
    note: s.note,
    status: s.status,
    autoConfirmAt: s.autoConfirmAt?.toISOString() ?? null,
    confirmedBy: s.confirmedBy,
    confirmedAt: s.confirmedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}
