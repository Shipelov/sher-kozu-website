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
import { faqQuestions } from "../../drizzle/schema";
import { getDb } from "../db";

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

        return { reply: content };
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
      const dailyStats = await db
        .select({
          date: sql<string>`DATE(${faqQuestions.createdAt})`,
          count: sql<number>`count(*)`,
        })
        .from(faqQuestions)
        .where(gte(faqQuestions.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .groupBy(sql`DATE(${faqQuestions.createdAt})`)
        .orderBy(sql`DATE(${faqQuestions.createdAt})`);

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
});
