/**
 * Nutritionist Router — Zoya AI Nutritionist
 *
 * tRPC procedures for:
 * - Chat sessions & messages (non-streaming, for tRPC)
 * - Nutrition profiles
 * - Meal plans
 * - Knowledge base CRUD (admin)
 * - Knowledge imports & search jobs (admin)
 * - Recipes
 * - Analytics (admin)
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import type { Message } from "../_core/llm";
import { TRPCError } from "@trpc/server";
import {
  createNutriSession,
  getNutriSession,
  listUserSessions,
  addNutriMessage,
  getSessionMessages,
  getGuestMessageCount,
  getNutriProfile,
  upsertNutriProfile,
  saveMealPlan,
  listMealPlans,
  deleteMealPlan,
  toggleMealPlanFavorite,
  searchKnowledge,
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  createKnowledgeImport,
  listKnowledgeImports,
  updateKnowledgeImport,
  createSearchJob,
  listSearchJobs,
  updateSearchJob,
  getSearchSettings,
  upsertSearchSettings,
  listRecipes,
  determineNutriUserType,
  getOwnerNutriContext,
  getNutriAnalytics,
  getNutriAnalyticsExtended,
} from "../nutritionistDb";
import {
  buildZoyaPrompt,
  type ZoyaUserContext,
} from "../prompts/zoyaSystemPrompt";
import { getZoyaRagEntries } from "../zoyaRag";
import { buildGroundedSportsMenuReply } from "../zoyaSportsMenuAdvisor";
import {
  invokeZoyaLLM,
  ZOYA_TEMPORARY_UNAVAILABLE_REPLY,
} from "../zoyaChatRuntime";

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const GUEST_MESSAGE_LIMIT = 3;

// Rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════

export const nutritionistRouter = router({
  // ─── Chat (non-streaming fallback via tRPC) ────────────────────
  chat: publicProcedure
    .input(
      z.object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(10000),
            })
          )
          .min(1)
          .max(50),
        sessionId: z.number().optional(),
        fingerprint: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Rate limiting
      const rateLimitKey = ctx.user?.openId || "anonymous";
      if (!checkRateLimit(rateLimitKey)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много сообщений. Попробуйте через несколько минут.",
        });
      }

      // Determine user type
      const userType = await determineNutriUserType(ctx.user?.id);

      // Guest limit check
      if (userType === "guest" && input.fingerprint) {
        const guestCount = await getGuestMessageCount(input.fingerprint);
        if (guestCount >= GUEST_MESSAGE_LIMIT) {
          return {
            reply:
              "Вы использовали все 3 бесплатных сообщения. Зарегистрируйтесь, чтобы продолжить общение с Зоей и получить персональные рекомендации по питанию — это бесплатно и займёт минуту 🌿",
            limitReached: true,
            userType,
          };
        }
      }

      // Build user context
      const userContext: ZoyaUserContext = {
        userType,
        userName: ctx.user?.name,
        messageCountInSession: input.messages.filter((m) => m.role === "user").length - 1,
        totalGuestMessages:
          userType === "guest" && input.fingerprint
            ? await getGuestMessageCount(input.fingerprint)
            : undefined,
      };

      // Load profile for registered/owner users
      if (ctx.user?.id && userType !== "guest") {
        const profile = await getNutriProfile(ctx.user.id);
        userContext.profile = profile;
      }

      // Load owner context for Type 2 users
      if (ctx.user?.id && userType === "owner") {
        userContext.ownerContext = await getOwnerNutriContext(ctx.user.id);
      }

      const lastUserMsg = [...input.messages].reverse().find((m) => m.role === "user");
      const groundedSportsReply = buildGroundedSportsMenuReply(input.messages, userContext);
      if (groundedSportsReply && lastUserMsg) {
        saveNutriChatAsync(
          input.sessionId ?? null,
          ctx.user?.id ?? null,
          lastUserMsg.content,
          groundedSportsReply,
          userType,
          input.fingerprint,
        );
        return {
          reply: groundedSportsReply,
          userType,
          limitReached: false,
        };
      }

      // RAG: search knowledge base for relevant entries
      const ragEntries = await getZoyaRagEntries(lastUserMsg?.content);

      // Build system prompt
      const systemPrompt = buildZoyaPrompt({
        user: userContext,
        ragEntries,
        currentQuery: lastUserMsg?.content,
      });

      // Build LLM messages
      const llmMessages: Message[] = [
        { role: "system", content: systemPrompt },
        ...input.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      try {
        const result = await invokeZoyaLLM(llmMessages);

        const content = result.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") {
          return {
            reply: ZOYA_TEMPORARY_UNAVAILABLE_REPLY,
            userType,
          };
        }

        // Save session & messages (fire-and-forget)
        if (lastUserMsg) {
          saveNutriChatAsync(
            input.sessionId ?? null,
            ctx.user?.id ?? null,
            lastUserMsg.content,
            content,
            userType,
            input.fingerprint
          );
        }

        return {
          reply: content,
          userType,
          limitReached: false,
        };
      } catch (error) {
        console.error("[Zoya Chat] LLM error:", error);
        return {
          reply: ZOYA_TEMPORARY_UNAVAILABLE_REPLY,
          userType,
        };
      }
    }),

  // ─── Sessions ──────────────────────────────────────────────────
  listSessions: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listUserSessions(ctx.user.id, input?.limit);
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getNutriSession(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return session;
    }),

  getMessages: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      const session = await getNutriSession(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return getSessionMessages(input.sessionId);
    }),

  // ─── Nutrition Profile ─────────────────────────────────────────
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return getNutriProfile(ctx.user.id);
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        goals: z.array(z.string()).optional(),
        allergies: z.array(z.string()).optional(),
        restrictions: z.array(z.string()).optional(),
        familyMembers: z
          .array(
            z.object({
              name: z.string(),
              age: z.number().optional(),
              notes: z.string().optional(),
            })
          )
          .optional(),
        preferredProducts: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return upsertNutriProfile(ctx.user.id, input);
    }),

  // ─── Meal Plans ────────────────────────────────────────────────
  listMealPlans: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      return listMealPlans(ctx.user.id);
    }),

  saveMealPlan: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        goal: z.string().max(500).optional(),
        planData: z.any(),
        sessionId: z.number().optional(),
        animalId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return saveMealPlan({
        userId: ctx.user.id,
        title: input.title,
        goal: input.goal,
        planData: input.planData,
        sessionId: input.sessionId,
        animalId: input.animalId,
      });
    }),

  deleteMealPlan: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteMealPlan(input.planId, ctx.user.id);
    }),

  toggleMealPlanFavorite: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return toggleMealPlanFavorite(input.planId, ctx.user.id);
    }),

  // ─── Recipes (public) ─────────────────────────────────────────
  listRecipes: publicProcedure
    .input(
      z
        .object({
          goals: z.array(z.string()).optional(),
          season: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().min(1).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listRecipes(input ?? undefined);
    }),

  // ─── Knowledge Base ─────────────────────────────────────────────
  knowledge: router({
    // Public: list active knowledge entries
    list: publicProcedure
      .input(
        z
          .object({
            category: z.string().optional(),
            status: z.string().optional(),
            search: z.string().optional(),
            limit: z.number().min(1).max(100).optional(),
            offset: z.number().min(0).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        return listKnowledge({
          category: input?.category,
          status: input?.status,
          search: input?.search,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    // Public: search knowledge base
    search: publicProcedure
      .input(
        z.object({
          query: z.string().min(1).max(500),
          limit: z.number().min(1).max(20).optional(),
        })
      )
      .query(async ({ input }) => {
        return searchKnowledge(input.query, { limit: input.limit ?? 10 });
      }),

    // Public: get single entry by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const all = await listKnowledge({ limit: 1000, offset: 0 });
        const entry = all.items.find((e: any) => e.id === input.id);
        if (!entry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge entry not found" });
        }
        return entry;
      }),

    create: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(500),
          content: z.string().min(1),
          category: z.enum([
            "nutrition_science",
            "breed_profile",
            "product_info",
            "recipe",
            "health_goal",
            "general",
          ]),
          tags: z.array(z.string()).optional(),
          sourceName: z.string().max(500).optional(),
          sourceUrl: z.string().max(2000).optional(),
          confidence: z.enum(["verified", "trusted", "unverified"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createKnowledge({
          title: input.title,
          content: input.content,
          category: input.category,
          tags: input.tags ?? null,
          sourceName: input.sourceName ?? null,
          sourceUrl: input.sourceUrl ?? null,
          confidence: input.confidence ?? "verified",
          status: "active",
        });
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(500).optional(),
          content: z.string().min(1).optional(),
          category: z
            .enum([
              "nutrition_science",
              "breed_profile",
              "product_info",
              "recipe",
              "health_goal",
              "general",
            ])
            .optional(),
          tags: z.array(z.string()).optional(),
          sourceName: z.string().max(500).optional(),
          sourceUrl: z.string().max(2000).optional(),
          confidence: z.enum(["verified", "trusted", "unverified"]).optional(),
          status: z.enum(["active", "pending_review", "conflict", "archived"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, tags, ...rest } = input;
        return updateKnowledge(id, {
          ...rest,
          ...(tags !== undefined ? { tags } : {}),
        });
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteKnowledge(input.id);
      }),

    // ─── File Import ───────────────────────────────────────────
    importFile: adminProcedure
      .input(
        z.object({
          fileName: z.string(),
          fileKey: z.string(),
          sourceUrl: z.string().optional(),
          sourceType: z.enum(["file_upload", "url_import"]).default("file_upload"),
        })
      )
      .mutation(async ({ input }) => {
        // Create import record in "processing" status
        const importRecord = await createKnowledgeImport({
          sourceType: input.sourceType,
          fileName: input.fileName,
          fileKey: input.fileKey,
          sourceUrl: input.sourceUrl ?? null,
          status: "processing",
          factsExtracted: 0,
          factsNew: 0,
          factsConflict: 0,
        });

        // Process asynchronously (fire-and-forget)
        processFileImport(importRecord.id, input.fileKey, input.sourceType, input.sourceUrl)
          .catch((err: unknown) => console.error("[Zoya Import] Error:", err));

        return importRecord;
      }),

    listImports: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
      .query(async ({ input }) => {
        return listKnowledgeImports(input?.limit);
      }),

    // ─── Auto-Search ───────────────────────────────────────────
    triggerSearch: adminProcedure
      .input(
        z
          .object({
            topics: z.array(z.string()).optional(),
          })
          .optional()
      )
      .mutation(async ({ ctx, input }) => {
        const job = await createSearchJob({
          triggeredBy: ctx.user.id,
          queries: input?.topics || [],
        });

        // Process asynchronously
        processSearchJob(job.id, input?.topics).catch((err: unknown) =>
          console.error("[Zoya Search] Error:", err)
        );

        return job;
      }),

    listSearchJobs: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(20).optional() }).optional())
      .query(async ({ input }) => {
        return listSearchJobs(input?.limit);
      }),

    getSearchSettings: adminProcedure.query(async () => {
      return getSearchSettings();
    }),

    updateSearchSettings: adminProcedure
      .input(
        z.object({
          autoSearchEnabled: z.boolean().optional(),
          cronSchedule: z.string().max(64).optional(),
          priorityTopics: z.array(z.string()).optional(),
          trustedSources: z.array(z.string()).optional(),
          excludedSources: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        return upsertSearchSettings({
          autoSearchEnabled: input.autoSearchEnabled,
          cronSchedule: input.cronSchedule,
          priorityTopics: input.priorityTopics,
          trustedSources: input.trustedSources,
          excludedSources: input.excludedSources,
        });
      }),
  }),

  // ─── Analytics (admin) ─────────────────────────────────────────
  analytics: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).optional() }).optional())
    .query(async ({ input }) => {
      return getNutriAnalytics(input?.days);
    }),

  // ─── Extended Analytics (admin dashboard) ─────────────────────
  analyticsExtended: adminProcedure
    .input(z.object({ days: z.number().min(1).max(365).optional() }).optional())
    .query(async ({ input }) => {
      return getNutriAnalyticsExtended(input?.days);
    }),
});

// ═══════════════════════════════════════════════════════════════════
// Async Helpers (fire-and-forget)
// ═══════════════════════════════════════════════════════════════════

async function saveNutriChatAsync(
  sessionId: number | null,
  userId: number | null,
  userMessage: string,
  assistantReply: string,
  userType: "guest" | "registered" | "owner",
  fingerprint?: string | null
) {
  try {
    let sid: number;

    // Create session if needed
    if (sessionId) {
      sid = sessionId;
    } else {
      const session = await createNutriSession({
        userId,
        userType,
        guestFingerprint: fingerprint ?? null,
      });
      sid = session.id;
    }

    // Save user message
    await addNutriMessage({
      sessionId: sid,
      role: "user",
      content: userMessage,
    });

    // Save assistant reply
    await addNutriMessage({
      sessionId: sid,
      role: "assistant",
      content: assistantReply,
    });
  } catch (err) {
    console.error("[Zoya] Failed to save chat:", err);
  }
}

/**
 * Process a file import: extract text, analyze with LLM, check conflicts, save entries.
 */
