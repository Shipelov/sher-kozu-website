/**
 * Milk Session tRPC Router.
 *
 * Provides milker ARM endpoints:
 * - milkSession.create — start a new milking session (per-type volumes)
 * - milkSession.myToday — get today's sessions for current worker
 * - milkSession.myHistory — paginated history for current worker
 * - milkSession.getById — get session details
 * - milkSession.listAll — list all sessions (for cheesemaker/admin)
 *
 * Milk is tracked SEPARATELY by animal type (goat/sheep/cow).
 * Each type has its own volume (ml) and head count.
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifyFarmToken, FARM_COOKIE_NAME, logMilkAudit } from "../farmAuth";
import { milkSessions, milkReceptions, farmWorkers } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

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

/** Per-animal-type volume+heads+feeding+losses input schema */
const animalTypeInput = z.object({
  volumeMl: z.number().int().min(0).max(500_000),
  headCount: z.number().int().min(0).max(500),
  feedingMl: z.number().int().min(0).max(500_000).default(0),
  lossesMl: z.number().int().min(0).max(500_000).default(0),
}).refine(
  (d) => (d.volumeMl > 0 && d.headCount > 0) || (d.volumeMl === 0 && d.headCount === 0),
  { message: "Если указан объём, укажите и количество голов (и наоборот)" },
).refine(
  (d) => (d.feedingMl + d.lossesMl) <= d.volumeMl,
  { message: "Выпойка + потери не могут превышать общий надой" },
);

