/**
 * FAQ Chat Router — Маша, управляющая фермой.
 *
 * Ответы строит server/assistants/mashaChat.ts: системный промпт (персона и
 * правила) + инструменты над живой БД и базой знаний. Здесь — tRPC-контракт,
 * rate limit, аналитика, A/B-приветствия и неуверенные ответы.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { desc, sql, eq, gte, lt, and } from "drizzle-orm";
import { faqQuestions, greetingVariants, abTestSessions, uncertainAnswers } from "../../drizzle/schema";
import { getDb } from "../db";
import { compactChatHistory } from "../_core/chatHistory";
import { recordMashaTurn } from "../assistants/mashaAnalytics";
import {
  CHAT_HISTORY_MAX_CHARS,
  MASHA_ERROR_REPLY,
  lastUserQuestion,
  mashaChatInputSchema,
  runMashaChat,
} from "../assistants/mashaChat";
import { checkChatRateLimit } from "../assistants/mashaRateLimit";

export {
  CHAT_RATE_LIMIT,
  checkChatRateLimit,
  chatRateLimitSize,
  pruneExpiredRateLimits,
  resetChatRateLimit,
} from "../assistants/mashaRateLimit";
export { CHAT_HISTORY_MAX_CHARS } from "../assistants/mashaChat";

/* ─── Default greeting (used when no A/B variant is active) ─── */
const DEFAULT_GREETING = `Привет! 🌿 Я Маша, управляющая фермой «Шерь Козу». Спрашивайте меня о ферме, породах, продуктах или персональном фермерстве!`;