async function processFileImport(
  importId: number,
  fileKey: string,
  sourceType: string,
  sourceUrl?: string | null
) {
  try {
    // Step 1: Extract text from file using LLM (it can read PDFs/docs via file_url)
    const extractionPrompt = `Ты — ассистент по извлечению знаний о нутрициологии.
Проанализируй приложенный файл и извлеки из него ВСЕ факты, связанные с:
- Питанием и здоровьем
- Козьим и овечьим молоком и продуктами его переработки
- Нутрициологией, диетологией
- Составом продуктов, витаминами, минералами
- Рецептами и планами питания

Для КАЖДОГО факта верни JSON-объект в массиве:
{
  "title": "Краткий заголовок факта",
  "content": "Полное описание факта с цифрами и деталями",
  "category": "одна из: nutrition_science | breed_profile | product_info | recipe | health_goal | general",
  "confidence": "одна из: verified | trusted | unverified"
}

Верни ТОЛЬКО JSON-массив, без пояснений.`;

    const fileUrl = sourceUrl || fileKey;
    const isPdf = fileKey.endsWith(".pdf") || sourceType === "file_upload";

    const result = await invokeLLM({
      messages: [
        { role: "system", content: extractionPrompt },
        {
          role: "user",
          content: isPdf
            ? [
                {
                  type: "file_url" as const,
                  file_url: { url: fileUrl, mime_type: "application/pdf" as const },
                },
              ]
            : `Проанализируй содержимое по ссылке: ${fileUrl}`,
        },
      ],
    });

    const responseText = result.choices?.[0]?.message?.content;
    if (!responseText || typeof responseText !== "string") {
      await updateKnowledgeImport(importId, {
        status: "rejected",
        report: { extractedFacts: [], summary: "LLM returned empty response" },
      });
      return;
    }

    // Parse extracted entries
    let entries: Array<{
      title: string;
      content: string;
      category: string;
      confidence: string;
    }>;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      entries = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch {
      await updateKnowledgeImport(importId, {
        status: "rejected",
        report: { extractedFacts: [], summary: "Failed to parse LLM response as JSON" },
      });
      return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      await updateKnowledgeImport(importId, {
        status: "approved",
        factsExtracted: 0,
        factsNew: 0,
        factsConflict: 0,
        report: { extractedFacts: [], summary: "No relevant facts found in file" },
      });
      return;
    }

    // Step 2: Check for conflicts with existing knowledge
    let created = 0;
    let conflicts = 0;
    const extractedFacts: Array<{
      title: string;
      content: string;
      category: string;
      isNew: boolean;
      conflictsWith?: number;
      conflictDetails?: string;
    }> = [];

    const validCategories = [
      "nutrition_science",
      "breed_profile",
      "product_info",
      "recipe",
      "health_goal",
      "general",
    ] as const;
    const validConfidence = ["verified", "trusted", "unverified"] as const;

    for (const entry of entries) {
      // Validate category
      const category = validCategories.includes(entry.category as any)
        ? (entry.category as (typeof validCategories)[number])
        : "general";
      const confidence = validConfidence.includes(entry.confidence as any)
        ? (entry.confidence as (typeof validConfidence)[number])
        : "unverified";

      // Search for similar existing entries
      const existing = await searchKnowledge(entry.title, { limit: 3 });
      const conflictEntry = existing.find((e) => {
        const titleSimilarity = calculateSimilarity(
          e.title.toLowerCase(),
          entry.title.toLowerCase()
        );
        return titleSimilarity > 0.7;
      });

      if (conflictEntry) {
        conflicts++;
        extractedFacts.push({
          title: entry.title,
          content: entry.content,
          category,
          isNew: false,
          conflictsWith: conflictEntry.id,
          conflictDetails: `Похоже на: "${conflictEntry.title}"`,
        });
        // Save as pending_review for manual review
        await createKnowledge({
          title: `[КОНФЛИКТ] ${entry.title}`,
          content: entry.content,
          category,
          confidence,
          sourceName: sourceUrl || fileKey,
          sourceUrl: sourceUrl || null,
          status: "pending_review",
          tags: null,
        });
      } else {
        extractedFacts.push({
          title: entry.title,
          content: entry.content,
          category,
          isNew: true,
        });
        await createKnowledge({
          title: entry.title,
          content: entry.content,
          category,
          confidence,
          sourceName: sourceUrl || fileKey,
          sourceUrl: sourceUrl || null,
          status: "active",
          tags: null,
        });
        created++;
      }
    }

    await updateKnowledgeImport(importId, {
      status: conflicts > 0 ? "partially_approved" : "approved",
      factsExtracted: entries.length,
      factsNew: created,
      factsConflict: conflicts,
      report: {
        extractedFacts,
        summary: `Извлечено ${entries.length} фактов: ${created} новых, ${conflicts} конфликтов`,
      },
    });
  } catch (err: any) {
    console.error("[Zoya Import] Processing error:", err);
    await updateKnowledgeImport(importId, {
      status: "rejected",
      report: {
        extractedFacts: [],
        summary: err?.message || "Unknown error during processing",
      },
    });
  }
}