export const milkSessionRouter = router({
  /**
   * Create a new milking session.
   * Milker fills in per-type volumes: goat, sheep, cow.
   * At least one type must have volume > 0.
   */
  create: publicProcedure
    .input(
      z.object({
        shift: z.enum(["morning", "evening"]),
        goat: animalTypeInput.default({ volumeMl: 0, headCount: 0, feedingMl: 0, lossesMl: 0 }),
        sheep: animalTypeInput.default({ volumeMl: 0, headCount: 0, feedingMl: 0, lossesMl: 0 }),
        cow: animalTypeInput.default({ volumeMl: 0, headCount: 0, feedingMl: 0, lossesMl: 0 }),
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

      // Validate at least one type has volume
      const totalVolume = input.goat.volumeMl + input.sheep.volumeMl + input.cow.volumeMl;
      if (totalVolume === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Укажите объём молока хотя бы для одного вида животных",
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
        goatVolumeMl: input.goat.volumeMl,
        goatHeadCount: input.goat.headCount,
        goatFeedingMl: input.goat.feedingMl,
        goatLossesMl: input.goat.lossesMl,
        sheepVolumeMl: input.sheep.volumeMl,
        sheepHeadCount: input.sheep.headCount,
        sheepFeedingMl: input.sheep.feedingMl,
        sheepLossesMl: input.sheep.lossesMl,
        cowVolumeMl: input.cow.volumeMl,
        cowHeadCount: input.cow.headCount,
        cowFeedingMl: input.cow.feedingMl,
        cowLossesMl: input.cow.lossesMl,
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
          goat: input.goat,
          sheep: input.sheep,
          cow: input.cow,
          totalVolumeMl: totalVolume,
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

    // Enrich with reception status per milk type
    const sessionIds = sessions.map(s => s.id);
    const receptions = sessionIds.length > 0
      ? await db
          .select({
            sessionId: milkReceptions.sessionId,
            milkType: milkReceptions.milkType,
            status: milkReceptions.status,
            rejectionReason: milkReceptions.rejectionReason,
          })
          .from(milkReceptions)
          .where(
            and(
              inArray(milkReceptions.sessionId, sessionIds),
              inArray(milkReceptions.status, ["accepted", "rejected"]),
            ),
          )
      : [];

    const receptionMap = new Map<number, Array<{ milkType: string; status: string; rejectionReason: string | null }>>();
    for (const r of receptions) {
      if (!receptionMap.has(r.sessionId)) receptionMap.set(r.sessionId, []);
      receptionMap.get(r.sessionId)!.push({ milkType: r.milkType, status: r.status, rejectionReason: r.rejectionReason });
    }

    return sessions.map(s => ({
      ...formatSession(s),
      receptions: receptionMap.get(s.id) ?? [],
    }));
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

      // Enrich with reception status per milk type
      const sessionIds = sessions.map(s => s.id);
      const receptions = sessionIds.length > 0
        ? await db
            .select({
              sessionId: milkReceptions.sessionId,
              milkType: milkReceptions.milkType,
              status: milkReceptions.status,
              rejectionReason: milkReceptions.rejectionReason,
            })
            .from(milkReceptions)
            .where(
              and(
                inArray(milkReceptions.sessionId, sessionIds),
                inArray(milkReceptions.status, ["accepted", "rejected"]),
              ),
            )
        : [];

      const receptionMap = new Map<number, Array<{ milkType: string; status: string; rejectionReason: string | null }>>();
      for (const r of receptions) {
        if (!receptionMap.has(r.sessionId)) receptionMap.set(r.sessionId, []);
        receptionMap.get(r.sessionId)!.push({ milkType: r.milkType, status: r.status, rejectionReason: r.rejectionReason });
      }

      return {
        sessions: sessions.map(s => ({
          ...formatSession(s),
          receptions: receptionMap.get(s.id) ?? [],
        })),
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
   * Update a pending session (milker can edit before confirmation).
   * Only sessions in 'pending_confirm' status owned by the milker can be updated.
   */
  update: publicProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        shift: z.enum(["morning", "evening"]).optional(),
        goat: animalTypeInput.optional(),
        sheep: animalTypeInput.optional(),
        cow: animalTypeInput.optional(),
        note: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const worker = requireMilker(ctx.req);
      const db = await getDb();

      // Fetch session
      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }
      if (session.workerId !== worker.workerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Можно редактировать только свои дойки" });
      }
      if (session.status !== "pending_confirm") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Редактировать можно только дойки в статусе \"ожидание подтверждения\"" });
      }

      // Build update fields
      const updates: Record<string, any> = {};

      if (input.goat) {
        updates.goatVolumeMl = input.goat.volumeMl;
        updates.goatHeadCount = input.goat.headCount;
        updates.goatFeedingMl = input.goat.feedingMl;
        updates.goatLossesMl = input.goat.lossesMl;
      }
      if (input.sheep) {
        updates.sheepVolumeMl = input.sheep.volumeMl;
        updates.sheepHeadCount = input.sheep.headCount;
        updates.sheepFeedingMl = input.sheep.feedingMl;
        updates.sheepLossesMl = input.sheep.lossesMl;
      }
      if (input.cow) {
        updates.cowVolumeMl = input.cow.volumeMl;
        updates.cowHeadCount = input.cow.headCount;
        updates.cowFeedingMl = input.cow.feedingMl;
        updates.cowLossesMl = input.cow.lossesMl;
      }
      if (input.note !== undefined) {
        updates.note = input.note;
      }

      // Validate at least one type has volume after update
      const newGoatMl = input.goat?.volumeMl ?? session.goatVolumeMl;
      const newSheepMl = input.sheep?.volumeMl ?? session.sheepVolumeMl;
      const newCowMl = input.cow?.volumeMl ?? session.cowVolumeMl;
      const totalVolume = newGoatMl + newSheepMl + newCowMl;

      if (totalVolume === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Укажите объём молока хотя бы для одного вида животных",
        });
      }

      // If shift changed, regenerate session code
      if (input.shift && input.shift !== session.shift) {
        const moscowOffset = 3 * 60 * 60 * 1000;
        const moscowDate = new Date(session.createdAt.getTime() + moscowOffset);
        updates.shift = input.shift;
        updates.sessionCode = generateSessionCode(moscowDate, input.shift);
      }

      if (Object.keys(updates).length === 0) {
        return { success: true, message: "Нет изменений" };
      }

      await db.update(milkSessions).set(updates).where(eq(milkSessions.id, input.sessionId));

      // Audit log
      await logMilkAudit({
        action: "session_updated",
        workerId: worker.workerId,
        entityType: "session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          changes: updates,
        }),
      });

      return { success: true, message: "Дойка обновлена" };
    }),

  /**
   * Cancel a pending session (milker can delete before confirmation).
   * Only sessions in 'pending_confirm' status owned by the milker can be cancelled.
   */
  cancel: publicProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const worker = requireMilker(ctx.req);
      const db = await getDb();

      // Fetch session
      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }
      if (session.workerId !== worker.workerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Можно отменять только свои дойки" });
      }
      if (session.status !== "pending_confirm") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Отменить можно только дойки в статусе \"ожидание подтверждения\"" });
      }

      // Delete the session
      await db.delete(milkSessions).where(eq(milkSessions.id, input.sessionId));

      // Audit log
      await logMilkAudit({
        action: "session_cancelled",
        workerId: worker.workerId,
        entityType: "session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          reason: "Отменена дояром",
        }),
      });

      return { success: true, message: "Дойка отменена" };
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

  /**
   * Export data: all sessions in a date range (no pagination, max 5000).
   * Used by client-side Excel/PDF export.
   */
  reportData: publicProcedure
    .input(
      z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      requireFarmWorker(ctx.req);
      const db = await getDb();

      const sessions = await db
        .select()
        .from(milkSessions)
        .where(
          and(
            sql`${milkSessions.milkingDate} >= ${input.dateFrom}`,
            sql`${milkSessions.milkingDate} <= ${input.dateTo}`,
          ),
        )
        .orderBy(desc(milkSessions.createdAt))
        .limit(5000);

      // Also fetch worker names for display
      const workerIds: number[] = Array.from(new Set(sessions.map((s: any) => s.workerId as number).filter(Boolean)));
      let workerMap: Record<number, string> = {};
      if (workerIds.length > 0) {
        const workers = await db
          .select({ id: farmWorkers.id, name: farmWorkers.name })
          .from(farmWorkers)
          .where(inArray(farmWorkers.id, workerIds));
        workerMap = Object.fromEntries(workers.map((w: any) => [w.id, w.name]));
      }

      // Fetch reception data for all sessions to show accepted/rejected per type
      const sessionIds = sessions.map((s: any) => s.id as number);
      let receptionMap: Record<number, Record<string, { status: string; acceptedMl: number; rejectedMl: number }>> = {};
      if (sessionIds.length > 0) {
        const receptions = await db
          .select({
            sessionId: milkReceptions.sessionId,
            milkType: milkReceptions.milkType,
            status: milkReceptions.status,
            acceptedVolumeMl: milkReceptions.acceptedVolumeMl,
            rejectedVolumeMl: milkReceptions.rejectedVolumeMl,
          })
          .from(milkReceptions)
          .where(inArray(milkReceptions.sessionId, sessionIds));
        for (const r of receptions) {
          if (!receptionMap[r.sessionId]) receptionMap[r.sessionId] = {};
          receptionMap[r.sessionId][r.milkType] = {
            status: r.status,
            acceptedMl: r.acceptedVolumeMl,
            rejectedMl: r.rejectedVolumeMl,
          };
        }
      }

      return {
        sessions: sessions.map((s: any) => {
          const rec = receptionMap[s.id] ?? {};
          const totalAcceptedMl = (rec.goat?.acceptedMl ?? 0) + (rec.sheep?.acceptedMl ?? 0) + (rec.cow?.acceptedMl ?? 0);
          const totalRejectedMl = (rec.goat?.rejectedMl ?? 0) + (rec.sheep?.rejectedMl ?? 0) + (rec.cow?.rejectedMl ?? 0);
          return {
            ...formatSession(s),
            workerName: workerMap[s.workerId] ?? `Дояр #${s.workerId}`,
            receptionByType: rec,
            totalAcceptedLiters: +(totalAcceptedMl / 1000).toFixed(2),
            totalRejectedLiters: +(totalRejectedMl / 1000).toFixed(2),
          };
        }),
      };
    }),
});

