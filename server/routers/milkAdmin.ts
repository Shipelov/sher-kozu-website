/**
 * Milk Admin Dashboard tRPC Router.
 *
 * Milk is tracked SEPARATELY by animal type (goat/sheep/cow).
 * Stats show per-type breakdown.
 *
 * Endpoints:
 * - milkAdmin.overview — summary stats (today, week, month) with per-type breakdown
 * - milkAdmin.sessions — paginated session list with per-type volumes
 * - milkAdmin.receptions — paginated reception log with milkType
 * - milkAdmin.auditLog — paginated audit log
 * - milkAdmin.tanks — tank management (CRUD, status, milkType)
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

const MILK_TYPE_LABELS: Record<string, string> = {
  goat: "Козье",
  sheep: "Овечье",
  cow: "Коровье",
};

export const milkAdminRouter = router({
  /**
   * Dashboard overview: today / week / month stats with per-type breakdown.
   */
  overview: adminProcedure.query(async () => {
    const db = await getDb();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    // Sessions count & per-type volumes
    const [todayStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        goatMl: sql<number>`COALESCE(SUM(${milkSessions.goatVolumeMl}), 0)`,
        sheepMl: sql<number>`COALESCE(SUM(${milkSessions.sheepVolumeMl}), 0)`,
        cowMl: sql<number>`COALESCE(SUM(${milkSessions.cowVolumeMl}), 0)`,
        goatHeads: sql<number>`COALESCE(SUM(${milkSessions.goatHeadCount}), 0)`,
        sheepHeads: sql<number>`COALESCE(SUM(${milkSessions.sheepHeadCount}), 0)`,
        cowHeads: sql<number>`COALESCE(SUM(${milkSessions.cowHeadCount}), 0)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, todayStart));

    const [weekStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        goatMl: sql<number>`COALESCE(SUM(${milkSessions.goatVolumeMl}), 0)`,
        sheepMl: sql<number>`COALESCE(SUM(${milkSessions.sheepVolumeMl}), 0)`,
        cowMl: sql<number>`COALESCE(SUM(${milkSessions.cowVolumeMl}), 0)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, weekStart));

    const [monthStats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        goatMl: sql<number>`COALESCE(SUM(${milkSessions.goatVolumeMl}), 0)`,
        sheepMl: sql<number>`COALESCE(SUM(${milkSessions.sheepVolumeMl}), 0)`,
        cowMl: sql<number>`COALESCE(SUM(${milkSessions.cowVolumeMl}), 0)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, monthStart));

    // Pending sessions
    const [pendingCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(milkSessions)
      .where(eq(milkSessions.status, "pending_confirm"));

    // Receptions today (per type)
    const [receptionToday] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        acceptedMl: sql<number>`COALESCE(SUM(${milkReceptions.acceptedVolumeMl}), 0)`,
        rejectedMl: sql<number>`COALESCE(SUM(${milkReceptions.rejectedVolumeMl}), 0)`,
      })
      .from(milkReceptions)
      .where(gte(milkReceptions.createdAt, todayStart));

    // Tank summary per type
    const tanksByType = await db
      .select({
        milkType: milkTanks.milkType,
        totalCapacityMl: sql<number>`COALESCE(SUM(${milkTanks.capacityMl}), 0)`,
        totalCurrentMl: sql<number>`COALESCE(SUM(${milkTanks.currentVolumeMl}), 0)`,
        activeTanks: sql<number>`SUM(CASE WHEN ${milkTanks.isActive} = true THEN 1 ELSE 0 END)`,
        totalTanks: sql<number>`COUNT(*)`,
      })
      .from(milkTanks)
      .groupBy(milkTanks.milkType);

    const tankSummary: Record<string, any> = {};
    let totalCapacity = 0;
    let totalCurrent = 0;
    let totalActive = 0;
    let totalTanks = 0;

    for (const row of tanksByType) {
      const cap = Number(row.totalCapacityMl);
      const cur = Number(row.totalCurrentMl);
      const act = Number(row.activeTanks);
      const tot = Number(row.totalTanks);
      tankSummary[row.milkType] = {
        capacityLiters: +(cap / 1000).toFixed(2),
        currentLiters: +(cur / 1000).toFixed(2),
        fillPercent: cap > 0 ? Math.round((cur / cap) * 100) : 0,
        active: act,
        total: tot,
      };
      totalCapacity += cap;
      totalCurrent += cur;
      totalActive += act;
      totalTanks += tot;
    }

    const formatPerType = (goatMl: any, sheepMl: any, cowMl: any) => ({
      goatLiters: +(Number(goatMl) / 1000).toFixed(2),
      sheepLiters: +(Number(sheepMl) / 1000).toFixed(2),
      cowLiters: +(Number(cowMl) / 1000).toFixed(2),
      totalLiters: +((Number(goatMl) + Number(sheepMl) + Number(cowMl)) / 1000).toFixed(2),
    });

    return {
      today: {
        sessions: Number(todayStats.count),
        volume: formatPerType(todayStats.goatMl, todayStats.sheepMl, todayStats.cowMl),
        goatHeads: Number(todayStats.goatHeads),
        sheepHeads: Number(todayStats.sheepHeads),
        cowHeads: Number(todayStats.cowHeads),
      },
      week: {
        sessions: Number(weekStats.count),
        volume: formatPerType(weekStats.goatMl, weekStats.sheepMl, weekStats.cowMl),
      },
      month: {
        sessions: Number(monthStats.count),
        volume: formatPerType(monthStats.goatMl, monthStats.sheepMl, monthStats.cowMl),
      },
      pendingSessions: Number(pendingCount.count),
      receptionToday: {
        count: Number(receptionToday.count),
        acceptedLiters: +(Number(receptionToday.acceptedMl) / 1000).toFixed(2),
        rejectedLiters: +(Number(receptionToday.rejectedMl) / 1000).toFixed(2),
      },
      tanks: {
        total: totalTanks,
        active: totalActive,
        capacityLiters: +(totalCapacity / 1000).toFixed(2),
        currentLiters: +(totalCurrent / 1000).toFixed(2),
        fillPercent: totalCapacity > 0 ? Math.round((totalCurrent / totalCapacity) * 100) : 0,
        byType: tankSummary,
      },
    };
  }),

  /**
   * Paginated session list with per-type volumes.
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
          goatVolumeMl: milkSessions.goatVolumeMl,
          goatHeadCount: milkSessions.goatHeadCount,
          sheepVolumeMl: milkSessions.sheepVolumeMl,
          sheepHeadCount: milkSessions.sheepHeadCount,
          cowVolumeMl: milkSessions.cowVolumeMl,
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
        sessions: sessions.map((s: any) => {
          const totalMl = s.goatVolumeMl + s.sheepVolumeMl + s.cowVolumeMl;
          return {
            id: s.id,
            sessionCode: s.sessionCode,
            workerId: s.workerId,
            workerName: s.workerName ?? "—",
            milkingDate: s.milkingDate,
            shift: s.shift,
            goat: { volumeLiters: +(s.goatVolumeMl / 1000).toFixed(2), headCount: s.goatHeadCount },
            sheep: { volumeLiters: +(s.sheepVolumeMl / 1000).toFixed(2), headCount: s.sheepHeadCount },
            cow: { volumeLiters: +(s.cowVolumeMl / 1000).toFixed(2), headCount: s.cowHeadCount },
            totalVolumeLiters: +(totalMl / 1000).toFixed(2),
            temperatureCelsius:
              s.temperatureTenths != null ? +(s.temperatureTenths / 10).toFixed(1) : null,
            densityGCm3:
              s.densityThousandths != null ? +(s.densityThousandths / 1000).toFixed(3) : null,
            note: s.note,
            status: s.status,
            createdAt: s.createdAt.toISOString(),
            confirmedAt: s.confirmedAt?.toISOString() ?? null,
          };
        }),
        total: Number(countResult.count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Paginated reception log with milkType.
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
          milkType: milkReceptions.milkType,
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
          milkType: r.milkType,
          milkTypeLabel: MILK_TYPE_LABELS[r.milkType] ?? r.milkType,
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
   * Tank list with full details for admin (includes milkType).
   */
  tanks: adminProcedure.query(async () => {
    const db = await getDb();
    const tanks = await db.select().from(milkTanks).orderBy(milkTanks.milkType, milkTanks.name);

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
      createdAt: t.createdAt.toISOString(),
    }));
  }),

  /**
   * Create a new tank (must specify milkType).
   */
  createTank: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(120),
        milkType: z.enum(["goat", "sheep", "cow"]),
        capacityLiters: z.number().positive().max(100_000),
        location: z.string().max(120).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const [result] = await db.insert(milkTanks).values({
        name: input.name,
        milkType: input.milkType,
        capacityMl: Math.round(input.capacityLiters * 1000),
        location: input.location ?? null,
      });
      return { id: result.insertId, name: input.name, milkType: input.milkType };
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
