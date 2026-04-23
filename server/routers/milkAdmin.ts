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
import { TRPCError } from "@trpc/server";
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
import { logMilkAudit } from "../farmAuth";
import { eq, and, gte, lte, desc, sql, like, inArray } from "drizzle-orm";

const MILK_TYPE_LABELS: Record<string, string> = {
  goat: "Козье",
  sheep: "Овечье",
  cow: "Коровье",
};

export const milkAdminRouter = router({
  /**
   * Dashboard overview: today / week / month stats with per-type breakdown.
   * Optionally accepts a custom date range for the "custom" period.
   */
  overview: adminProcedure
    .input(
      z.object({
        customFrom: z.string().optional(),
        customTo: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
    const db = await getDb();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    // Full per-type stats selection (reusable)
    const fullStatsSelect = {
      count: sql<number>`COUNT(*)`,
      goatMl: sql<number>`COALESCE(SUM(${milkSessions.goatVolumeMl}), 0)`,
      sheepMl: sql<number>`COALESCE(SUM(${milkSessions.sheepVolumeMl}), 0)`,
      cowMl: sql<number>`COALESCE(SUM(${milkSessions.cowVolumeMl}), 0)`,
      goatHeads: sql<number>`COALESCE(SUM(${milkSessions.goatHeadCount}), 0)`,
      sheepHeads: sql<number>`COALESCE(SUM(${milkSessions.sheepHeadCount}), 0)`,
      cowHeads: sql<number>`COALESCE(SUM(${milkSessions.cowHeadCount}), 0)`,
      goatFeedingMl: sql<number>`COALESCE(SUM(COALESCE(${milkSessions.goatFeedingMl},0)), 0)`,
      sheepFeedingMl: sql<number>`COALESCE(SUM(COALESCE(${milkSessions.sheepFeedingMl},0)), 0)`,
      cowFeedingMl: sql<number>`COALESCE(SUM(COALESCE(${milkSessions.cowFeedingMl},0)), 0)`,
      goatLossesMl: sql<number>`COALESCE(SUM(COALESCE(${milkSessions.goatLossesMl},0)), 0)`,
      sheepLossesMl: sql<number>`COALESCE(SUM(COALESCE(${milkSessions.sheepLossesMl},0)), 0)`,
      cowLossesMl: sql<number>`COALESCE(SUM(COALESCE(${milkSessions.cowLossesMl},0)), 0)`,
    };

    const [todayStats] = await db
      .select(fullStatsSelect)
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, todayStart));

    const [weekStats] = await db
      .select(fullStatsSelect)
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, weekStart));

    const [monthStats] = await db
      .select(fullStatsSelect)
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, monthStart));

    // Per-period reception aggregates (accepted/rejected by milk type)
    const receptionStatsSelect = {
      goatAcceptedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.milkType} = 'goat' AND ${milkReceptions.status} = 'accepted' THEN ${milkReceptions.acceptedVolumeMl} ELSE 0 END), 0)`,
      sheepAcceptedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.milkType} = 'sheep' AND ${milkReceptions.status} = 'accepted' THEN ${milkReceptions.acceptedVolumeMl} ELSE 0 END), 0)`,
      cowAcceptedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.milkType} = 'cow' AND ${milkReceptions.status} = 'accepted' THEN ${milkReceptions.acceptedVolumeMl} ELSE 0 END), 0)`,
      goatRejectedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.milkType} = 'goat' AND ${milkReceptions.status} = 'rejected' THEN ${milkReceptions.rejectedVolumeMl} ELSE 0 END), 0)`,
      sheepRejectedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.milkType} = 'sheep' AND ${milkReceptions.status} = 'rejected' THEN ${milkReceptions.rejectedVolumeMl} ELSE 0 END), 0)`,
      cowRejectedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.milkType} = 'cow' AND ${milkReceptions.status} = 'rejected' THEN ${milkReceptions.rejectedVolumeMl} ELSE 0 END), 0)`,
    };

    const [todayRec] = await db.select(receptionStatsSelect).from(milkReceptions).where(gte(milkReceptions.createdAt, todayStart));
    const [weekRec] = await db.select(receptionStatsSelect).from(milkReceptions).where(gte(milkReceptions.createdAt, weekStart));
    const [monthRec] = await db.select(receptionStatsSelect).from(milkReceptions).where(gte(milkReceptions.createdAt, monthStart));

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

    /** Build a full per-type breakdown from raw stats row + reception data */
    function formatPeriod(row: typeof todayStats, rec: typeof todayRec) {
      const goat = Number(row.goatMl);
      const sheep = Number(row.sheepMl);
      const cow = Number(row.cowMl);
      const gf = Number(row.goatFeedingMl);
      const sf = Number(row.sheepFeedingMl);
      const cf = Number(row.cowFeedingMl);
      const gl = Number(row.goatLossesMl);
      const sl = Number(row.sheepLossesMl);
      const cl = Number(row.cowLossesMl);
      const totalVol = goat + sheep + cow;
      const totalFeed = gf + sf + cf;
      const totalLoss = gl + sl + cl;
      const ml2l = (ml: number) => +(ml / 1000).toFixed(2);

      // Reception aggregates
      const ga = Number(rec.goatAcceptedMl);
      const sa = Number(rec.sheepAcceptedMl);
      const ca = Number(rec.cowAcceptedMl);
      const gr = Number(rec.goatRejectedMl);
      const sr = Number(rec.sheepRejectedMl);
      const cr = Number(rec.cowRejectedMl);

      return {
        sessions: Number(row.count),
        total: {
          volumeL: ml2l(totalVol),
          heads: Number(row.goatHeads) + Number(row.sheepHeads) + Number(row.cowHeads),
          feedingL: ml2l(totalFeed),
          lossesL: ml2l(totalLoss),
          netL: ml2l(totalVol - totalFeed - totalLoss),
          acceptedL: ml2l(ga + sa + ca),
          rejectedL: ml2l(gr + sr + cr),
        },
        goat: {
          volumeL: ml2l(goat),
          heads: Number(row.goatHeads),
          feedingL: ml2l(gf),
          lossesL: ml2l(gl),
          netL: ml2l(goat - gf - gl),
          acceptedL: ml2l(ga),
          rejectedL: ml2l(gr),
        },
        sheep: {
          volumeL: ml2l(sheep),
          heads: Number(row.sheepHeads),
          feedingL: ml2l(sf),
          lossesL: ml2l(sl),
          netL: ml2l(sheep - sf - sl),
          acceptedL: ml2l(sa),
          rejectedL: ml2l(sr),
        },
        cow: {
          volumeL: ml2l(cow),
          heads: Number(row.cowHeads),
          feedingL: ml2l(cf),
          lossesL: ml2l(cl),
          netL: ml2l(cow - cf - cl),
          acceptedL: ml2l(ca),
          rejectedL: ml2l(cr),
        },
      };
    }

    // Custom date range query (optional)
    let customPeriod = null;
    if (input?.customFrom && input?.customTo) {
      const customStart = new Date(input.customFrom + "T00:00:00");
      const customEnd = new Date(input.customTo + "T23:59:59");
      const [customStats] = await db
        .select(fullStatsSelect)
        .from(milkSessions)
        .where(and(gte(milkSessions.createdAt, customStart), lte(milkSessions.createdAt, customEnd)));
      const [customRec] = await db.select(receptionStatsSelect).from(milkReceptions)
        .where(and(gte(milkReceptions.createdAt, customStart), lte(milkReceptions.createdAt, customEnd)));
      customPeriod = formatPeriod(customStats, customRec);
    }

    return {
      today: formatPeriod(todayStats, todayRec),
      week: formatPeriod(weekStats, weekRec),
      month: formatPeriod(monthStats, monthRec),
      custom: customPeriod,
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
          goatFeedingMl: milkSessions.goatFeedingMl,
          goatLossesMl: milkSessions.goatLossesMl,
          sheepFeedingMl: milkSessions.sheepFeedingMl,
          sheepLossesMl: milkSessions.sheepLossesMl,
          cowFeedingMl: milkSessions.cowFeedingMl,
          cowLossesMl: milkSessions.cowLossesMl,
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
            goat: {
              volumeLiters: +(s.goatVolumeMl / 1000).toFixed(2),
              headCount: s.goatHeadCount,
              feedingLiters: +((s.goatFeedingMl ?? 0) / 1000).toFixed(2),
              lossesLiters: +((s.goatLossesMl ?? 0) / 1000).toFixed(2),
              netLiters: +((s.goatVolumeMl - (s.goatFeedingMl ?? 0) - (s.goatLossesMl ?? 0)) / 1000).toFixed(2),
            },
            sheep: {
              volumeLiters: +(s.sheepVolumeMl / 1000).toFixed(2),
              headCount: s.sheepHeadCount,
              feedingLiters: +((s.sheepFeedingMl ?? 0) / 1000).toFixed(2),
              lossesLiters: +((s.sheepLossesMl ?? 0) / 1000).toFixed(2),
              netLiters: +((s.sheepVolumeMl - (s.sheepFeedingMl ?? 0) - (s.sheepLossesMl ?? 0)) / 1000).toFixed(2),
            },
            cow: {
              volumeLiters: +(s.cowVolumeMl / 1000).toFixed(2),
              headCount: s.cowHeadCount,
              feedingLiters: +((s.cowFeedingMl ?? 0) / 1000).toFixed(2),
              lossesLiters: +((s.cowLossesMl ?? 0) / 1000).toFixed(2),
              netLiters: +((s.cowVolumeMl - (s.cowFeedingMl ?? 0) - (s.cowLossesMl ?? 0)) / 1000).toFixed(2),
            },
            totalVolumeLiters: +(totalMl / 1000).toFixed(2),
            totalNetLiters: +((totalMl - (s.goatFeedingMl ?? 0) - (s.goatLossesMl ?? 0) - (s.sheepFeedingMl ?? 0) - (s.sheepLossesMl ?? 0) - (s.cowFeedingMl ?? 0) - (s.cowLossesMl ?? 0)) / 1000).toFixed(2),
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
  /**
   * Clear audit log entries older than N days (default 30).
   */
  clearAuditLog: adminProcedure
    .input(
      z.object({
        olderThanDays: z.number().int().min(1).max(365).default(30),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.olderThanDays);
      const [result] = await db
        .delete(milkAuditLog)
        .where(lte(milkAuditLog.createdAt, cutoff));
      return { deleted: (result as any).affectedRows ?? 0 };
    }),

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

  /**
   * Admin: update a milking session (any status).
   * Admin can edit volumes, feeding, losses, shift, note, and status.
   */
  updateSession: adminProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
        shift: z.enum(["morning", "evening"]).optional(),
        goatVolumeMl: z.number().int().min(0).max(500_000).optional(),
        goatHeadCount: z.number().int().min(0).max(500).optional(),
        goatFeedingMl: z.number().int().min(0).max(500_000).optional(),
        goatLossesMl: z.number().int().min(0).max(500_000).optional(),
        sheepVolumeMl: z.number().int().min(0).max(500_000).optional(),
        sheepHeadCount: z.number().int().min(0).max(500).optional(),
        sheepFeedingMl: z.number().int().min(0).max(500_000).optional(),
        sheepLossesMl: z.number().int().min(0).max(500_000).optional(),
        cowVolumeMl: z.number().int().min(0).max(500_000).optional(),
        cowHeadCount: z.number().int().min(0).max(500).optional(),
        cowFeedingMl: z.number().int().min(0).max(500_000).optional(),
        cowLossesMl: z.number().int().min(0).max(500_000).optional(),
        status: z.enum(["in_progress", "pending_confirm", "confirmed", "disputed"]).optional(),
        note: z.string().max(1000).optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      const updates: Record<string, any> = {};

      if (input.shift !== undefined) updates.shift = input.shift;
      if (input.goatVolumeMl !== undefined) updates.goatVolumeMl = input.goatVolumeMl;
      if (input.goatHeadCount !== undefined) updates.goatHeadCount = input.goatHeadCount;
      if (input.goatFeedingMl !== undefined) updates.goatFeedingMl = input.goatFeedingMl;
      if (input.goatLossesMl !== undefined) updates.goatLossesMl = input.goatLossesMl;
      if (input.sheepVolumeMl !== undefined) updates.sheepVolumeMl = input.sheepVolumeMl;
      if (input.sheepHeadCount !== undefined) updates.sheepHeadCount = input.sheepHeadCount;
      if (input.sheepFeedingMl !== undefined) updates.sheepFeedingMl = input.sheepFeedingMl;
      if (input.sheepLossesMl !== undefined) updates.sheepLossesMl = input.sheepLossesMl;
      if (input.cowVolumeMl !== undefined) updates.cowVolumeMl = input.cowVolumeMl;
      if (input.cowHeadCount !== undefined) updates.cowHeadCount = input.cowHeadCount;
      if (input.cowFeedingMl !== undefined) updates.cowFeedingMl = input.cowFeedingMl;
      if (input.cowLossesMl !== undefined) updates.cowLossesMl = input.cowLossesMl;
      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === "confirmed") {
          updates.confirmedAt = new Date();
          updates.confirmedBy = "admin";
        }
      }
      if (input.note !== undefined) updates.note = input.note;

      if (Object.keys(updates).length === 0) {
        return { success: true, message: "Нет изменений" };
      }

      await db.update(milkSessions).set(updates).where(eq(milkSessions.id, input.sessionId));

      await logMilkAudit({
        action: "session_updated",
        adminOpenId: ctx.user?.openId ?? "admin",
        entityType: "session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          adminEdit: true,
          changes: updates,
        }),
      });

      return { success: true, message: "Дойка обновлена админом" };
    }),

  /**
   * Admin: delete a milking session.
   * Also deletes related receptions and reverses tank volumes.
   */
  deleteSession: adminProcedure
    .input(
      z.object({
        sessionId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const [session] = await db
        .select()
        .from(milkSessions)
        .where(eq(milkSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Сессия не найдена" });
      }

      // Find related accepted receptions to reverse tank volumes
      const receptions = await db
        .select()
        .from(milkReceptions)
        .where(eq(milkReceptions.sessionId, input.sessionId));

      // Reverse tank volumes for accepted receptions
      for (const r of receptions) {
        if (r.status === "accepted" && r.targetTankId && r.acceptedVolumeMl > 0) {
          const [tank] = await db
            .select()
            .from(milkTanks)
            .where(eq(milkTanks.id, r.targetTankId))
            .limit(1);

          if (tank) {
            const newVol = Math.max(0, tank.currentVolumeMl - r.acceptedVolumeMl);
            await db
              .update(milkTanks)
              .set({
                currentVolumeMl: newVol,
                status: newVol === 0 ? "empty" : "filling",
              })
              .where(eq(milkTanks.id, r.targetTankId));

            // Log reversal movement
            await db.insert(milkTankMovements).values({
              tankId: r.targetTankId,
              movementType: "waste",
              volumeMl: -r.acceptedVolumeMl,
              tankVolumeAfterMl: newVol,
              performedByWorkerId: r.receivedByWorkerId ?? 0,
              sessionId: input.sessionId,
              receptionId: r.id,
              note: `Отмена приёмки (админ): ${session.sessionCode}`,
            });
          }
        }
      }

      // Delete receptions
      if (receptions.length > 0) {
        await db.delete(milkReceptions).where(eq(milkReceptions.sessionId, input.sessionId));
      }

      // Delete the session
      await db.delete(milkSessions).where(eq(milkSessions.id, input.sessionId));

      // Audit log
      await logMilkAudit({
        action: "session_cancelled",
        adminOpenId: ctx.user?.openId ?? "admin",
        entityType: "session",
        entityId: input.sessionId,
        detailsJson: JSON.stringify({
          sessionCode: session.sessionCode,
          adminDelete: true,
          reversedReceptions: receptions.length,
        }),
      });

      return { success: true, message: `Дойка ${session.sessionCode} удалена` };
    }),

  /**
   * Update reception — admin can edit accepted/rejected volumes, status, note.
   * If volumes change and reception was accepted, adjusts tank volume accordingly.
   */
  updateReception: adminProcedure
    .input(
      z.object({
        receptionId: z.number().int(),
        acceptedVolumeMl: z.number().int().min(0).optional(),
        rejectedVolumeMl: z.number().int().min(0).optional(),
        status: z.enum(["pending", "accepted", "rejected"]).optional(),
        rejectionReason: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const [reception] = await db
        .select()
        .from(milkReceptions)
        .where(eq(milkReceptions.id, input.receptionId))
        .limit(1);

      if (!reception) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Приёмка не найдена" });
      }

      const oldStatus = reception.status;
      const newStatus = input.status ?? oldStatus;
      const oldAcceptedMl = reception.acceptedVolumeMl;
      const newAcceptedMl = input.acceptedVolumeMl ?? oldAcceptedMl;

      // --- Tank volume adjustments ---
      // Case 1: Was accepted, stays accepted — adjust by volume diff
      if (oldStatus === "accepted" && newStatus === "accepted" && reception.targetTankId) {
        const volumeDiffMl = newAcceptedMl - oldAcceptedMl;
        if (volumeDiffMl !== 0) {
          const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, reception.targetTankId)).limit(1);
          if (tank) {
            const newTankVol = Math.max(0, tank.currentVolumeMl + volumeDiffMl);
            await db.update(milkTanks).set({ currentVolumeMl: newTankVol }).where(eq(milkTanks.id, tank.id));
            await db.insert(milkTankMovements).values({
              tankId: tank.id,
              movementType: "adjustment",
              volumeMl: volumeDiffMl,
              tankVolumeAfterMl: newTankVol,
              receptionId: reception.id,
              performedByWorkerId: reception.receivedByWorkerId,
              note: `Корректировка админом: ${(volumeDiffMl / 1000).toFixed(2)} л`,
            });
          }
        }
      }
      // Case 2: Was accepted, now rejected/pending — remove volume from tank
      else if (oldStatus === "accepted" && newStatus !== "accepted" && reception.targetTankId && oldAcceptedMl > 0) {
        const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, reception.targetTankId)).limit(1);
        if (tank) {
          const newTankVol = Math.max(0, tank.currentVolumeMl - oldAcceptedMl);
          await db.update(milkTanks).set({ currentVolumeMl: newTankVol }).where(eq(milkTanks.id, tank.id));
          await db.insert(milkTankMovements).values({
            tankId: tank.id,
            movementType: "adjustment",
            volumeMl: -oldAcceptedMl,
            tankVolumeAfterMl: newTankVol,
            receptionId: reception.id,
            performedByWorkerId: reception.receivedByWorkerId,
            note: `Откат приёмки админом (статус: ${newStatus})`,
          });
        }
      }
      // Case 3: Was not accepted, now accepted — add volume to tank
      else if (oldStatus !== "accepted" && newStatus === "accepted" && reception.targetTankId && newAcceptedMl > 0) {
        const [tank] = await db.select().from(milkTanks).where(eq(milkTanks.id, reception.targetTankId)).limit(1);
        if (tank) {
          const newTankVol = tank.currentVolumeMl + newAcceptedMl;
          await db.update(milkTanks).set({ currentVolumeMl: newTankVol }).where(eq(milkTanks.id, tank.id));
          await db.insert(milkTankMovements).values({
            tankId: tank.id,
            movementType: "adjustment",
            volumeMl: newAcceptedMl,
            tankVolumeAfterMl: newTankVol,
            receptionId: reception.id,
            performedByWorkerId: reception.receivedByWorkerId,
            note: `Принятие приёмки админом`,
          });
        }
      }

      // Build update object
      const updates: Record<string, any> = {};
      if (input.acceptedVolumeMl !== undefined) updates.acceptedVolumeMl = input.acceptedVolumeMl;
      if (input.rejectedVolumeMl !== undefined) updates.rejectedVolumeMl = input.rejectedVolumeMl;
      if (input.status !== undefined) updates.status = input.status;
      if (input.rejectionReason !== undefined) updates.rejectionReason = input.rejectionReason;
      if (input.note !== undefined) updates.note = input.note;

      if (Object.keys(updates).length > 0) {
        await db
          .update(milkReceptions)
          .set(updates)
          .where(eq(milkReceptions.id, input.receptionId));
      }

      // --- Re-evaluate session status ---
      // If status changed, the session's confirmed status may need to be recalculated
      if (input.status !== undefined && input.status !== oldStatus && reception.sessionId) {
        const [session] = await db.select().from(milkSessions).where(eq(milkSessions.id, reception.sessionId)).limit(1);
        if (session) {
          // Determine which milk types have net volume > 0
          const milkTypesWithVolume: string[] = [];
          const types = [
            { key: "goat", vol: session.goatVolumeMl, feed: (session as any).goatFeedingMl ?? 0, loss: (session as any).goatLossesMl ?? 0 },
            { key: "sheep", vol: session.sheepVolumeMl, feed: (session as any).sheepFeedingMl ?? 0, loss: (session as any).sheepLossesMl ?? 0 },
            { key: "cow", vol: session.cowVolumeMl, feed: (session as any).cowFeedingMl ?? 0, loss: (session as any).cowLossesMl ?? 0 },
          ];
          for (const t of types) {
            const net = t.vol - t.feed - t.loss;
            if (t.vol > 0 && net > 0) milkTypesWithVolume.push(t.key);
          }

          if (milkTypesWithVolume.length > 0) {
            const allReceptions = await db
              .select({ milkType: milkReceptions.milkType, status: milkReceptions.status })
              .from(milkReceptions)
              .where(and(
                eq(milkReceptions.sessionId, reception.sessionId),
                inArray(milkReceptions.status, ["accepted", "rejected"]),
              ));
            const processedTypes = new Set(allReceptions.map((r: any) => r.milkType));
            const allProcessed = milkTypesWithVolume.every((t) => processedTypes.has(t));

            if (allProcessed && session.status !== "confirmed") {
              await db.update(milkSessions).set({ status: "confirmed", confirmedAt: new Date() }).where(eq(milkSessions.id, session.id));
            } else if (!allProcessed && session.status === "confirmed") {
              // Revert session to pending_confirm if not all types are processed anymore
              await db.update(milkSessions).set({ status: "pending_confirm", confirmedAt: sql`NULL` }).where(eq(milkSessions.id, session.id));
            }
          }
        }
      }

      await logMilkAudit({
        action: "admin_edit",
        adminOpenId: ctx.user?.openId ?? null,
        entityType: "reception",
        entityId: input.receptionId,
        detailsJson: JSON.stringify({ oldStatus, newStatus, updates }),
      });

      return { success: true };
    }),

  /**
   * Delete reception — reverses tank volume if accepted, removes reception,
   * and re-evaluates session status.
   */
  deleteReception: adminProcedure
    .input(z.object({ receptionId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();

      const [reception] = await db
        .select()
        .from(milkReceptions)
        .where(eq(milkReceptions.id, input.receptionId))
        .limit(1);

      if (!reception) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Приёмка не найдена" });
      }

      // 1. Delete related tank movements FIRST (before inserting adjustment)
      await db
        .delete(milkTankMovements)
        .where(eq(milkTankMovements.receptionId, input.receptionId));

      // 2. Reverse tank volume if reception was accepted
      if (reception.status === "accepted" && reception.targetTankId && reception.acceptedVolumeMl > 0) {
        const [tank] = await db
          .select()
          .from(milkTanks)
          .where(eq(milkTanks.id, reception.targetTankId))
          .limit(1);

        if (tank) {
          const newTankVol = Math.max(0, tank.currentVolumeMl - reception.acceptedVolumeMl);
          await db
            .update(milkTanks)
            .set({ currentVolumeMl: newTankVol })
            .where(eq(milkTanks.id, tank.id));

          // This adjustment movement is NOT linked to receptionId (already deleted above)
          await db.insert(milkTankMovements).values({
            tankId: tank.id,
            movementType: "adjustment",
            volumeMl: -reception.acceptedVolumeMl,
            tankVolumeAfterMl: newTankVol,
            performedByWorkerId: reception.receivedByWorkerId,
            note: `Удаление приёмки #${reception.id} админом`,
          });
        }
      }

      // 3. Delete the reception
      await db
        .delete(milkReceptions)
        .where(eq(milkReceptions.id, input.receptionId));

      // 4. Re-evaluate session status — may need to revert from "confirmed" to "pending_confirm"
      if (reception.sessionId) {
        const [session] = await db.select().from(milkSessions).where(eq(milkSessions.id, reception.sessionId)).limit(1);
        if (session && session.status === "confirmed") {
          const milkTypesWithVolume: string[] = [];
          const types = [
            { key: "goat", vol: session.goatVolumeMl, feed: (session as any).goatFeedingMl ?? 0, loss: (session as any).goatLossesMl ?? 0 },
            { key: "sheep", vol: session.sheepVolumeMl, feed: (session as any).sheepFeedingMl ?? 0, loss: (session as any).sheepLossesMl ?? 0 },
            { key: "cow", vol: session.cowVolumeMl, feed: (session as any).cowFeedingMl ?? 0, loss: (session as any).cowLossesMl ?? 0 },
          ];
          for (const t of types) {
            const net = t.vol - t.feed - t.loss;
            if (t.vol > 0 && net > 0) milkTypesWithVolume.push(t.key);
          }

          if (milkTypesWithVolume.length > 0) {
            const remainingReceptions = await db
              .select({ milkType: milkReceptions.milkType, status: milkReceptions.status })
              .from(milkReceptions)
              .where(and(
                eq(milkReceptions.sessionId, reception.sessionId),
                inArray(milkReceptions.status, ["accepted", "rejected"]),
              ));
            const processedTypes = new Set(remainingReceptions.map((r: any) => r.milkType));
            const allProcessed = milkTypesWithVolume.every((t) => processedTypes.has(t));

            if (!allProcessed) {
              await db.update(milkSessions).set({ status: "pending_confirm", confirmedAt: sql`NULL` }).where(eq(milkSessions.id, session.id));
            }
          }
        }
      }

      await logMilkAudit({
        action: "admin_delete",
        adminOpenId: ctx.user?.openId ?? null,
        entityType: "reception",
        entityId: input.receptionId,
        detailsJson: JSON.stringify({
          sessionId: reception.sessionId,
          acceptedMl: reception.acceptedVolumeMl,
          rejectedMl: reception.rejectedVolumeMl,
        }),
      });

      return { success: true, message: "Приёмка удалена" };
    }),
});
