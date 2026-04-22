/**
 * Milk Reception & Tank Management tRPC Router.
 *
 * Milk is tracked SEPARATELY by animal type (goat/sheep/cow).
 * Each reception is for a specific milk type from a session.
 * Each tank stores only one type of milk.
 *
 * Endpoints:
 * - milkReception.pendingSessions — sessions with unreceived milk (per type)
 * - milkReception.accept — accept milk of a specific type from a session
 * - milkReception.reject — reject milk of a specific type from a session
 * - milkReception.myReceptions — cheesemaker's reception history
 * - milkTank.list — list all tanks (grouped by milk type)
 * - milkTank.create — create a new tank (admin, must specify milkType)
 * - milkTank.updateStatus — change tank status
 * - milkTank.drain — drain/transfer milk from a tank
 */

import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { verifyFarmToken, FARM_COOKIE_NAME, logMilkAudit } from "../farmAuth";
import {
  milkSessions,
  milkReceptions,
  milkTanks,
  milkTankMovements,
  farmWorkers,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

// ─── Auth helpers ────────────────────────────────────────────

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

function requireCheesemaker(req: any) {
  const worker = extractFarmWorker(req);
  if (!worker) throw new TRPCError({ code: "UNAUTHORIZED", message: "Необходимо войти" });
  if (worker.role !== "cheesemaker" && worker.role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Доступ только для сыроделов" });
  }
  return worker;
}

function requireFarmWorker(req: any) {
  const worker = extractFarmWorker(req);
  if (!worker) throw new TRPCError({ code: "UNAUTHORIZED", message: "Необходимо войти" });
  return worker;
}

const MILK_TYPE_LABELS: Record<string, string> = {
  goat: "Козье",
  sheep: "Овечье",
  cow: "Коровье",
};

// ─── Helper: update session status when all milk types processed ───

/**
 * After accepting or rejecting a milk type, check if ALL milk types
 * in the session now have a reception record. If so, update the
 * session status to "confirmed".
 *
 * A session has milk types with volume > 0 (net = volume - feeding - losses > 0).
 * Each such type needs either an accepted or rejected reception.
 */
async function updateSessionStatusIfComplete(
  db: any,
  sessionId: number,
  session: any,
  workerId: number,
) {
  // Determine which milk types have net volume > 0 (need processing)
  const milkTypesWithVolume: string[] = [];
  const types = [
    { key: "goat", vol: session.goatVolumeMl, feed: session.goatFeedingMl ?? 0, loss: session.goatLossesMl ?? 0 },
    { key: "sheep", vol: session.sheepVolumeMl, feed: session.sheepFeedingMl ?? 0, loss: session.sheepLossesMl ?? 0 },
    { key: "cow", vol: session.cowVolumeMl, feed: session.cowFeedingMl ?? 0, loss: session.cowLossesMl ?? 0 },
  ];
  for (const t of types) {
    const net = t.vol - t.feed - t.loss;
    if (t.vol > 0 && net > 0) {
      milkTypesWithVolume.push(t.key);
    }
  }

  if (milkTypesWithVolume.length === 0) return;

  // Get all receptions for this session (accepted or rejected)
  const receptions = await db
    .select({ milkType: milkReceptions.milkType, status: milkReceptions.status })
    .from(milkReceptions)
    .where(
      and(
        eq(milkReceptions.sessionId, sessionId),
        inArray(milkReceptions.status, ["accepted", "rejected"]),
      ),
    );

  const processedTypes = new Set(receptions.map((r: any) => r.milkType));

  // Check if all required types are processed
  const allProcessed = milkTypesWithVolume.every((t) => processedTypes.has(t));

  if (allProcessed) {
    await db
      .update(milkSessions)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedBy: String(workerId),
      })
      .where(eq(milkSessions.id, sessionId));

    // Audit log
    await logMilkAudit({
      action: "session_confirmed",
      workerId,
      entityType: "session",
      entityId: sessionId,
      detailsJson: JSON.stringify({
        sessionCode: session.sessionCode,
        confirmedByCheesemaker: true,
        processedTypes: milkTypesWithVolume,
      }),
    });
  }
}

// ─── Milk Reception Router ──────────────────────────────────