// ─── Format helper ──────────────────────────────────────────

function formatSession(s: typeof milkSessions.$inferSelect) {
  const totalVolumeMl = s.goatVolumeMl + s.sheepVolumeMl + s.cowVolumeMl;
  const totalFeedingMl = s.goatFeedingMl + s.sheepFeedingMl + s.cowFeedingMl;
  const totalLossesMl = s.goatLossesMl + s.sheepLossesMl + s.cowLossesMl;
  const netVolumeMl = totalVolumeMl - totalFeedingMl - totalLossesMl;
  return {
    id: s.id,
    sessionCode: s.sessionCode,
    workerId: s.workerId,
    milkingDate: s.milkingDate,
    shift: s.shift,
    // Per-type breakdown
    goat: {
      volumeMl: s.goatVolumeMl,
      volumeLiters: +(s.goatVolumeMl / 1000).toFixed(2),
      headCount: s.goatHeadCount,
      feedingMl: s.goatFeedingMl,
      feedingLiters: +(s.goatFeedingMl / 1000).toFixed(2),
      lossesMl: s.goatLossesMl,
      lossesLiters: +(s.goatLossesMl / 1000).toFixed(2),
      netMl: s.goatVolumeMl - s.goatFeedingMl - s.goatLossesMl,
      netLiters: +((s.goatVolumeMl - s.goatFeedingMl - s.goatLossesMl) / 1000).toFixed(2),
    },
    sheep: {
      volumeMl: s.sheepVolumeMl,
      volumeLiters: +(s.sheepVolumeMl / 1000).toFixed(2),
      headCount: s.sheepHeadCount,
      feedingMl: s.sheepFeedingMl,
      feedingLiters: +(s.sheepFeedingMl / 1000).toFixed(2),
      lossesMl: s.sheepLossesMl,
      lossesLiters: +(s.sheepLossesMl / 1000).toFixed(2),
      netMl: s.sheepVolumeMl - s.sheepFeedingMl - s.sheepLossesMl,
      netLiters: +((s.sheepVolumeMl - s.sheepFeedingMl - s.sheepLossesMl) / 1000).toFixed(2),
    },
    cow: {
      volumeMl: s.cowVolumeMl,
      volumeLiters: +(s.cowVolumeMl / 1000).toFixed(2),
      headCount: s.cowHeadCount,
      feedingMl: s.cowFeedingMl,
      feedingLiters: +(s.cowFeedingMl / 1000).toFixed(2),
      lossesMl: s.cowLossesMl,
      lossesLiters: +(s.cowLossesMl / 1000).toFixed(2),
      netMl: s.cowVolumeMl - s.cowFeedingMl - s.cowLossesMl,
      netLiters: +((s.cowVolumeMl - s.cowFeedingMl - s.cowLossesMl) / 1000).toFixed(2),
    },
    // Totals (computed)
    totalVolumeMl,
    totalVolumeLiters: +(totalVolumeMl / 1000).toFixed(2),
    totalFeedingMl,
    totalFeedingLiters: +(totalFeedingMl / 1000).toFixed(2),
    totalLossesMl,
    totalLossesLiters: +(totalLossesMl / 1000).toFixed(2),
    netVolumeMl,
    netVolumeLiters: +(netVolumeMl / 1000).toFixed(2),
    totalHeadCount: s.goatHeadCount + s.sheepHeadCount + s.cowHeadCount,
    // Quality
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
