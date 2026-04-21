/**
 * Milk Reception & Tank Management tRPC Router.
 *
 * Provides cheesemaker ARM endpoints:
 * - milkReception.pendingSessions — sessions awaiting reception
 * - milkReception.accept — accept milk from a session
 * - milkReception.reject — reject milk from a session
 * - milkReception.myReceptions — cheesemaker's reception history
 * - milkTank.list — list all tanks
 * - milkTank.create — create a new tank (admin)
 * - milkTank.updateStatus — change tank status
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
import { eq, and, desc, sql, inArray, ne } from "drizzle-orm";

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

// ─── Milk Reception Router ──────────────────────────────────

export const milkReceptionRouter = router({
  /**
   * Get sessions that are pending_confirm and not yet received.
   */
  pendingSessions: publicProcedure.query(async ({ ctx }) => {
    requireCheesemaker(ctx.req);
    const db = await getDb();

    // Get sessions that have status pending_confirm or confirmed
    // and don't have an accepted reception yet
    const sessions = await db
      .select({
        id: milkSessions.id,
        sessionCode: milkSessions.sessionCode,
        workerId: milkSessions.workerId,
        milkingDate: milkSessions.milkingDate,
        shift: milkSessions.shift,
        totalVolumeMl: milkSessions.totalVolumeMl,
        goatHeadCount: milkSessions.goatHeadCount,
        sheepHeadCount: milkSessions.sheepHeadCount,
        temperatureTenths: milkSessions.temperatureTenths,
        densityThousandths: milkSessions.densityThousandths,
        note: milkSessions.note,
        status: milkSessions.status,
        createdAt: milkSessions.createdAt,
        workerName: farmWorkers.name,
      })
      .from(milkSessions)
      .leftJoin(farmWorkers, eq(milkSessions.workerId, farmWorkers.id))
      .where(
        and(
          inArray(milkSessions.status, ["pending_confirm", "confirmed"]),
        ),
      )
      .orderBy(desc(milkSessions.createdAt))
      .limit(50);

    // Filter out sessions that already have accepted receptions
    const sessionIds = sessions.map((s: any) => s.id);
    let acceptedSessionIds: Set<number> = new Set();

    if (sessionIds.length > 0) {
      const accepted = await db
        .select({ sessionId: milkReceptions.sessionId })
        .from(milkReceptions)
        .where(
          and(
            inArray(milkReceptions.sessionId, sessionIds),
            eq(milkReceptions.status, "accepted"),
          ),
        );
      acceptedSessionIds = new Set(accepted.map((a: any) => a.sessionId));
    }

    return sessions
      .filter((s: any) => !acceptedSessionIds.has(s.id))
      .map((s: any) => ({
        id: s.id,
        sessionCode: s.sessionCode,
        workerId: s.workerId,
        workerName: s.workerName ?? "—",
        milkingDate: s.milkingDate,
        shift: s.shift,
        totalVolumeMl: s.totalVolumeMl,
        totalVolumeLiters: +(s.totalVolumeMl / 1000).toFixed(2),
        goatHeadCount: s.goatHeadCount,
        sheepHeadCount: s.sheepHeadCount,
        temperatureCelsius: s.temperatureTenths != null ? +(s.temperatureTenths / 10).toFixed(1) : null,
        densityGCm3: s.densityThousandths != null ? +(s.densityThousandths / 1000).toFixed(3) : null,
        note: s.note,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
      }));
  }),

  /**
   * Accept milk from a session.
   */
  accept: publicProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
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

      // Verify tank exists and is active
      const [tank] = await db
        .select()
        .from(milkTanks)
        .where(eq(milkTanks.id, input.targetTankId))
        .limit(1);

      if (!tank || !tank.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Танк не найден или неактивен" });
      }

      // Check tank capacity
      const newVolume = tank.currentVolumeMl + input.acceptedVolumeMl;
      if (newVolume > tank.capacityMl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Недостаточно места в танке. Свободно: ${((tank.capacityMl - tank.currentVolumeMl) / 1000).toFixed(1)} л`,
        });
      }

      // Check no existing accepted reception for this session
      const [existingReception] = await db
        .select({ id: milkReceptions.id })
        .from(milkReceptions)
        .where(
          and(
            eq(milkReceptions.sessionId, input.sessionId),
            eq(milkReceptions.status, "accepted"),
          ),
        )
        .limit(1);

      if (existingReception) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Молоко из этой дойки уже принято",
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
        note: `Приёмка из ${session.sessionCode}`,
      });

      // Audit log
      await logMilkAudit({
        action: "reception_accepted",
        workerId: worker.workerId,
        entityType: "reception",
        entityId: receptionResult.insertId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          acceptedVolumeMl: input.acceptedVolumeMl,
          rejectedVolumeMl: input.rejectedVolumeMl,
          targetTankId: input.targetTankId,
        }),
      });

      return {
        receptionId: receptionResult.insertId,
        tankNewVolumeMl: newVolume,
        tankNewVolumeLiters: +(newVolume / 1000).toFixed(2),
      };
    }),

  /**
   * Reject milk from a session.
   */
  reject: publicProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
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

      const [receptionResult] = await db.insert(milkReceptions).values({
        sessionId: input.sessionId,
        receivedByWorkerId: worker.workerId,
        acceptedVolumeMl: 0,
        rejectedVolumeMl: session.totalVolumeMl,
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
          reason: input.rejectionReason,
        }),
      });

      return { receptionId: receptionResult.insertId };
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
});

// ─── Milk Tank Router ───────────────────────────────────────

export const milkTankRouter = router({
  /**
   * List all tanks.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    requireFarmWorker(ctx.req);
    const db = await getDb();

    const tanks = await db
      .select()
      .from(milkTanks)
      .orderBy(milkTanks.name);

    return tanks.map((t: any) => ({
      id: t.id,
      name: t.name,
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
   * Create a new tank (admin only via site auth).
   */
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        capacityMl: z.number().int().positive().max(100_000_000),
        location: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [result] = await db.insert(milkTanks).values({
        name: input.name,
        capacityMl: input.capacityMl,
        location: input.location ?? null,
      });
      return { id: result.insertId, name: input.name };
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

      // If setting to empty, reset volume
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

      // If transfer, add to target tank
      if (input.reason === "transfer" && input.targetTankId) {
        const [targetTank] = await db
          .select()
          .from(milkTanks)
          .where(eq(milkTanks.id, input.targetTankId))
          .limit(1);

        if (targetTank) {
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
      }

      await logMilkAudit({
        action: "tank_movement",
        workerId: worker.workerId,
        entityType: "tank",
        entityId: input.tankId,
        detailsJson: JSON.stringify({
          type: input.reason,
          volumeMl: input.volumeMl,
          newVolumeMl: newVolume,
        }),
      });

      return { newVolumeMl: newVolume, newVolumeLiters: +(newVolume / 1000).toFixed(2) };
    }),
});
