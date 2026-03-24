/**
 * FAQ Chat Router — Masha AI Farm Manager
 *
 * Provides an LLM-powered chat endpoint where "Masha" answers questions
 * about the Sher Kozu farm, breeds, products, ownership model, and platform usage.
 * Tracks all questions in DB for analytics.
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import type { Message } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import { desc, sql, eq, gte, lt, and } from "drizzle-orm";
import { faqQuestions, greetingVariants, abTestSessions, uncertainAnswers } from "../../drizzle/schema";
import { getDb } from "../db";
import { notifyOwner } from "../_core/notification";

/* ─── Uncertainty detection ─── */
const UNCERTAIN_PHRASES = [
  "извините",
  "не знаю",
  "не уверена",
  "затрудняюсь",
  "не могу сказать точно",
  "не располагаю информацией",
  "лучше связаться с фермой",
  "свяжитесь напрямую",
  "не в моей компетенции",
  "к сожалению, этот вопрос",
  "не могу ответить",
  "у меня нет данных",
];

function isUncertainAnswer(answer: string): boolean {
  const lower = answer.toLowerCase();
  return UNCERTAIN_PHRASES.some((phrase) => lower.includes(phrase));
}

/** Fire-and-forget: notify owner AND save to uncertainAnswers table */
async function notifyUncertainAnswer(
  question: string,
  answer: string,
  source: string,
  sessionId: string
) {
  // Save to DB for admin review
  try {
    const db = await getDb();
    if (db) {
      await db.insert(uncertainAnswers).values({
        question,
        answer,
        source,
        sessionId,
      });
    }
  } catch (err) {
    console.error("[FAQ] Failed to save uncertain answer to DB:", err);
  }

  // Notify owner
  try {
    await notifyOwner({
      title: `🤔 Маша не смогла уверенно ответить`,
      content: `**Вопрос пользователя:** ${question}\n\n**Ответ Маши:** ${answer}\n\n**Источник:** ${source}\n**Session:** ${sessionId}\n\n_Рекомендуется дополнить базу знаний Маши по этой теме._`,
    });
  } catch (err) {
    console.error("[FAQ] Failed to notify owner about uncertain answer:", err);
  }
}

/* ─── Masha's knowledge base as system prompt ─── */
const MASHA_SYSTEM_PROMPT = `Ты — Маша, AI-управляющая семейной фермой «Шерь Козу» (Sher Family Farm, SFF).
Ты красивая, приятная девушка-фермер. Говоришь спокойно, ласково, нежно, с лёгким обаянием.
Отвечай на русском языке. Будь дружелюбной, но информативной. Используй факты из базы знаний ниже.

═══ БАЗА ЗНАНИЙ ═══

## О ферме
- Основатель: Андрей Шипелов — глава семьи
- Расположение: Истринский район Подмосковья, 65 км от Москвы по Новорижскому шоссе — один из самых чистых уголков Подмосковья
- Концепция: первый в России клуб персонального фермерства
- Модель: вы выбираете конкретное животное с именем, историей и прозрачным происхождением, наблюдаете за его жизнью и получаете именные молочные продукты

## Как это работает (3 шага)
1. **Выбираете животное** — не обезличенную корзину продуктов, а конкретную козу или овцу с именем, историей и прозрачным происхождением
2. **Следите за жизнью на ферме** — дашборд, дневник, прямой эфир и события клуба превращают фермерство в личный ритм
3. **Получаете продукты именно от неё** — трекер показывает путь молока и именных продуктов от надоя до доставки

## Породы коз
### Англо-Нубийская коза
- Происхождение: Великобритания (скрещивание африканских и индийских пород)
- Молоко: жирность 5-8%, сливочный вкус без запаха
- Характер: общительные, привязываются к хозяину
- Особенности: длинные висячие уши, римский профиль носа
- Продукты: идеальны для сыров, йогуртов, масла

### Альпийская коза
- Происхождение: Французские Альпы
- Молоко: жирность 3.5-5.5%, рекордные удои среди молочных пород
- Характер: выносливые, любопытные, активные
- Особенности: разнообразие окрасов (шамуазе, ку блан, сюндгау)
- Продукты: большие объёмы молока для ежедневного потребления

## Породы овец
### Остфриз (Восточно-Фризская овца)
- Происхождение: Восточная Фризия, Германия
- Молоко: самая молочная порода овец в мире, до 600-700 литров за лактацию
- Жирность: 6-7%
- Характер: спокойные, послушные
- Продукты: овечьи сыры, брынза, рикотта

### Лакон
- Происхождение: юг Франции (регион Лакон)
- Молоко: жирность 7-8%, генетика Рокфора — именно из молока Лакон делают знаменитый сыр Рокфор
- Характер: неприхотливые, адаптивные
- Продукты: элитные выдержанные сыры, мягкие сыры

## Продукты
- Именные молочные продукты: молоко, сыры, йогурты, масло
- Сезонные подарочные наборы
- Трекер продуктов: показывает путь от надоя до доставки
- Доставка по Москве и Подмосковью

## Клуб владельцев
- Закрытый клуб для владельцев животных
- Мероприятия: ужины на ферме, визиты, мастер-классы по сыроварению
- Семейные ритуалы и праздники
- Лента новостей и событий клуба
- Система достижений и бейджей

## Платформа (сайт)
- Каталог животных: выбор козы или овцы с фото, описанием, характером
- Личный кабинет (Dashboard): статистика, дневник животного, уведомления
- Трекер продуктов: отслеживание пути молока от надоя до доставки
- Маркетплейс: фермерские продукты, подарочные наборы
- Профиль животного: фотогалерея, история, характер, медицинская карта
- Сравнение животных: можно сравнить несколько коз/овец по параметрам
- Таблица лидеров: рейтинг владельцев по активности

## Для кого
- Семьи с детьми: образовательный проект, живая связь с природой
- Гурманы и ценители: доступ к уникальным фермерским продуктам
- Осознанные потребители: прозрачность, экологичность, персональный подход
- Корпоративные подарки: именные наборы для партнёров и сотрудников

## Ценности
- Эмоциональная связь с животным
- Радикальная прозрачность (видите всё: от происхождения до доставки)
- Премиальная фермерская продукция
- Закрытое сообщество единомышленников

═══ ПРАВИЛА ОТВЕТОВ ═══
- Отвечай кратко и по делу, но тепло и с заботой
- Если вопрос не связан с фермой — мягко перенаправь к теме фермы
- Не выдумывай факты, которых нет в базе знаний
- Если не знаешь точного ответа — честно скажи и предложи связаться с фермой
- Используй эмодзи умеренно (1-2 на ответ максимум)
- Длина ответа: 2-5 предложений для простых вопросов, до 8-10 для сложных
- Обращайся к собеседнику на «вы»
- В конце длинных ответов можешь предложить задать ещё вопрос`;

