/**
 * Milk Admin Dashboard tRPC Router.
 *
 * Provides admin-level endpoints for the milk module:
 * - milkAdmin.overview — summary stats (today, week, month)
 * - milkAdmin.sessions — paginated session list with filters
 * - milkAdmin.receptions — paginated reception log
 * - milkAdmin.auditLog — paginated audit log
 * - milkAdmin.tanks — tank management (CRUD, status)
 */

import { z } from "zod";
import { router } from "../_core/trpc";
import { adminProcedure } from "../_core/trpc";
import {
  milkSessions,
  milkReceptions,
  milkTanks,
  milkTankMovements,
  milkAuditLog,
  farmWorkers,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, and, gte, lte, desc, sql, like } from "drizzle-orm";

export const milkAdminRouter = router({
  /**
   * Dashboard overview: today / week / month stats.
   */
  overview: adminProcedure.query(async () => {
    const db = await getDb();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    // Sessions count & volume
    const [todayStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalMl: sql<number>`COALESCE(SUM(${milkSessions.totalVolumeMl}), 0)`,
        goatHeads: sql<number>`COALESCE(SUM(${milkSessions.goatHeadCount}), 0)`,
        sheepHeads: sql<number>`COALESCE(SUM(${milkSessions.sheepHeadCount}), 0)`,
        cowHeads: sql<number>`COALESCE(SUM(${milkSessions.cowHeadCount}), 0)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, todayStart));

    const [weekStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalMl: sql<number>`COALESCE(SUM(${milkSessions.totalVolumeMl}), 0)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, weekStart));

    const [monthStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalMl: sql<number>`COALESCE(SUM(${milkSessions.totalVolumeMl}), 0)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, monthStart));

    // Pending sessions
    const [pendingCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(milkSessions)
      .where(eq(milkSessions.status, "pending_confirm"));

    // Receptions today
    const [receptionToday] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        acceptedMl: sql<number>`COALESCE(SUM(${milkReceptions.acceptedVolumeMl}), 0)`,
        rejectedMl: sql<number>`COALESCE(SUM(${milkReceptions.rejectedVolumeMl}), 0)`,
      })
      .from(milkReceptions)
      .where(gte(milkReceptions.createdAt, todayStart));

    // Tank summary
    const tanks = await db
      .select({
        totalCapacityMl: sql<number>`COALESCE(SUM(${milkTanks.capacityMl}), 0)`,
        totalCurrentMl: sql<number>`COALESCE(SUM(${milkTanks.currentVolumeMl}), 0)`,
        activeTanks: sql<number>`SUM(CASE WHEN ${milkTanks.isActive} = true THEN 1 ELSE 0 END)`,
        totalTanks: sql<number>`COUNT(*)`,
      })
      .from(milkTanks);

    const tankSummary = tanks[0] ?? {
      totalCapacityMl: 0,
      totalCurrentMl: 0,
      activeTanks: 0,
      totalTanks: 0,
    };

    return {
      today: {
        sessions: Number(todayStats.count),
        volumeLiters: +(Number(todayStats.totalMl) / 1000).toFixed(2),
        goatHeads: Number(todayStats.goatHeads),
        sheepHeads: Number(todayStats.sheepHeads),
        cowHeads: Number(todayStats.cowHeads),
      },
      week: {
        sessions: Number(weekStats.count),
        volumeLiters: +(Number(weekStats.totalMl) / 1000).toFixed(2),
      },
      month: {
        sessions: Number(monthStats.count),
        volumeLiters: +(Number(monthStats.totalMl) / 1000).toFixed(2),
      },
      pendingSessions: Number(pendingCount.count),
      receptionToday: {
        count: Number(receptionToday.count),
        acceptedLiters: +(Number(receptionToday.acceptedMl) / 1000).toFixed(2),
        rejectedLiters: +(Number(receptionToday.rejectedMl) / 1000).toFixed(2),
      },
      tanks: {
        total: Number(tankSummary.totalTanks),
        active: Number(tankSummary.activeTanks),
        capacityLiters: +(Number(tankSummary.totalCapacityMl) / 1000).toFixed(2),
        currentLiters: +(Number(tankSummary.totalCurrentMl) / 1000).toFixed(2),
        fillPercent:
          Number(tankSummary.totalCapacityMl) > 0
            ? Math.round(
                (Number(tankSummary.totalCurrentMl) / Number(tankSummary.totalCapacityMl)) * 100,
              )
            : 0,
      },
    };
  }),

  /**
   * Paginated session list with optional status filter.
   */
  sessions: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
        status: z
          .enum(["in_progress", "pending_confirm", "confirmed", "disputed"])
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input.status) {
        conditions.push(eq(milkSessions.status, input.status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkSessions)
        .where(whereClause);

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
          cowHeadCount: milkSessions.cowHeadCount,
          temperatureTenths: milkSessions.temperatureTenths,
          densityThousandths: milkSessions.densityThousandths,
          note: milkSessions.note,
          status: milkSessions.status,
          createdAt: milkSessions.createdAt,
          confirmedAt: milkSessions.confirmedAt,
          workerName: farmWorkers.name,
        })
        .from(milkSessions)
        .leftJoin(farmWorkers, eq(milkSessions.workerId, farmWorkers.id))
        .where(whereClause)
        .orderBy(desc(milkSessions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        sessions: sessions.map((s: any) => ({
          id: s.id,
          sessionCode: s.sessionCode,
          workerId: s.workerId,
          workerName: s.workerName ?? "—",
          milkingDate: s.milkingDate,
          shift: s.shift,
          totalVolumeLiters: +(s.totalVolumeMl / 1000).toFixed(2),
          goatHeadCount: s.goatHeadCount,
          sheepHeadCount: s.sheepHeadCount,
          cowHeadCount: s.cowHeadCount,
          temperatureCelsius:
            s.temperatureTenths != null ? +(s.temperatureTenths / 10).toFixed(1) : null,
          densityGCm3:
            s.densityThousandths != null ? +(s.densityThousandths / 1000).toFixed(3) : null,
          note: s.note,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          confirmedAt: s.confirmedAt?.toISOString() ?? null,
        })),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Paginated reception log.
   */
  receptions: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkReceptions);

      const receptions = await db
        .select({
          id: milkReceptions.id,
          sessionId: milkReceptions.sessionId,
          receivedByWorkerId: milkReceptions.receivedByWorkerId,
          acceptedVolumeMl: milkReceptions.acceptedVolumeMl,
          rejectedVolumeMl: milkReceptions.rejectedVolumeMl,
          status: milkReceptions.status,
          rejectionReason: milkReceptions.rejectionReason,
          targetTankId: milkReceptions.targetTankId,
          note: milkReceptions.note,
          createdAt: milkReceptions.createdAt,
          sessionCode: milkSessions.sessionCode,
          receiverName: farmWorkers.name,
        })
        .from(milkReceptions)
        .leftJoin(milkSessions, eq(milkReceptions.sessionId, milkSessions.id))
        .leftJoin(farmWorkers, eq(milkReceptions.receivedByWorkerId, farmWorkers.id))
        .orderBy(desc(milkReceptions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        receptions: receptions.map((r: any) => ({
          id: r.id,
          sessionId: r.sessionId,
          sessionCode: r.sessionCode ?? "—",
          receiverName: r.receiverName ?? "—",
          acceptedVolumeLiters: +(r.acceptedVolumeMl / 1000).toFixed(2),
          rejectedVolumeLiters: +(r.rejectedVolumeMl / 1000).toFixed(2),
          status: r.status,
          rejectionReason: r.rejectionReason,
          targetTankId: r.targetTankId,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        })),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Tank list with full details for admin.
   */
  tanks: adminProcedure.query(async () => {
    const db = await getDb();
    const tanks = await db.select().from(milkTanks).orderBy(milkTanks.name);

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
      createdAt: t.createdAt.toISOString(),
    }));
  }),

  /**
   * Create a new tank.
   */
  createTank: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        capacityLiters: z.number().positive().max(100_000),
        location: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [result] = await db.insert(milkTanks).values({
        name: input.name,
        capacityMl: Math.round(input.capacityLiters * 1000),
        location: input.location ?? null,
      });
      return { id: result.insertId, name: input.name };
    }),

  /**
   * Toggle tank active status.
   */
  toggleTank: adminProcedure
    .input(z.object({ tankId: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db
        .update(milkTanks)
        .set({ isActive: input.isActive })
        .where(eq(milkTanks.id, input.tankId));
      return { success: true };
    }),

  /**
   * Audit log (paginated).
   */
  auditLog: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(30),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkAuditLog);

      const logs = await db
        .select({
          id: milkAuditLog.id,
          action: milkAuditLog.action,
          workerId: milkAuditLog.workerId,
          entityType: milkAuditLog.entityType,
          entityId: milkAuditLog.entityId,
          detailsJson: milkAuditLog.detailsJson,
          createdAt: milkAuditLog.createdAt,
          workerName: farmWorkers.name,
        })
        .from(milkAuditLog)
        .leftJoin(farmWorkers, eq(milkAuditLog.workerId, farmWorkers.id))
        .orderBy(desc(milkAuditLog.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        logs: logs.map((l: any) => ({
          id: l.id,
          action: l.action,
          workerId: l.workerId,
          workerName: l.workerName ?? "Система",
          entityType: l.entityType,
          entityId: l.entityId,
          details: l.detailsJson ? JSON.parse(l.detailsJson) : null,
          createdAt: l.createdAt.toISOString(),
        })),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),
});
