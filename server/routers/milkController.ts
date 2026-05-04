/**
 * Milk Controller ARM tRPC Router.
 *
 * Read-only access to milk turnover data for the "controller" farm worker role.
 * Mirrors milkAdmin queries but:
 *  - No create/update/delete mutations
 *  - Adds discrepancy detection (net vs accepted > 5%)
 *  - Adds worker filter on sessions and receptions
 *  - Adds shift summary for current day
 *
 * Auth: uses farm_session cookie, requires role === "controller"
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import {
  milkSessions,
  milkReceptions,
  milkTanks,
  milkTankMovements,
  milkAuditLog,
  farmWorkers,
  processingSessions,
  processingInputs,
  processingOutputs,
  tierProductCatalog,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { verifyFarmToken, FARM_COOKIE_NAME } from "../farmAuth";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";

const MILK_TYPE_LABELS: Record<string, string> = {
  goat: "Козье",
  sheep: "Овечье",
  cow: "Коровье",
};

// ─── Auth middleware: extract controller from farm cookie ─────

function extractControllerFromReq(req: any): { workerId: number; login: string; role: string } {
  const cookieHeader = req.headers?.cookie ?? "";
  const cookies: Record<string, string> = {};
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  const token = req.cookies?.[FARM_COOKIE_NAME] ?? cookies[FARM_COOKIE_NAME];
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Необходимо войти в систему" });
  }
  const payload = verifyFarmToken(token);
  if (!payload) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Сессия истекла" });
  }
  if (payload.role !== "controller") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Доступ только для контролёра" });
  }
  return payload;
}

/** Procedure that requires controller role via farm cookie */
const controllerProcedure = publicProcedure.use(({ ctx, next }) => {
  const controller = extractControllerFromReq(ctx.req);
  return next({ ctx: { ...ctx, controller } });
});

// ─── Helper: ml to liters ───

const ml2l = (ml: number) => +(ml / 1000).toFixed(2);

// ─── Router ─────────────────────────────────────────────────