/* ─── Router ─── */
export const faqChatRouter = router({
  /** Сообщение Маше (без стрима; SSE — POST /api/masha/chat/stream) */
  chat: publicProcedure
    .input(mashaChatInputSchema)
    .mutation(async ({ input, ctx }) => {
      const clientIp = ctx.req?.ip || "unknown";
      if (!checkChatRateLimit(clientIp)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много сообщений за последний час, попробуйте позже",
        });
      }

      // Хвост истории в пределах бюджета символов; первый вопрос сохраняется.
      const messages = compactChatHistory(input.messages, {
        maxChars: CHAT_HISTORY_MAX_CHARS,
        keepFirstUserMessage: true,
      });
      const question = lastUserQuestion(messages);
      const source = input.source || "faq";
      const userOpenId = ctx.user?.openId ?? null;

      try {
        const turn = await runMashaChat({ input: { ...input, messages }, userOpenId });
        recordMashaTurn({
          question,
          answer: turn.reply,
          sessionId: input.sessionId,
          source,
          userOpenId,
          outcome: turn.outcome,
          toolTrace: turn.toolTrace,
        });
        return {
          reply: turn.reply,
          uncertain: turn.outcome === "uncertain",
          outcome: turn.outcome,
          tools: turn.toolTrace.map((entry) => entry.name),
        };
      } catch (error) {
        console.error("[Masha Chat] error:", error instanceof Error ? error.message : error);
        recordMashaTurn({
          question,
          answer: MASHA_ERROR_REPLY,
          sessionId: input.sessionId,
          source,
          userOpenId,
          outcome: "error",
          toolTrace: [],
        });
        return { reply: MASHA_ERROR_REPLY, uncertain: false, outcome: "error" as const, tools: [] };
      }
    }),

  /** Admin: get FAQ analytics — top questions, recent questions, stats */
  analytics: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional(),
        days: z.number().min(1).max(365).optional(),
      }).optional()
    )
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const limit = 50;
      const days = 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Recent questions
      const recent = await db
        .select()
        .from(faqQuestions)
        .where(gte(faqQuestions.createdAt, since))
        .orderBy(desc(faqQuestions.createdAt))
        .limit(limit);

      // Total count
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(faqQuestions);
      const totalCount = totalResult?.count ?? 0;

      // Count in period
      const [periodResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(faqQuestions)
        .where(gte(faqQuestions.createdAt, since));
      const periodCount = periodResult?.count ?? 0;

      // Unique sessions in period
      const [sessionsResult] = await db
        .select({ count: sql<number>`count(distinct ${faqQuestions.sessionId})` })
        .from(faqQuestions)
        .where(gte(faqQuestions.createdAt, since));
      const uniqueSessions = sessionsResult?.count ?? 0;

      // Source breakdown
      const sourceBreakdown = await db
        .select({
          source: faqQuestions.source,
          count: sql<number>`count(*)`,
        })
        .from(faqQuestions)
        .where(gte(faqQuestions.createdAt, since))
        .groupBy(faqQuestions.source);

      // Questions per day (last 7 days)
      // Use raw SQL with subquery to avoid only_full_group_by issues on TiDB
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ');
      const dailyStatsRaw: Array<{ d: string; cnt: number }> = await db.execute(
        sql`SELECT DATE(createdAt) as d, count(*) as cnt FROM faqQuestions WHERE createdAt >= ${sevenDaysAgo} GROUP BY d ORDER BY d`
      ) as any;
      const dailyStats = (Array.isArray(dailyStatsRaw) ? dailyStatsRaw : []).map((r: any) => ({
        date: String(r.d),
        count: Number(r.cnt),
      }));

      return {
        recent,
        stats: {
          totalCount,
          periodCount,
          uniqueSessions,
          days,
          sourceBreakdown,
          dailyStats,
        },
      };
    }),

  /** Admin: export FAQ analytics data as CSV with optional filters */
  exportCsv: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(), // ISO date string e.g. "2025-01-01"
        dateTo: z.string().optional(),   // ISO date string e.g. "2025-12-31"
        source: z.enum(["faq", "floating", "all"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Build where conditions based on filters
      const conditions = [];
      if (input?.dateFrom) {
        conditions.push(gte(faqQuestions.createdAt, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        // Add 1 day to include the entire end date
        const endDate = new Date(input.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        conditions.push(lt(faqQuestions.createdAt, endDate));
      }
      if (input?.source && input.source !== "all") {
        conditions.push(eq(faqQuestions.source, input.source));
      }

      const query = db
        .select()
        .from(faqQuestions);

      const rows = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(faqQuestions.createdAt)).limit(5000)
        : await query.orderBy(desc(faqQuestions.createdAt)).limit(5000);

      // Build CSV
      const escapeCsv = (val: string) => {
        if (val.includes('"') || val.includes(',') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      };

      const header = 'ID,Дата,Вопрос,Ответ,Источник,Session ID,User OpenID';
      const lines = rows.map((r: typeof rows[number]) => [
        r.id,
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
        escapeCsv(r.question || ''),
        escapeCsv(r.answer || ''),
        r.source || '',
        r.sessionId || '',
        r.userOpenId || '',
      ].join(','));

      return { csv: '\uFEFF' + header + '\n' + lines.join('\n') };
    }),

  /** Admin: clear old FAQ analytics data */
  clearOld: protectedProcedure
    .input(
      z.object({
        olderThanDays: z.number().min(1).max(365),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(faqQuestions)
        .where(lt(faqQuestions.createdAt, cutoff));

      return { success: true, message: `Удалены записи старше ${input.olderThanDays} дней` };
    }),

  /* ─── A/B Testing: Greeting Variants ─── */

  /** Public: get a random active greeting variant for a new session */
  getGreetingVariant: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(64),
        source: z.enum(["faq", "floating"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        return { variantKey: "default", greetingText: DEFAULT_GREETING };
      }

      // Check if this session already has an assigned variant
      const [existing] = await db
        .select()
        .from(abTestSessions)
        .where(eq(abTestSessions.sessionId, input.sessionId))
        .limit(1);

      if (existing) {
        // Return the previously assigned variant
        const [variant] = await db
          .select()
          .from(greetingVariants)
          .where(eq(greetingVariants.variantKey, existing.variantKey))
          .limit(1);
        return {
          variantKey: existing.variantKey,
          greetingText: variant?.greetingText || DEFAULT_GREETING,
        };
      }

      // Get all active variants
      const activeVariants = await db
        .select()
        .from(greetingVariants)
        .where(eq(greetingVariants.isActive, true));

      if (activeVariants.length === 0) {
        return { variantKey: "default", greetingText: DEFAULT_GREETING };
      }

      // Random assignment
      const chosen = activeVariants[Math.floor(Math.random() * activeVariants.length)];

      // Record the assignment
      try {
        await db.insert(abTestSessions).values({
          sessionId: input.sessionId,
          variantKey: chosen.variantKey,
          source: input.source || "floating",
          userOpenId: ctx.user?.openId,
        });
      } catch (err) {
        console.error("[A/B] Failed to record session assignment:", err);
      }

      return {
        variantKey: chosen.variantKey,
        greetingText: chosen.greetingText,
      };
    }),

  /** Public: track engagement metrics for an A/B test session */
  trackAbEngagement: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1).max(64),
        didRespond: z.boolean().optional(),
        messageCount: z.number().min(0).max(1000).optional(),
        durationSeconds: z.number().min(0).max(86400).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      try {
        const updates: Record<string, unknown> = {};
        if (input.didRespond !== undefined) updates.didRespond = input.didRespond;
        if (input.messageCount !== undefined) updates.messageCount = input.messageCount;
        if (input.durationSeconds !== undefined) updates.durationSeconds = input.durationSeconds;

        if (Object.keys(updates).length > 0) {
          await db
            .update(abTestSessions)
            .set(updates)
            .where(eq(abTestSessions.sessionId, input.sessionId));
        }
        return { success: true };
      } catch (err) {
        console.error("[A/B] Failed to track engagement:", err);
        return { success: false };
      }
    }),

  /** Admin: get A/B test results with variant performance comparison */
  abTestResults: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get all variants
    const variants = await db.select().from(greetingVariants).orderBy(greetingVariants.createdAt);

    // Get aggregated stats per variant
    const variantStats = await db
      .select({
        variantKey: abTestSessions.variantKey,
        totalSessions: sql<number>`count(*)`,
        respondedSessions: sql<number>`sum(case when ${abTestSessions.didRespond} = true then 1 else 0 end)`,
        avgMessageCount: sql<number>`avg(${abTestSessions.messageCount})`,
        avgDuration: sql<number>`avg(${abTestSessions.durationSeconds})`,
        maxMessages: sql<number>`max(${abTestSessions.messageCount})`,
      })
      .from(abTestSessions)
      .groupBy(abTestSessions.variantKey);

    // Merge variants with their stats
    const results = variants.map((v: typeof variants[number]) => {
      const stats = variantStats.find((s: typeof variantStats[number]) => s.variantKey === v.variantKey);
      const total = stats?.totalSessions ?? 0;
      const responded = stats?.respondedSessions ?? 0;
      return {
        ...v,
        totalSessions: total,
        respondedSessions: responded,
        responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
        avgMessageCount: stats?.avgMessageCount ? Math.round(stats.avgMessageCount * 10) / 10 : 0,
        avgDuration: stats?.avgDuration ? Math.round(stats.avgDuration) : 0,
        maxMessages: stats?.maxMessages ?? 0,
      };
    });

    // Total sessions across all variants
    const totalAllSessions = results.reduce((sum: number, r: typeof results[number]) => sum + r.totalSessions, 0);

    return { variants: results, totalSessions: totalAllSessions };
  }),

  /** Admin: create or update a greeting variant */
  upsertGreetingVariant: protectedProcedure
    .input(
      z.object({
        variantKey: z.string().min(1).max(64),
        greetingText: z.string().min(1).max(2000),
        description: z.string().max(255).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Check if variant exists
      const [existing] = await db
        .select()
        .from(greetingVariants)
        .where(eq(greetingVariants.variantKey, input.variantKey))
        .limit(1);

      if (existing) {
        await db
          .update(greetingVariants)
          .set({
            greetingText: input.greetingText,
            description: input.description,
            isActive: input.isActive ?? existing.isActive,
          })
          .where(eq(greetingVariants.variantKey, input.variantKey));
      } else {
        await db.insert(greetingVariants).values({
          variantKey: input.variantKey,
          greetingText: input.greetingText,
          description: input.description,
          isActive: input.isActive ?? true,
        });
      }

      return { success: true };
    }),

  /** Admin: delete a greeting variant */
  deleteGreetingVariant: protectedProcedure
    .input(
      z.object({
        variantKey: z.string().min(1).max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .delete(greetingVariants)
        .where(eq(greetingVariants.variantKey, input.variantKey));

      return { success: true };
    }),

  /** Admin: toggle a greeting variant active/inactive */
  toggleGreetingVariant: protectedProcedure
    .input(
      z.object({
        variantKey: z.string().min(1).max(64),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(greetingVariants)
        .set({ isActive: input.isActive })
        .where(eq(greetingVariants.variantKey, input.variantKey));

      return { success: true };
    }),

  /* ─── Uncertain Answers History ─── */

  /** Admin: list uncertain answers with optional filters */
  uncertainAnswersList: protectedProcedure
    .input(
      z.object({
        resolved: z.boolean().optional(), // filter by resolved status
        limit: z.number().min(1).max(200).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [];
      if (input?.resolved !== undefined) {
        conditions.push(eq(uncertainAnswers.resolved, input.resolved));
      }

      const limit = input?.limit ?? 100;

      const rows = conditions.length > 0
        ? await db.select().from(uncertainAnswers).where(and(...conditions)).orderBy(desc(uncertainAnswers.createdAt)).limit(limit)
        : await db.select().from(uncertainAnswers).orderBy(desc(uncertainAnswers.createdAt)).limit(limit);

      // Count totals
      const [totalRow] = await db.select({ count: sql<number>`count(*)` }).from(uncertainAnswers);
      const [unresolvedRow] = await db.select({ count: sql<number>`count(*)` }).from(uncertainAnswers).where(eq(uncertainAnswers.resolved, false));

      return {
        items: rows,
        totalCount: totalRow?.count ?? 0,
        unresolvedCount: unresolvedRow?.count ?? 0,
      };
    }),

  /** Admin: mark an uncertain answer as resolved with optional note */
  resolveUncertainAnswer: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        resolved: z.boolean(),
        adminNote: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(uncertainAnswers)
        .set({
          resolved: input.resolved,
          adminNote: input.adminNote ?? null,
          resolvedAt: input.resolved ? new Date() : null,
        })
        .where(eq(uncertainAnswers.id, input.id));

      return { success: true };
    }),

  /** Admin: delete an uncertain answer entry */
  deleteUncertainAnswer: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .delete(uncertainAnswers)
        .where(eq(uncertainAnswers.id, input.id));

      return { success: true };
    }),
});