/**
 * Process a "Find New Knowledge" search job.
 */
async function processSearchJob(jobId: number, topics?: string[]) {
  try {
    // Get search settings
    const settings = await getSearchSettings();

    // Build search queries from topics + priority topics
    const allTopics = [
      ...(topics || []),
      ...(settings?.priorityTopics || []),
    ];

    if (allTopics.length === 0) {
      // Default topics
      allTopics.push(
        "козье молоко польза исследования",
        "овечье молоко нутрициология",
        "A2 казеин здоровье",
        "ферментированные молочные продукты микробиом",
        "козий сыр витамины минералы"
      );
    }

    // Use LLM to generate search queries
    const queryGenResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Ты — ассистент по поиску научных знаний о нутрициологии козьего и овечьего молока.
На основе списка тем сгенерируй 10-15 поисковых запросов для поиска НОВЫХ научных фактов.
Запросы должны быть на русском и английском языке.
Верни JSON-массив строк. Только массив, без пояснений.`,
        },
        {
          role: "user",
          content: `Темы: ${allTopics.join(", ")}`,
        },
      ],
    });

    const queriesText = queryGenResult.choices?.[0]?.message?.content;
    let queries: string[] = [];
    try {
      if (typeof queriesText === "string") {
        const jsonMatch = queriesText.match(/\[[\s\S]*\]/);
        queries = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(queriesText);
      }
    } catch {
      queries = allTopics;
    }

    await updateSearchJob(jobId, { queries });

    // Use LLM to "search" by generating knowledge based on its training data
    const searchResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Ты — эксперт-нутрициолог с доступом к последним научным исследованиям.
На основе поисковых запросов предоставь НОВЫЕ научные факты о козьем и овечьем молоке.
Для каждого факта укажи:
- title: краткий заголовок
- content: подробное описание с цифрами
- category: nutrition_science | breed_profile | product_info | recipe | health_goal | general
- confidence: verified | trusted | unverified
- sourceName: название источника (журнал, исследование)

Верни JSON-массив объектов. Только массив.`,
        },
        {
          role: "user",
          content: `Поисковые запросы:\n${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
        },
      ],
    });

    const searchText = searchResult.choices?.[0]?.message?.content;
    let newEntries: Array<{
      title: string;
      content: string;
      category: string;
      confidence: string;
      sourceName?: string;
    }> = [];
    try {
      if (typeof searchText === "string") {
        const jsonMatch = searchText.match(/\[[\s\S]*\]/);
        newEntries = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(searchText);
      }
    } catch {
      await updateSearchJob(jobId, { status: "failed" });
      return;
    }

    await updateSearchJob(jobId, { resultsFound: newEntries.length });

    // Check conflicts and save
    let added = 0;
    let conflictsCount = 0;
    const validCategories = [
      "nutrition_science",
      "breed_profile",
      "product_info",
      "recipe",
      "health_goal",
      "general",
    ] as const;
    const validConfidence = ["verified", "trusted", "unverified"] as const;

    const proposedFacts: Array<{
      title: string;
      content: string;
      category: string;
      source: string;
      conflictsWith?: number;
    }> = [];

    for (const entry of newEntries) {
      const category = validCategories.includes(entry.category as any)
        ? (entry.category as (typeof validCategories)[number])
        : "general";
      const confidence = validConfidence.includes(entry.confidence as any)
        ? (entry.confidence as (typeof validConfidence)[number])
        : "unverified";

      const existing = await searchKnowledge(entry.title, { limit: 3 });
      const conflictEntry = existing.find((e) => {
        const sim = calculateSimilarity(e.title.toLowerCase(), entry.title.toLowerCase());
        return sim > 0.6;
      });

      if (conflictEntry) {
        conflictsCount++;
        proposedFacts.push({
          title: entry.title,
          content: entry.content,
          category,
          source: entry.sourceName || "Auto-search",
          conflictsWith: conflictEntry.id,
        });
        await createKnowledge({
          title: `[АВТО-ПОИСК/КОНФЛИКТ] ${entry.title}`,
          content: entry.content,
          category,
          confidence,
          sourceName: entry.sourceName || "Auto-search",
          status: "pending_review",
          tags: null,
        });
      } else {
        proposedFacts.push({
          title: entry.title,
          content: entry.content,
          category,
          source: entry.sourceName || "Auto-search",
        });
        await createKnowledge({
          title: entry.title,
          content: entry.content,
          category,
          confidence,
          sourceName: entry.sourceName || "Auto-search",
          status: "active",
          tags: null,
        });
        added++;
      }
    }

    await updateSearchJob(jobId, {
      status: "completed",
      resultsFound: newEntries.length,
      factsProposed: added + conflictsCount,
      report: {
        sources: [],
        proposedFacts,
        summary: `Найдено ${newEntries.length} фактов: ${added} добавлено, ${conflictsCount} конфликтов`,
      },
    });
  } catch (err: any) {
    console.error("[Zoya Search] Job error:", err);
    await updateSearchJob(jobId, { status: "failed" });
  }
}

/**
 * Simple string similarity (Dice coefficient).
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }

  let intersections = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = bigrams.get(bigram) || 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      intersections++;
    }
  }

  return (2.0 * intersections) / (a.length + b.length - 2);
}