export const milkReceptionRouter = router({
  /**
   * Get sessions with unreceived milk, broken down by milk type.
   * Returns a flat list of { session, milkType, volumeMl, headCount } items.
   * A session with goat+sheep milk will appear as 2 items.
   */
  pendingSessions: publicProcedure.query(async ({ ctx }) => {
    requireCheesemaker(ctx.req);
    const db = await getDb();

    // Get sessions that are pending_confirm or confirmed
    const sessions = await db
      .select({
        id: milkSessions.id,
        sessionCode: milkSessions.sessionCode,
        workerId: milkSessions.workerId,
        milkingDate: milkSessions.milkingDate,
        shift: milkSessions.shift,
        goatVolumeMl: milkSessions.goatVolumeMl,
        goatHeadCount: milkSessions.goatHeadCount,
        goatFeedingMl: milkSessions.goatFeedingMl,
        goatLossesMl: milkSessions.goatLossesMl,
        sheepVolumeMl: milkSessions.sheepVolumeMl,
        sheepHeadCount: milkSessions.sheepHeadCount,
        sheepFeedingMl: milkSessions.sheepFeedingMl,
        sheepLossesMl: milkSessions.sheepLossesMl,
        cowVolumeMl: milkSessions.cowVolumeMl,
        cowHeadCount: milkSessions.cowHeadCount,
        cowFeedingMl: milkSessions.cowFeedingMl,
        cowLossesMl: milkSessions.cowLossesMl,
        temperatureTenths: milkSessions.temperatureTenths,
        densityThousandths: milkSessions.densityThousandths,
        note: milkSessions.note,
        status: milkSessions.status,
        createdAt: milkSessions.createdAt,
        workerName: farmWorkers.name,
      })
      .from(milkSessions)
      .leftJoin(farmWorkers, eq(milkSessions.workerId, farmWorkers.id))
      .where(inArray(milkSessions.status, ["pending_confirm", "confirmed"]))
      .orderBy(desc(milkSessions.createdAt))
      .limit(50);

    // Get existing accepted receptions to exclude already-received milk types
    const sessionIds = sessions.map((s: any) => s.id);
    let acceptedReceptions: Array<{ sessionId: number; milkType: string }> = [];

    if (sessionIds.length > 0) {
      acceptedReceptions = await db
        .select({
          sessionId: milkReceptions.sessionId,
          milkType: milkReceptions.milkType,
        })
        .from(milkReceptions)
        .where(
          and(
            inArray(milkReceptions.sessionId, sessionIds),
            eq(milkReceptions.status, "accepted"),
          ),
        );
    }

    // Build a set of "sessionId:milkType" that are already accepted
    const acceptedSet = new Set(
      acceptedReceptions.map((r: any) => `${r.sessionId}:${r.milkType}`),
    );

    // Flatten sessions into per-type items
    const items: any[] = [];
    const milkTypes = [
      { key: "goat", volumeField: "goatVolumeMl", headField: "goatHeadCount", feedingField: "goatFeedingMl", lossesField: "goatLossesMl" },
      { key: "sheep", volumeField: "sheepVolumeMl", headField: "sheepHeadCount", feedingField: "sheepFeedingMl", lossesField: "sheepLossesMl" },
      { key: "cow", volumeField: "cowVolumeMl", headField: "cowHeadCount", feedingField: "cowFeedingMl", lossesField: "cowLossesMl" },
    ] as const;

    for (const s of sessions) {
      for (const mt of milkTypes) {
        const totalVol = (s as any)[mt.volumeField] as number;
        const heads = (s as any)[mt.headField] as number;
        const feeding = (s as any)[mt.feedingField] as number;
        const losses = (s as any)[mt.lossesField] as number;
        const netVol = totalVol - feeding - losses; // Сыроделу = Надой − Выпойка − Потери
        if (totalVol <= 0) continue; // No milk of this type
        if (netVol <= 0) continue; // All milk used for feeding/losses
        if (acceptedSet.has(`${s.id}:${mt.key}`)) continue; // Already accepted

        items.push({
          sessionId: s.id,
          sessionCode: s.sessionCode,
          workerId: s.workerId,
          workerName: s.workerName ?? "\u2014",
          milkingDate: s.milkingDate,
          shift: s.shift,
          milkType: mt.key,
          milkTypeLabel: MILK_TYPE_LABELS[mt.key],
          totalVolumeMl: totalVol,
          totalVolumeLiters: +(totalVol / 1000).toFixed(2),
          feedingMl: feeding,
          feedingLiters: +(feeding / 1000).toFixed(2),
          lossesMl: losses,
          lossesLiters: +(losses / 1000).toFixed(2),
          netVolumeMl: netVol,
          netVolumeLiters: +(netVol / 1000).toFixed(2),
          headCount: heads,
          temperatureCelsius: s.temperatureTenths != null ? +(s.temperatureTenths / 10).toFixed(1) : null,
          densityGCm3: s.densityThousandths != null ? +(s.densityThousandths / 1000).toFixed(3) : null,
          note: s.note,
          sessionStatus: s.status,
          createdAt: s.createdAt.toISOString(),
        });
      }
    }

    return items;
  }),

  /**
   * Accept milk of a specific type from a session.
   * milkType must match the tank's milkType.
   */
  accept: publicProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        milkType: z.enum(["goat", "sheep", "cow"]),
        acceptedVolumeMl: z.number().int().positive().max(500_000),
        rejectedVolumeMl: z.number().int().min(0).max(500_000).default(0),
        targetTankId: z.number().int().positive(),
        temperatureCelsius: z.number().min(0).max(50).optional(),
        densityGCm3: z.number().min(0.9).max(1.2).optional(),
        fatPercent: z.number().min(0).max(20).optional(),
        acidityTurner: z.number().int().min(0).max(100).optional(),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const worker = requireCheesemaker(ctx.req);
      const db = await getDb();

      // Verify session exists
      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия дойки не найдена" });
      }

      // Verify tank exists, is active, and matches milk type
      const [tank] = await db
        .select()
        .from(milkTanks)
        .where(eq(milkTanks.id, input.targetTankId))
        .limit(1);

      if (!tank || !tank.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Танк не найден или неактивен" });
      }

      if (tank.milkType !== input.milkType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Танк "${tank.name}" предназначен для ${MILK_TYPE_LABELS[tank.milkType]} молока, а вы пытаетесь залить ${MILK_TYPE_LABELS[input.milkType]}`,
        });
      }

      // Check tank capacity
      const newVolume = tank.currentVolumeMl + input.acceptedVolumeMl;
      if (newVolume > tank.capacityMl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Недостаточно места в танке. Свободно: ${((tank.capacityMl - tank.currentVolumeMl) / 1000).toFixed(1)} л`,
        });
      }

      // Check no existing accepted reception for this session + milkType
      const [existingReception] = await db
        .select({ id: milkReceptions.id })
        .from(milkReceptions)
        .where(
          and(
            eq(milkReceptions.sessionId, input.sessionId),
            eq(milkReceptions.milkType, input.milkType),
            eq(milkReceptions.status, "accepted"),
          ),
        )
        .limit(1);

      if (existingReception) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${MILK_TYPE_LABELS[input.milkType]} молоко из этой дойки уже принято`,
        });
      }

      const temperatureTenths = input.temperatureCelsius != null
        ? Math.round(input.temperatureCelsius * 10)
        : null;
      const densityThousandths = input.densityGCm3 != null
        ? Math.round(input.densityGCm3 * 1000)
        : null;
      const fatPercentTenths = input.fatPercent != null
        ? Math.round(input.fatPercent * 10)
        : null;

      // Create reception
      const [receptionResult] = await db.insert(milkReceptions).values({
        sessionId: input.sessionId,
        milkType: input.milkType,
        receivedByWorkerId: worker.workerId,
        acceptedVolumeMl: input.acceptedVolumeMl,
        rejectedVolumeMl: input.rejectedVolumeMl,
        temperatureTenths,
        densityThousandths,
        fatPercentTenths,
        acidityTurner: input.acidityTurner ?? null,
        status: "accepted",
        targetTankId: input.targetTankId,
        note: input.note ?? null,
      });

      // Update tank volume
      await db
        .update(milkTanks)
        .set({
          currentVolumeMl: newVolume,
          status: newVolume >= tank.capacityMl ? "full" : "filling",
        })
        .where(eq(milkTanks.id, input.targetTankId));

      // Log tank movement
      await db.insert(milkTankMovements).values({
        tankId: input.targetTankId,
        movementType: "milking_in",
        volumeMl: input.acceptedVolumeMl,
        tankVolumeAfterMl: newVolume,
        sessionId: input.sessionId,
        receptionId: receptionResult.insertId,
        performedByWorkerId: worker.workerId,
        note: `Приёмка ${MILK_TYPE_LABELS[input.milkType]} из ${session.sessionCode}`,
      });

      // Audit log
      await logMilkAudit({
        action: "reception_accepted",
        workerId: worker.workerId,
        entityType: "reception",
        entityId: receptionResult.insertId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          milkType: input.milkType,
          acceptedVolumeMl: input.acceptedVolumeMl,
          rejectedVolumeMl: input.rejectedVolumeMl,
          targetTankId: input.targetTankId,
        }),
      });

      // ─── Update session status if all milk types are now processed ───
      await updateSessionStatusIfComplete(db, input.sessionId, session, worker.workerId);

      return {
        receptionId: receptionResult.insertId,
        milkType: input.milkType,
        tankNewVolumeMl: newVolume,
        tankNewVolumeLiters: +(newVolume / 1000).toFixed(2),
      };
    }),

  /**
   * Reject milk of a specific type from a session.
   */
  reject: publicProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        milkType: z.enum(["goat", "sheep", "cow"]),
        rejectionReason: z.string().min(3).max(1000),
        note: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const worker = requireCheesemaker(ctx.req);
      const db = await getDb();

      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия дойки не найдена" });
      }

      // Get the volume for this milk type
      const volumeMap: Record<string, number> = {
        goat: session.goatVolumeMl,
        sheep: session.sheepVolumeMl,
        cow: session.cowVolumeMl,
      };
      const rejectedVolume = volumeMap[input.milkType] ?? 0;

      const [receptionResult] = await db.insert(milkReceptions).values({
        sessionId: input.sessionId,
        milkType: input.milkType,
        receivedByWorkerId: worker.workerId,
        acceptedVolumeMl: 0,
        rejectedVolumeMl: rejectedVolume,
        status: "rejected",
        rejectionReason: input.rejectionReason,
        note: input.note ?? null,
      });

      // Audit log
      await logMilkAudit({
        action: "reception_rejected",
        workerId: worker.workerId,
        entityType: "reception",
        entityId: receptionResult.insertId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          milkType: input.milkType,
          reason: input.rejectionReason,
          rejectedVolumeMl: rejectedVolume,
        }),
      });

      // ─── Update session status if all milk types are now processed ───
      await updateSessionStatusIfComplete(db, input.sessionId, session, worker.workerId);

      return { receptionId: receptionResult.insertId, milkType: input.milkType };
    }),

  /**
   * Cheesemaker's reception history.
   */
  myReceptions: publicProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(50).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const worker = requireCheesemaker(ctx.req);
      const db = await getDb();

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkReceptions)
        .where(eq(milkReceptions.receivedByWorkerId, worker.workerId));

      const receptions = await db
        .select({
          id: milkReceptions.id,
          sessionId: milkReceptions.sessionId,
          milkType: milkReceptions.milkType,
          acceptedVolumeMl: milkReceptions.acceptedVolumeMl,
          rejectedVolumeMl: milkReceptions.rejectedVolumeMl,
          status: milkReceptions.status,
          rejectionReason: milkReceptions.rejectionReason,
          note: milkReceptions.note,
          createdAt: milkReceptions.createdAt,
          sessionCode: milkSessions.sessionCode,
          milkingDate: milkSessions.milkingDate,
          shift: milkSessions.shift,
        })
        .from(milkReceptions)
        .leftJoin(milkSessions, eq(milkReceptions.sessionId, milkSessions.id))
        .where(eq(milkReceptions.receivedByWorkerId, worker.workerId))
        .orderBy(desc(milkReceptions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        receptions: receptions.map((r: any) => ({
          id: r.id,
          sessionId: r.sessionId,
          sessionCode: r.sessionCode ?? "—",
          milkingDate: r.milkingDate ?? "—",
          shift: r.shift ?? "morning",
          milkType: r.milkType,
          milkTypeLabel: MILK_TYPE_LABELS[r.milkType] ?? r.milkType,
          acceptedVolumeMl: r.acceptedVolumeMl,
          acceptedVolumeLiters: +(r.acceptedVolumeMl / 1000).toFixed(2),
          rejectedVolumeMl: r.rejectedVolumeMl,
          status: r.status,
          rejectionReason: r.rejectionReason,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        })),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Export data: all receptions in a date range (no pagination, max 5000).
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
      requireCheesemaker(ctx.req);
      const db = await getDb();

      const fromDate = new Date(input.dateFrom + "T00:00:00");
      const toDate = new Date(input.dateTo + "T23:59:59");

      const receptions = await db
        .select({
          id: milkReceptions.id,
          sessionId: milkReceptions.sessionId,
          milkType: milkReceptions.milkType,
          acceptedVolumeMl: milkReceptions.acceptedVolumeMl,
          rejectedVolumeMl: milkReceptions.rejectedVolumeMl,
          status: milkReceptions.status,
          rejectionReason: milkReceptions.rejectionReason,
          note: milkReceptions.note,
          createdAt: milkReceptions.createdAt,
          sessionCode: milkSessions.sessionCode,
          milkingDate: milkSessions.milkingDate,
          shift: milkSessions.shift,
        })
        .from(milkReceptions)
        .leftJoin(milkSessions, eq(milkReceptions.sessionId, milkSessions.id))
        .where(
          and(
            sql`${milkReceptions.createdAt} >= ${fromDate}`,
            sql`${milkReceptions.createdAt} <= ${toDate}`,
          ),
        )
        .orderBy(desc(milkReceptions.createdAt))
        .limit(5000);

      // Tank movements in the same period
      const movements = await db
        .select({
          id: milkTankMovements.id,
          tankId: milkTankMovements.tankId,
          movementType: milkTankMovements.movementType,
          volumeMl: milkTankMovements.volumeMl,
          tankVolumeAfterMl: milkTankMovements.tankVolumeAfterMl,
          note: milkTankMovements.note,
          createdAt: milkTankMovements.createdAt,
          tankName: milkTanks.name,
          milkType: milkTanks.milkType,
        })
        .from(milkTankMovements)
        .leftJoin(milkTanks, eq(milkTankMovements.tankId, milkTanks.id))
        .where(
          and(
            sql`${milkTankMovements.createdAt} >= ${fromDate}`,
            sql`${milkTankMovements.createdAt} <= ${toDate}`,
          ),
        )
        .orderBy(desc(milkTankMovements.createdAt))
        .limit(5000);

      return {
        receptions: receptions.map((r: any) => ({
          id: r.id,
          sessionCode: r.sessionCode ?? "—",
          milkingDate: r.milkingDate ?? "—",
          shift: r.shift ?? "morning",
          milkType: r.milkType,
          milkTypeLabel: MILK_TYPE_LABELS[r.milkType] ?? r.milkType,
          acceptedVolumeMl: r.acceptedVolumeMl,
          acceptedVolumeLiters: +(r.acceptedVolumeMl / 1000).toFixed(2),
          rejectedVolumeMl: r.rejectedVolumeMl,
          rejectedVolumeLiters: +(r.rejectedVolumeMl / 1000).toFixed(2),
          status: r.status,
          rejectionReason: r.rejectionReason,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        })),
        movements: movements.map((m: any) => ({
          id: m.id,
          tankName: m.tankName ?? `Танк #${m.tankId}`,
          milkType: m.milkType ?? "unknown",
          milkTypeLabel: MILK_TYPE_LABELS[m.milkType] ?? m.milkType,
          movementType: m.movementType,
          volumeMl: m.volumeMl,
          volumeLiters: +(m.volumeMl / 1000).toFixed(2),
          tankVolumeAfterMl: m.tankVolumeAfterMl,
          tankVolumeAfterLiters: +(m.tankVolumeAfterMl / 1000).toFixed(2),
          note: m.note,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    }),
});