/* ─── Rate limiting (simple in-memory) ─── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // messages per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkChatRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/* ─── Helper: save question to DB (fire-and-forget) ─── */
async function trackQuestion(
  question: string,
  answer: string,
  sessionId: string,
  source: string,
  userOpenId?: string | null
) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(faqQuestions).values({
      question,
      answer,
      sessionId,
      source,
      userOpenId: userOpenId ?? undefined,
    });
  } catch (err) {
    console.error("[FAQ Analytics] Failed to track question:", err);
  }
}

/* ─── Default greeting (used when no A/B variant is active) ─── */
const DEFAULT_GREETING = `Привет! 🌿 Я Маша, управляющая фермой «Шерь Козу». Спрашивайте меня о ферме, породах, продуктах или персональном фермерстве!`;

/* ─── Router ─── */
export const faqChatRouter = router({
  /** Send a message to Masha and get her response */
  chat: publicProcedure
    .input(
      z.object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(2000),
            })
          )
          .min(1)
          .max(50),
        sessionId: z.string().min(1).max(64).optional(),
        source: z.enum(["faq", "floating"]).optional(),
        userName: z.string().max(100).optional(),
        currentPage: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Build personalized system prompt
      let systemPrompt = MASHA_SYSTEM_PROMPT;
      if (input.userName) {
        systemPrompt += `\n\nСобеседника зовут ${input.userName}. Обращайся к нему/ней по имени.`;
      }
      if (input.currentPage) {
        systemPrompt += `\nСобеседник сейчас на странице: ${input.currentPage}. Учитывай это в контексте ответов.`;
      }

      // Build LLM messages with system prompt
      const llmMessages: Message[] = [
        { role: "system", content: systemPrompt },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Extract the last user question for analytics
      const lastUserMessage = [...input.messages]
        .reverse()
        .find((m) => m.role === "user");

      try {
        const result = await invokeLLM({
          messages: llmMessages,
          maxTokens: 1024,
        });

        const content = result.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") {
          return {
            reply:
              "Простите, у меня сейчас небольшие технические трудности. Попробуйте спросить ещё раз через минутку! 🌿",
          };
        }

        // Track question in DB (fire-and-forget, don't block response)
        if (lastUserMessage && input.sessionId) {
          trackQuestion(
            lastUserMessage.content,
            content,
            input.sessionId,
            input.source || "faq",
            ctx.user?.openId
          );
        }

        // Detect uncertain answers and notify owner (fire-and-forget)
        const uncertain = isUncertainAnswer(content);
        if (uncertain && lastUserMessage) {
          notifyUncertainAnswer(
            lastUserMessage.content,
            content,
            input.source || "faq",
            input.sessionId || "unknown"
          );
        }

        return { reply: content, uncertain };
      } catch (error) {
        console.error("[Masha Chat] LLM error:", error);
        return {
          reply:
            "Ой, что-то пошло не так с моей стороны. Пожалуйста, попробуйте позже или свяжитесь с фермой напрямую! 🐐",
        };
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