export const milkControllerRouter = router({
  /**
   * Dashboard overview: today / week / month / custom stats with per-type breakdown.
   * Same data as milkAdmin.overview but read-only.
   */
  overview: controllerProcedure
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

      const [todayStats] = await db.select(fullStatsSelect).from(milkSessions).where(gte(milkSessions.createdAt, todayStart));
      const [weekStats] = await db.select(fullStatsSelect).from(milkSessions).where(gte(milkSessions.createdAt, weekStart));
      const [monthStats] = await db.select(fullStatsSelect).from(milkSessions).where(gte(milkSessions.createdAt, monthStart));

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

      const [pendingCount] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkSessions)
        .where(eq(milkSessions.status, "pending_confirm"));

      const [receptionToday] = await db
        .select({
          count: sql<number>`COUNT(*)`,
          acceptedMl: sql<number>`COALESCE(SUM(${milkReceptions.acceptedVolumeMl}), 0)`,
          rejectedMl: sql<number>`COALESCE(SUM(${milkReceptions.rejectedVolumeMl}), 0)`,
        })
        .from(milkReceptions)
        .where(gte(milkReceptions.createdAt, todayStart));

      // Tank summary
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
      let totalCapacity = 0, totalCurrent = 0, totalActive = 0, totalTanks = 0;
      for (const row of tanksByType) {
        const cap = Number(row.totalCapacityMl);
        const cur = Number(row.totalCurrentMl);
        const act = Number(row.activeTanks);
        const tot = Number(row.totalTanks);
        tankSummary[row.milkType] = {
          capacityLiters: ml2l(cap), currentLiters: ml2l(cur),
          fillPercent: cap > 0 ? Math.round((cur / cap) * 100) : 0,
          active: act, total: tot,
        };
        totalCapacity += cap; totalCurrent += cur; totalActive += act; totalTanks += tot;
      }

      function formatPeriod(row: any, rec: any) {
        const goat = Number(row.goatMl), sheep = Number(row.sheepMl), cow = Number(row.cowMl);
        const gf = Number(row.goatFeedingMl), sf = Number(row.sheepFeedingMl), cf = Number(row.cowFeedingMl);
        const gl = Number(row.goatLossesMl), sl = Number(row.sheepLossesMl), cl = Number(row.cowLossesMl);
        const totalVol = goat + sheep + cow;
        const totalFeed = gf + sf + cf;
        const totalLoss = gl + sl + cl;
        const ga = Number(rec.goatAcceptedMl), sa = Number(rec.sheepAcceptedMl), ca = Number(rec.cowAcceptedMl);
        const gr = Number(rec.goatRejectedMl), sr = Number(rec.sheepRejectedMl), cr = Number(rec.cowRejectedMl);

        return {
          sessions: Number(row.count),
          total: {
            volumeL: ml2l(totalVol), heads: Number(row.goatHeads) + Number(row.sheepHeads) + Number(row.cowHeads),
            feedingL: ml2l(totalFeed), lossesL: ml2l(totalLoss), netL: ml2l(totalVol - totalFeed - totalLoss),
            acceptedL: ml2l(ga + sa + ca), rejectedL: ml2l(gr + sr + cr),
          },
          goat: {
            volumeL: ml2l(goat), heads: Number(row.goatHeads), feedingL: ml2l(gf), lossesL: ml2l(gl),
            netL: ml2l(goat - gf - gl), acceptedL: ml2l(ga), rejectedL: ml2l(gr),
          },
          sheep: {
            volumeL: ml2l(sheep), heads: Number(row.sheepHeads), feedingL: ml2l(sf), lossesL: ml2l(sl),
            netL: ml2l(sheep - sf - sl), acceptedL: ml2l(sa), rejectedL: ml2l(sr),
          },
          cow: {
            volumeL: ml2l(cow), heads: Number(row.cowHeads), feedingL: ml2l(cf), lossesL: ml2l(cl),
            netL: ml2l(cow - cf - cl), acceptedL: ml2l(ca), rejectedL: ml2l(cr),
          },
        };
      }

      let customPeriod = null;
      if (input?.customFrom && input?.customTo) {
        const customStart = new Date(input.customFrom + "T00:00:00");
        const customEnd = new Date(input.customTo + "T23:59:59");
        const [customStats] = await db.select(fullStatsSelect).from(milkSessions)
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
          acceptedLiters: ml2l(Number(receptionToday.acceptedMl)),
          rejectedLiters: ml2l(Number(receptionToday.rejectedMl)),
        },
        tanks: {
          total: totalTanks, active: totalActive,
          capacityLiters: ml2l(totalCapacity), currentLiters: ml2l(totalCurrent),
          fillPercent: totalCapacity > 0 ? Math.round((totalCurrent / totalCapacity) * 100) : 0,
          byType: tankSummary,
        },
      };
    }),

  /**
   * Shift summary for today — quick pulse of current day operations.
   */
  shiftSummary: controllerProcedure.query(async () => {
    const db = await getDb();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Sessions today by shift
    const sessions = await db
      .select({
        shift: milkSessions.shift,
        count: sql<number>`COUNT(*)`,
        totalMl: sql<number>`COALESCE(SUM(${milkSessions.goatVolumeMl} + ${milkSessions.sheepVolumeMl} + ${milkSessions.cowVolumeMl}), 0)`,
        pending: sql<number>`SUM(CASE WHEN ${milkSessions.status} = 'pending_confirm' THEN 1 ELSE 0 END)`,
        confirmed: sql<number>`SUM(CASE WHEN ${milkSessions.status} = 'confirmed' THEN 1 ELSE 0 END)`,
        inProgress: sql<number>`SUM(CASE WHEN ${milkSessions.status} = 'in_progress' THEN 1 ELSE 0 END)`,
        disputed: sql<number>`SUM(CASE WHEN ${milkSessions.status} = 'disputed' THEN 1 ELSE 0 END)`,
      })
      .from(milkSessions)
      .where(gte(milkSessions.createdAt, todayStart))
      .groupBy(milkSessions.shift);

    // Receptions today
    const [recToday] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        acceptedMl: sql<number>`COALESCE(SUM(${milkReceptions.acceptedVolumeMl}), 0)`,
        rejectedMl: sql<number>`COALESCE(SUM(${milkReceptions.rejectedVolumeMl}), 0)`,
        rejectedCount: sql<number>`SUM(CASE WHEN ${milkReceptions.status} = 'rejected' THEN 1 ELSE 0 END)`,
      })
      .from(milkReceptions)
      .where(gte(milkReceptions.createdAt, todayStart));

    const currentHour = now.getHours();
    const currentShift = currentHour < 14 ? "morning" : "evening";

    return {
      date: todayStart.toISOString().slice(0, 10),
      currentShift,
      shifts: sessions.map((s: any) => ({
        shift: s.shift,
        shiftLabel: s.shift === "morning" ? "🌅 Утренняя" : "🌙 Вечерняя",
        sessions: Number(s.count),
        totalLiters: ml2l(Number(s.totalMl)),
        pending: Number(s.pending),
        confirmed: Number(s.confirmed),
        inProgress: Number(s.inProgress),
        disputed: Number(s.disputed),
      })),
      receptions: {
        count: Number(recToday.count),
        acceptedLiters: ml2l(Number(recToday.acceptedMl)),
        rejectedLiters: ml2l(Number(recToday.rejectedMl)),
        rejectedCount: Number(recToday.rejectedCount),
      },
    };
  }),

  /**
   * Discrepancy report: compare session net volumes with accepted reception volumes.
   * Flags sessions where discrepancy > 5%.
   */
  discrepancies: controllerProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(90).default(7),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const days = input?.days ?? 7;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Get confirmed sessions with their net volumes
      const sessions = await db
        .select({
          id: milkSessions.id,
          sessionCode: milkSessions.sessionCode,
          shift: milkSessions.shift,
          workerName: farmWorkers.name,
          goatVolumeMl: milkSessions.goatVolumeMl,
          goatFeedingMl: milkSessions.goatFeedingMl,
          goatLossesMl: milkSessions.goatLossesMl,
          sheepVolumeMl: milkSessions.sheepVolumeMl,
          sheepFeedingMl: milkSessions.sheepFeedingMl,
          sheepLossesMl: milkSessions.sheepLossesMl,
          cowVolumeMl: milkSessions.cowVolumeMl,
          cowFeedingMl: milkSessions.cowFeedingMl,
          cowLossesMl: milkSessions.cowLossesMl,
          status: milkSessions.status,
          createdAt: milkSessions.createdAt,
        })
        .from(milkSessions)
        .leftJoin(farmWorkers, eq(milkSessions.workerId, farmWorkers.id))
        .where(gte(milkSessions.createdAt, since))
        .orderBy(desc(milkSessions.createdAt));

      // Get receptions grouped by session
      const receptions = await db
        .select({
          sessionId: milkReceptions.sessionId,
          milkType: milkReceptions.milkType,
          acceptedMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkReceptions.status} = 'accepted' THEN ${milkReceptions.acceptedVolumeMl} ELSE 0 END), 0)`,
          rejectedMl: sql<number>`COALESCE(SUM(${milkReceptions.rejectedVolumeMl}), 0)`,
        })
        .from(milkReceptions)
        .where(gte(milkReceptions.createdAt, since))
        .groupBy(milkReceptions.sessionId, milkReceptions.milkType);

      // Build reception map: sessionId -> { goat: { accepted, rejected }, ... }
      const recMap: Record<number, Record<string, { acceptedMl: number; rejectedMl: number }>> = {};
      for (const r of receptions) {
        if (!r.sessionId) continue;
        if (!recMap[r.sessionId]) recMap[r.sessionId] = {};
        recMap[r.sessionId][r.milkType] = {
          acceptedMl: Number(r.acceptedMl),
          rejectedMl: Number(r.rejectedMl),
        };
      }

      const THRESHOLD = 0.05; // 5%

      const results = sessions.map((s: any) => {
        const types = [
          { key: "goat", vol: s.goatVolumeMl, feed: s.goatFeedingMl ?? 0, loss: s.goatLossesMl ?? 0 },
          { key: "sheep", vol: s.sheepVolumeMl, feed: s.sheepFeedingMl ?? 0, loss: s.sheepLossesMl ?? 0 },
          { key: "cow", vol: s.cowVolumeMl, feed: s.cowFeedingMl ?? 0, loss: s.cowLossesMl ?? 0 },
        ];

        const typeDiscrepancies = types
          .filter((t) => t.vol > 0)
          .map((t) => {
            const netMl = t.vol - t.feed - t.loss;
            const rec = recMap[s.id]?.[t.key];
            const acceptedMl = rec?.acceptedMl ?? 0;
            const rejectedMl = rec?.rejectedMl ?? 0;
            const diffMl = netMl - acceptedMl - rejectedMl;
            const diffPercent = netMl > 0 ? diffMl / netMl : 0;
            const hasDiscrepancy = Math.abs(diffPercent) > THRESHOLD;

            return {
              milkType: t.key,
              milkTypeLabel: MILK_TYPE_LABELS[t.key] ?? t.key,
              netLiters: ml2l(netMl),
              acceptedLiters: ml2l(acceptedMl),
              rejectedLiters: ml2l(rejectedMl),
              diffLiters: ml2l(diffMl),
              diffPercent: +(diffPercent * 100).toFixed(1),
              hasDiscrepancy,
            };
          });

        const hasAnyDiscrepancy = typeDiscrepancies.some((d) => d.hasDiscrepancy);

        // Loss percentage
        const totalVol = s.goatVolumeMl + s.sheepVolumeMl + s.cowVolumeMl;
        const totalLoss = (s.goatLossesMl ?? 0) + (s.sheepLossesMl ?? 0) + (s.cowLossesMl ?? 0);
        const lossPercent = totalVol > 0 ? (totalLoss / totalVol) * 100 : 0;
        const highLosses = lossPercent > 5;

        return {
          sessionId: s.id,
          sessionCode: s.sessionCode,
          shift: s.shift,
          workerName: s.workerName ?? "—",
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          lossPercent: +lossPercent.toFixed(1),
          highLosses,
          hasDiscrepancy: hasAnyDiscrepancy,
          types: typeDiscrepancies,
        };
      });

      // Only return sessions with issues (or all if few)
      const flagged = results.filter((r) => r.hasDiscrepancy || r.highLosses);

      return {
        total: results.length,
        flagged: flagged.length,
        threshold: THRESHOLD * 100,
        sessions: results,
      };
    }),

  /**
   * Sessions list (read-only, with worker filter).
   */
  sessions: controllerProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(15),
        status: z.enum(["in_progress", "pending_confirm", "confirmed", "disputed"]).optional(),
        workerId: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input.status) conditions.push(eq(milkSessions.status, input.status));
      if (input.workerId) conditions.push(eq(milkSessions.workerId, input.workerId));
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
            shift: s.shift,
            goat: {
              volumeLiters: ml2l(s.goatVolumeMl),
              headCount: s.goatHeadCount,
              feedingLiters: ml2l(s.goatFeedingMl ?? 0),
              lossesLiters: ml2l(s.goatLossesMl ?? 0),
              netLiters: ml2l(s.goatVolumeMl - (s.goatFeedingMl ?? 0) - (s.goatLossesMl ?? 0)),
            },
            sheep: {
              volumeLiters: ml2l(s.sheepVolumeMl),
              headCount: s.sheepHeadCount,
              feedingLiters: ml2l(s.sheepFeedingMl ?? 0),
              lossesLiters: ml2l(s.sheepLossesMl ?? 0),
              netLiters: ml2l(s.sheepVolumeMl - (s.sheepFeedingMl ?? 0) - (s.sheepLossesMl ?? 0)),
            },
            cow: {
              volumeLiters: ml2l(s.cowVolumeMl),
              headCount: s.cowHeadCount,
              feedingLiters: ml2l(s.cowFeedingMl ?? 0),
              lossesLiters: ml2l(s.cowLossesMl ?? 0),
              netLiters: ml2l(s.cowVolumeMl - (s.cowFeedingMl ?? 0) - (s.cowLossesMl ?? 0)),
            },
            totalVolumeLiters: ml2l(totalMl),
            totalNetLiters: ml2l(totalMl - (s.goatFeedingMl ?? 0) - (s.goatLossesMl ?? 0) - (s.sheepFeedingMl ?? 0) - (s.sheepLossesMl ?? 0) - (s.cowFeedingMl ?? 0) - (s.cowLossesMl ?? 0)),
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
   * Receptions list (read-only, with worker filter).
   */
  receptions: controllerProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(5).max(100).default(15),
        receiverWorkerId: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();

      const conditions = [];
      if (input.receiverWorkerId) conditions.push(eq(milkReceptions.receivedByWorkerId, input.receiverWorkerId));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(milkReceptions)
        .where(whereClause);

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
        .where(whereClause)
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
          receiverWorkerId: r.receivedByWorkerId,
          receiverName: r.receiverName ?? "—",
          acceptedVolumeLiters: ml2l(r.acceptedVolumeMl),
          rejectedVolumeLiters: ml2l(r.rejectedVolumeMl),
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
   * Tanks (read-only).
   */
  tanks: controllerProcedure.query(async () => {
    const db = await getDb();
    const tanks = await db.select().from(milkTanks).orderBy(milkTanks.milkType, milkTanks.name);

    return tanks.map((t: any) => ({
      id: t.id,
      name: t.name,
      milkType: t.milkType,
      milkTypeLabel: MILK_TYPE_LABELS[t.milkType] ?? t.milkType,
      capacityLiters: ml2l(t.capacityMl),
      currentVolumeLiters: ml2l(t.currentVolumeMl),
      fillPercent: t.capacityMl > 0 ? Math.round((t.currentVolumeMl / t.capacityMl) * 100) : 0,
      status: t.status,
      location: t.location,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    }));
  }),

  /**
   * Tank reconciliation (read-only).
   */
  tankReconciliation: controllerProcedure.query(async () => {
    const db = await getDb();
    const tanks = await db.select().from(milkTanks).orderBy(milkTanks.id);

    const acceptedByTank = await db
      .select({
        targetTankId: milkReceptions.targetTankId,
        totalAcceptedMl: sql<number>`COALESCE(SUM(${milkReceptions.acceptedVolumeMl}), 0)`,
      })
      .from(milkReceptions)
      .where(eq(milkReceptions.status, "accepted"))
      .groupBy(milkReceptions.targetTankId);

    const acceptedMap: Record<number, number> = {};
    for (const row of acceptedByTank) {
      if (row.targetTankId != null) acceptedMap[row.targetTankId] = Number(row.totalAcceptedMl);
    }

    const outflowByTank = await db
      .select({
        tankId: milkTankMovements.tankId,
        totalOutMl: sql<number>`COALESCE(SUM(CASE WHEN ${milkTankMovements.volumeMl} < 0 AND ${milkTankMovements.movementType} IN ('waste', 'batch_out', 'transfer_out') THEN ABS(${milkTankMovements.volumeMl}) ELSE 0 END), 0)`,
      })
      .from(milkTankMovements)
      .groupBy(milkTankMovements.tankId);

    const outflowMap: Record<number, number> = {};
    for (const row of outflowByTank) outflowMap[row.tankId] = Number(row.totalOutMl);

    return tanks.map((t: any) => {
      const acceptedMl = acceptedMap[t.id] ?? 0;
      const outflowMl = outflowMap[t.id] ?? 0;
      const expectedMl = acceptedMl - outflowMl;
      const actualMl = t.currentVolumeMl;
      const discrepancyMl = actualMl - expectedMl;
      return {
        id: t.id, name: t.name, milkType: t.milkType,
        milkTypeLabel: MILK_TYPE_LABELS[t.milkType] ?? t.milkType,
        acceptedLiters: ml2l(acceptedMl), outflowLiters: ml2l(outflowMl),
        expectedLiters: ml2l(expectedMl), actualLiters: ml2l(actualMl),
        discrepancyLiters: ml2l(discrepancyMl),
        isOk: Math.abs(discrepancyMl) < 100,
      };
    });
  }),

  /**
   * Audit log (read-only).
   */
  auditLog: controllerProcedure
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
   * List of farm workers (for filter dropdowns).
   */
  workers: controllerProcedure.query(async () => {
    const db = await getDb();
    const workers = await db
      .select({
        id: farmWorkers.id,
        name: farmWorkers.name,
        role: farmWorkers.role,
      })
      .from(farmWorkers)
      .where(eq(farmWorkers.isActive, true))
      .orderBy(farmWorkers.name);

    return workers;
  }),

  // ─── Processing Sessions (read-only) ─────────────────────────
  processingSessions: controllerProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conditions: any[] = [];
      if (input?.dateFrom) conditions.push(gte(processingSessions.shiftDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(processingSessions.shiftDate, input.dateTo));

      const rows = await db
        .select({
          id: processingSessions.id,
          sessionCode: processingSessions.sessionCode,
          shiftDate: processingSessions.shiftDate,
          status: processingSessions.status,
          workerId: processingSessions.workerId,
          totalInputMl: processingSessions.totalInputMl,
          note: processingSessions.note,
          createdAt: processingSessions.createdAt,
        })
        .from(processingSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(processingSessions.shiftDate))
        .limit(100);

      // Enrich with worker names
      const workerIds = [...new Set(rows.filter((r) => r.workerId).map((r) => r.workerId!))];
      let workerMap: Record<number, string> = {};
      if (workerIds.length > 0) {
        const workers = await db
          .select({ id: farmWorkers.id, name: farmWorkers.name })
          .from(farmWorkers)
          .where(inArray(farmWorkers.id, workerIds));
        workerMap = Object.fromEntries(workers.map((w) => [w.id, w.name]));
      }

      return {
        sessions: rows.map((r) => ({
          ...r,
          workerName: r.workerId ? workerMap[r.workerId] ?? null : null,
        })),
        total: rows.length,
      };
    }),

  // ─── Conversion Analytics (read-only) ────────────────────────
  conversionAnalytics: controllerProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        deviationThreshold: z.number().default(15),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const threshold = input?.deviationThreshold ?? 15;
      const conditions: any[] = [eq(processingSessions.status, "completed")];
      if (input?.dateFrom) conditions.push(gte(processingSessions.shiftDate, input.dateFrom));
      if (input?.dateTo) conditions.push(lte(processingSessions.shiftDate, input.dateTo));

      const sessions = await db
        .select({
          id: processingSessions.id,
          sessionCode: processingSessions.sessionCode,
          shiftDate: processingSessions.shiftDate,
          totalInputMl: processingSessions.totalInputMl,
        })
        .from(processingSessions)
        .where(and(...conditions))
        .orderBy(desc(processingSessions.shiftDate))
        .limit(50);

      if (sessions.length === 0) return { sessions: [], alerts: [] };

      const sessionIds = sessions.map((s) => s.id);
      const outputs = await db
        .select({
          id: processingOutputs.id,
          sessionId: processingOutputs.sessionId,
          catalogItemId: processingOutputs.catalogItemId,
          quantity: processingOutputs.quantity,
          actualConversionRatio: processingOutputs.actualConversionRatio,
        })
        .from(processingOutputs)
        .where(inArray(processingOutputs.sessionId, sessionIds));

      // Get base ratios from catalog
      const catalogIds = [...new Set(outputs.map((o) => o.catalogItemId))];
      let catalogMap: Record<number, { label: string; baseRatio: number | null }> = {};
      if (catalogIds.length > 0) {
        const items = await db
          .select({
            id: tierProductCatalog.id,
            label: tierProductCatalog.label,
            conversionRatio: tierProductCatalog.conversionRatio,
          })
          .from(tierProductCatalog)
          .where(inArray(tierProductCatalog.id, catalogIds));
        catalogMap = Object.fromEntries(
          items.map((i) => [
            i.id,
            {
              label: i.label,
              baseRatio: i.conversionRatio ? parseFloat(String(i.conversionRatio)) : null,
            },
          ]),
        );
      }

      const alerts: any[] = [];
      const enrichedSessions = sessions.map((s) => {
        const sessionOutputs = outputs.filter((o) => o.sessionId === s.id);
        const enrichedOutputs = sessionOutputs.map((o) => {
          const catalog = catalogMap[o.catalogItemId];
          const actualRatio = o.actualConversionRatio ? parseFloat(o.actualConversionRatio) : null;
          const baseRatio = catalog?.baseRatio ?? null;
          let deviationPercent: number | null = null;
          if (actualRatio !== null && baseRatio !== null && baseRatio > 0) {
            deviationPercent = ((actualRatio - baseRatio) / baseRatio) * 100;
            if (Math.abs(deviationPercent) > threshold) {
              alerts.push({
                sessionId: s.id,
                sessionCode: s.sessionCode,
                shiftDate: s.shiftDate,
                productLabel: catalog?.label ?? "Неизвестно",
                actualRatio,
                baseRatio,
                deviationPercent,
              });
            }
          }
          return {
            productLabel: catalog?.label ?? "Неизвестно",
            quantity: o.quantity,
            actualConversionRatio: actualRatio,
            baseConversionRatio: baseRatio,
            deviationPercent,
          };
        });
        return {
          sessionId: s.id,
          sessionCode: s.sessionCode,
          shiftDate: s.shiftDate,
          totalInputMl: s.totalInputMl,
          outputs: enrichedOutputs,
        };
      });

      return { sessions: enrichedSessions, alerts };
    }),
});