// ─── Milk Tank Router ───────────────────────────────────────

export const milkTankRouter = router({
  /**
   * List all tanks (includes milkType).
   */
  list: publicProcedure.query(async ({ ctx }) => {
    requireFarmWorker(ctx.req);
    const db = await getDb();

    const tanks = await db
      .select()
      .from(milkTanks)
      .orderBy(milkTanks.milkType, milkTanks.name);

    return tanks.map((t: any) => ({
      id: t.id,
      name: t.name,
      milkType: t.milkType,
      milkTypeLabel: MILK_TYPE_LABELS[t.milkType] ?? t.milkType,
      capacityMl: t.capacityMl,
      capacityLiters: +(t.capacityMl / 1000).toFixed(2),
      currentVolumeMl: t.currentVolumeMl,
      currentVolumeLiters: +(t.currentVolumeMl / 1000).toFixed(2),
      fillPercent: t.capacityMl > 0 ? Math.round((t.currentVolumeMl / t.capacityMl) * 100) : 0,
      status: t.status,
      location: t.location,
      isActive: t.isActive,
    }));
  }),

  /**
   * Create a new tank (admin only via site auth). Must specify milkType.
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        milkType: z.enum(["goat", "sheep", "cow"]),
        capacityMl: z.number().int().positive().max(100_000_000),
        location: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [result] = await db.insert(milkTanks).values({
        name: input.name,
        milkType: input.milkType,
        capacityMl: input.capacityMl,
        location: input.location ?? null,
      });
      return { id: result.insertId, name: input.name, milkType: input.milkType };
    }),

  /**
   * Update tank status (cheesemaker).
   */
  updateStatus: publicProcedure
    .input(
      z.object({
        tankId: z.number().int().positive(),
        status: z.enum(["empty", "filling", "full", "processing", "cleaning"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      requireCheesemaker(ctx.req);
      const db = await getDb();

      const updates: Record<string, any> = { status: input.status };
      if (input.status === "empty") {
        updates.currentVolumeMl = 0;
      }

      await db
        .update(milkTanks)
        .set(updates)
        .where(eq(milkTanks.id, input.tankId));

      return { success: true };
    }),

  /**
   * Drain/empty a tank (cheesemaker).
   * Transfer only allowed between tanks of the same milkType.
   */
  drain: publicProcedure
    .input(
      z.object({
        tankId: z.number().int().positive(),
        volumeMl: z.number().int().positive(),
        reason: z.enum(["processing_out", "waste", "sample", "transfer"]),
        targetTankId: z.number().int().positive().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const worker = requireCheesemaker(ctx.req);
      const db = await getDb();

      const [tank] = await db
        .select()
        .from(milkTanks)
        .where(eq(milkTanks.id, input.tankId))
        .limit(1);

      if (!tank) throw new TRPCError({ code: "NOT_FOUND", message: "Танк не найден" });

      if (input.volumeMl > tank.currentVolumeMl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `В танке только ${(tank.currentVolumeMl / 1000).toFixed(1)} л`,
        });
      }

      const newVolume = tank.currentVolumeMl - input.volumeMl;

      await db
        .update(milkTanks)
        .set({
          currentVolumeMl: newVolume,
          status: newVolume === 0 ? "empty" : "filling",
        })
        .where(eq(milkTanks.id, input.tankId));

      // Log movement
      await db.insert(milkTankMovements).values({
        tankId: input.tankId,
        movementType: input.reason,
        volumeMl: -input.volumeMl,
        tankVolumeAfterMl: newVolume,
        targetTankId: input.targetTankId ?? null,
        performedByWorkerId: worker.workerId,
        note: input.note ?? null,
      });

      // If transfer, validate same milkType and add to target tank
      if (input.reason === "transfer" && input.targetTankId) {
        const [targetTank] = await db
          .select()
          .from(milkTanks)
          .where(eq(milkTanks.id, input.targetTankId))
          .limit(1);

        if (!targetTank) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Целевой танк не найден" });
        }

        if (targetTank.milkType !== tank.milkType) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Нельзя перелить ${MILK_TYPE_LABELS[tank.milkType]} молоко в танк для ${MILK_TYPE_LABELS[targetTank.milkType]}`,
          });
        }

        const targetNewVolume = targetTank.currentVolumeMl + input.volumeMl;
        await db
          .update(milkTanks)
          .set({
            currentVolumeMl: targetNewVolume,
            status: targetNewVolume >= targetTank.capacityMl ? "full" : "filling",
          })
          .where(eq(milkTanks.id, input.targetTankId));

        await db.insert(milkTankMovements).values({
          tankId: input.targetTankId,
          movementType: "milking_in",
          volumeMl: input.volumeMl,
          tankVolumeAfterMl: targetNewVolume,
          performedByWorkerId: worker.workerId,
          note: `Перелив из ${tank.name}`,
        });
      }

      await logMilkAudit({
        action: "tank_movement",
        workerId: worker.workerId,
        entityType: "tank",
        entityId: input.tankId,
        detailsJson: JSON.stringify({
          type: input.reason,
          milkType: tank.milkType,
          volumeMl: input.volumeMl,
          newVolumeMl: newVolume,
        }),
      });

      return { newVolumeMl: newVolume, newVolumeLiters: +(newVolume / 1000).toFixed(2) };
    }),
});
