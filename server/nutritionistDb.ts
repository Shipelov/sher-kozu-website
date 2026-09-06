/**
 * Nutritionist (Zoya) — Database helpers
 *
 * All DB operations for the AI nutritionist feature.
 * Separated from main db.ts to keep files manageable.
 */

import { eq, desc, and, like, or, sql, gte, lt, inArray } from "drizzle-orm";
import {
  nutriSessions,
  nutriMessages,
  nutriProfiles,
  nutriMealPlans,
  nutriKnowledge,
  nutriKnowledgeImports,
  nutriSearchJobs,
  nutriRecipes,
  nutriSearchSettings,
  animalOwnerships,
  animals,
  users,
  ownerProductPlans,
  deliverySchedule,
  productCompositionSnapshots,
  productMonthlyMetrics,
  animalProductionProfiles,
  productOptions,
  type InsertNutriSession,
  type InsertNutriMessage,
  type InsertNutriProfile,
  type InsertNutriMealPlan,
  type InsertNutriKnowledgeEntry,
  type InsertNutriKnowledgeImport,
  type InsertNutriSearchJob,
  type NutriKnowledgeEntry,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  buildKnowledgeSearchPlan,
  rankKnowledgeEntries,
} from "./zoyaKnowledgeRetrieval";
import {
  createNutritionProfile,
  getPrimaryNutritionProfile,
  updateNutritionProfile,
} from "./zoyaProfiles";

// ═══════════════════════════════════════════════════════════════════
// Sessions
// ═══════════════════════════════════════════════════════════════════

export async function createNutriSession(data: {
  userId?: number | null;
  profileId?: number | null;
  profileConfirmedAt?: Date | null;
  contextState?: {
    intent?: string;
    pendingField?: string;
    collected?: Record<string, string | number | boolean | string[]>;
  } | null;
  userType: "guest" | "registered" | "owner";
  guestFingerprint?: string | null;
  goal?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriSessions).values({
    userId: data.userId ?? undefined,
    profileId: data.profileId ?? undefined,
    profileConfirmedAt: data.profileConfirmedAt ?? undefined,
    contextState: data.contextState ?? undefined,
    userType: data.userType,
    guestFingerprint: data.guestFingerprint ?? undefined,
    goal: data.goal ?? undefined,
  }).$returningId();

  const [session] = await db
    .select()
    .from(nutriSessions)
    .where(eq(nutriSessions.id, result.id))
    .limit(1);

  return session;
}

export async function getNutriSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [session] = await db
    .select()
    .from(nutriSessions)
    .where(eq(nutriSessions.id, sessionId))
    .limit(1);

  if (!session) return null;

  const messages = await db
    .select()
    .from(nutriMessages)
    .where(eq(nutriMessages.sessionId, sessionId))
    .orderBy(nutriMessages.createdAt);

  return { ...session, messages };
}

export async function updateNutriSessionContext(
  sessionId: number,
  userId: number,
  data: {
    profileId?: number | null;
    profileConfirmedAt?: Date | null;
    contextState?: {
      intent?: string;
      pendingField?: string;
      collected?: Record<string, string | number | boolean | string[]>;
    } | null;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const set: Record<string, unknown> = {};
  if (data.profileId !== undefined) set.profileId = data.profileId;
  if (data.profileConfirmedAt !== undefined) set.profileConfirmedAt = data.profileConfirmedAt;
  if (data.contextState !== undefined) set.contextState = data.contextState;
  if (Object.keys(set).length === 0) return getNutriSession(sessionId);

  await db
    .update(nutriSessions)
    .set(set)
    .where(and(eq(nutriSessions.id, sessionId), eq(nutriSessions.userId, userId)));
  return getNutriSession(sessionId);
}

export async function listUserSessions(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  return db
    .select()
    .from(nutriSessions)
    .where(eq(nutriSessions.userId, userId))
    .orderBy(desc(nutriSessions.updatedAt))
    .limit(limit);
}

export async function updateSessionMessageCount(sessionId: number) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(nutriSessions)
    .set({ messageCount: sql`${nutriSessions.messageCount} + 1` })
    .where(eq(nutriSessions.id, sessionId));
}

// ═══════════════════════════════════════════════════════════════════
// Messages
// ═══════════════════════════════════════════════════════════════════

export async function addNutriMessage(data: {
  sessionId: number;
  role: "user" | "assistant" | "system";
  content: string;
  tokenCount?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriMessages).values({
    sessionId: data.sessionId,
    role: data.role,
    content: data.content,
    tokenCount: data.tokenCount ?? undefined,
  }).$returningId();

  // Increment session message count
  await updateSessionMessageCount(data.sessionId);

  const [message] = await db
    .select()
    .from(nutriMessages)
    .where(eq(nutriMessages.id, result.id))
    .limit(1);

  return message;
}

export async function saveNutriConversation(data: {
  sessionId?: number | null;
  userId?: number | null;
  userType: "guest" | "registered" | "owner";
  guestFingerprint?: string | null;
  profileId?: number | null;
  profileConfirmed?: boolean;
  contextState?: {
    intent?: string;
    pendingField?: string;
    collected?: Record<string, string | number | boolean | string[]>;
  } | null;
  userMessage: string;
  assistantReply: string;
}): Promise<number> {
  let sessionId = data.sessionId ?? null;
  if (sessionId) {
    const existing = await getNutriSession(sessionId);
    const belongsToUser = data.userId
      ? existing?.userId === data.userId
      : existing?.userId == null && existing?.guestFingerprint === data.guestFingerprint;
    if (!belongsToUser) sessionId = null;
  }

  if (!sessionId) {
    const session = await createNutriSession({
      userId: data.userId,
      profileId: data.profileId,
      profileConfirmedAt: data.profileConfirmed ? new Date() : null,
      contextState: data.contextState,
      userType: data.userType,
      guestFingerprint: data.guestFingerprint,
    });
    sessionId = session.id;
  } else if (data.userId) {
    await updateNutriSessionContext(sessionId, data.userId, {
      profileId: data.profileId,
      profileConfirmedAt: data.profileConfirmed ? new Date() : null,
      contextState: data.contextState,
    });
  }

  if (!sessionId) throw new Error("NUTRITION_SESSION_NOT_CREATED");
  const resolvedSessionId = sessionId;
  await addNutriMessage({ sessionId: resolvedSessionId, role: "user", content: data.userMessage });
  await addNutriMessage({ sessionId: resolvedSessionId, role: "assistant", content: data.assistantReply });
  return resolvedSessionId;
}

export async function getSessionMessages(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  return db
    .select()
    .from(nutriMessages)
    .where(eq(nutriMessages.sessionId, sessionId))
    .orderBy(nutriMessages.createdAt);
}

/**
 * Count total messages sent by a guest (across all sessions) for rate limiting.
 */
export async function getGuestMessageCount(guestFingerprint: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMessages)
    .innerJoin(nutriSessions, eq(nutriMessages.sessionId, nutriSessions.id))
    .where(
      and(
        eq(nutriSessions.guestFingerprint, guestFingerprint),
        eq(nutriMessages.role, "user"),
      )
    );

  return result?.count ?? 0;
}

// ═══════════════════════════════════════════════════════════════════
// Nutrition Profiles
// ═══════════════════════════════════════════════════════════════════

export async function getNutriProfile(userId: number) {
  return getPrimaryNutritionProfile(userId);
}

export async function upsertNutriProfile(userId: number, data: {
  goals?: string[];
  allergies?: string[];
  restrictions?: string[];
  familyMembers?: Array<{ name: string; age?: number; notes?: string }>;
  preferredProducts?: string[];
}) {
  const existing = await getNutriProfile(userId);

  if (existing) {
    return updateNutritionProfile(userId, existing.id, {
      goals: data.goals,
      allergies: data.allergies,
      restrictions: data.restrictions,
      preferredProducts: data.preferredProducts,
    });
  }

  return createNutritionProfile(userId, {
    profileName: "Основной профиль",
    relationship: "self",
    goals: data.goals ?? [],
    allergies: data.allergies ?? [],
    restrictions: data.restrictions ?? [],
    preferredProducts: data.preferredProducts ?? [],
  });
}

// ═══════════════════════════════════════════════════════════════════
// Meal Plans
// ═══════════════════════════════════════════════════════════════════

export async function saveMealPlan(data: {
  userId: number;
  sessionId?: number;
  title: string;
  goal?: string;
  planData: any;
  animalId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriMealPlans).values({
    userId: data.userId,
    sessionId: data.sessionId ?? undefined,
    title: data.title,
    goal: data.goal ?? undefined,
    planData: data.planData,
    animalId: data.animalId ?? undefined,
  }).$returningId();

  const [plan] = await db
    .select()
    .from(nutriMealPlans)
    .where(eq(nutriMealPlans.id, result.id))
    .limit(1);

  return plan;
}

export async function listMealPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(nutriMealPlans)
    .where(eq(nutriMealPlans.userId, userId))
    .orderBy(desc(nutriMealPlans.createdAt));
}

export async function deleteMealPlan(planId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(nutriMealPlans)
    .where(and(eq(nutriMealPlans.id, planId), eq(nutriMealPlans.userId, userId)));

  return true;
}

export async function toggleMealPlanFavorite(planId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  const [plan] = await db
    .select()
    .from(nutriMealPlans)
    .where(and(eq(nutriMealPlans.id, planId), eq(nutriMealPlans.userId, userId)))
    .limit(1);

  if (!plan) return false;

  await db
    .update(nutriMealPlans)
    .set({ isFavorite: !plan.isFavorite })
    .where(eq(nutriMealPlans.id, planId));

  return true;
}

// ═══════════════════════════════════════════════════════════════════
// Knowledge Base
// ═══════════════════════════════════════════════════════════════════

export async function listKnowledge(filters?: {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (filters?.category) {
    conditions.push(eq(nutriKnowledge.category, filters.category as any));
  }
  if (filters?.status) {
    conditions.push(eq(nutriKnowledge.status, filters.status as any));
  }
  if (filters?.search) {
    conditions.push(like(nutriKnowledge.title, `%${filters.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  const items = await db
    .select()
    .from(nutriKnowledge)
    .where(whereClause)
    .orderBy(desc(nutriKnowledge.updatedAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriKnowledge)
    .where(whereClause);

  return { items, total: countResult?.count ?? 0 };
}

export async function createKnowledge(data: Omit<InsertNutriKnowledgeEntry, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriKnowledge).values(data).$returningId();

  const [entry] = await db
    .select()
    .from(nutriKnowledge)
    .where(eq(nutriKnowledge.id, result.id))
    .limit(1);

  return entry;
}

export async function updateKnowledge(id: number, data: Partial<InsertNutriKnowledgeEntry>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db
    .update(nutriKnowledge)
    .set(data)
    .where(eq(nutriKnowledge.id, id));

  const [entry] = await db
    .select()
    .from(nutriKnowledge)
    .where(eq(nutriKnowledge.id, id))
    .limit(1);

  return entry;
}

export async function deleteKnowledge(id: number) {
  const db = await getDb();
  if (!db) return false;

  await db.delete(nutriKnowledge).where(eq(nutriKnowledge.id, id));
  return true;
}

/**
 * Search the active knowledge base by normalized terms and rank candidates in memory.
 * The same function powers public search, tRPC chat and SSE chat retrieval.
 */
export async function searchKnowledge(query: string, options?: {
  category?: string;
  limit?: number;
  statusFilter?: string[];
}): Promise<NutriKnowledgeEntry[]> {
  const searchPlan = buildKnowledgeSearchPlan(query);
  if (searchPlan.terms.length === 0) return [];

  const db = await getDb();
  if (!db) return [];

  const limit = options?.limit ?? 10;
  if (limit <= 0) return [];
  const conditions = [
    eq(nutriKnowledge.status, "active"),
  ];

  if (options?.category) {
    conditions.push(eq(nutriKnowledge.category, options.category as any));
  }

  const termMatches = searchPlan.patterns.flatMap((term) => {
    const searchTerm = `%${term}%`;
    return [
      like(nutriKnowledge.title, searchTerm),
      like(nutriKnowledge.content, searchTerm),
      sql`CAST(${nutriKnowledge.tags} AS CHAR) LIKE ${searchTerm}`,
    ];
  });

  const candidateLimit = Math.min(Math.max(limit * 20, 80), 500);
  const candidates = await db
    .select()
    .from(nutriKnowledge)
    .where(and(...conditions, or(...termMatches)))
    .orderBy(desc(nutriKnowledge.updatedAt))
    .limit(candidateLimit);

  return rankKnowledgeEntries(candidates, query, limit);
}

// ═══════════════════════════════════════════════════════════════════
// Knowledge Imports
// ═══════════════════════════════════════════════════════════════════

export async function createKnowledgeImport(data: Omit<InsertNutriKnowledgeImport, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriKnowledgeImports).values(data).$returningId();

  const [entry] = await db
    .select()
    .from(nutriKnowledgeImports)
    .where(eq(nutriKnowledgeImports.id, result.id))
    .limit(1);

  return entry;
}

export async function updateKnowledgeImport(id: number, data: Partial<InsertNutriKnowledgeImport>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db
    .update(nutriKnowledgeImports)
    .set(data)
    .where(eq(nutriKnowledgeImports.id, id));

  const [entry] = await db
    .select()
    .from(nutriKnowledgeImports)
    .where(eq(nutriKnowledgeImports.id, id))
    .limit(1);

  return entry;
}

export async function listKnowledgeImports(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(nutriKnowledgeImports)
    .orderBy(desc(nutriKnowledgeImports.createdAt))
    .limit(limit);
}

export async function getKnowledgeImport(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [entry] = await db
    .select()
    .from(nutriKnowledgeImports)
    .where(eq(nutriKnowledgeImports.id, id))
    .limit(1);

  return entry ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// Search Jobs
// ═══════════════════════════════════════════════════════════════════

export async function createSearchJob(data: {
  triggeredBy?: number;
  queries: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriSearchJobs).values({
    triggeredBy: data.triggeredBy ?? undefined,
    queries: data.queries,
  }).$returningId();

  const [job] = await db
    .select()
    .from(nutriSearchJobs)
    .where(eq(nutriSearchJobs.id, result.id))
    .limit(1);

  return job;
}

export async function updateSearchJob(id: number, data: Partial<InsertNutriSearchJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  await db
    .update(nutriSearchJobs)
    .set(data)
    .where(eq(nutriSearchJobs.id, id));

  const [job] = await db
    .select()
    .from(nutriSearchJobs)
    .where(eq(nutriSearchJobs.id, id))
    .limit(1);

  return job;
}

export async function listSearchJobs(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(nutriSearchJobs)
    .orderBy(desc(nutriSearchJobs.createdAt))
    .limit(limit);
}

export async function getSearchJob(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [job] = await db
    .select()
    .from(nutriSearchJobs)
    .where(eq(nutriSearchJobs.id, id))
    .limit(1);

  return job ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// Search Settings
// ═══════════════════════════════════════════════════════════════════

export async function getSearchSettings() {
  const db = await getDb();
  if (!db) return null;

  const [settings] = await db
    .select()
    .from(nutriSearchSettings)
    .limit(1);

  return settings ?? null;
}

export async function upsertSearchSettings(data: {
  autoSearchEnabled?: boolean;
  cronSchedule?: string;
  priorityTopics?: string[];
  trustedSources?: string[];
  excludedSources?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const existing = await getSearchSettings();

  if (existing) {
    await db
      .update(nutriSearchSettings)
      .set(data)
      .where(eq(nutriSearchSettings.id, existing.id));

    return getSearchSettings();
  }

  await db.insert(nutriSearchSettings).values({
    autoSearchEnabled: data.autoSearchEnabled ?? false,
    cronSchedule: data.cronSchedule ?? "0 3 * * 1",
    priorityTopics: data.priorityTopics ?? [],
    trustedSources: data.trustedSources ?? [],
    excludedSources: data.excludedSources ?? [],
  });

  return getSearchSettings();
}

// ═══════════════════════════════════════════════════════════════════
// Owner Context (for personalized Zoya responses — Type 2 users)
// ═══════════════════════════════════════════════════════════════════

/**
 * Determine user type for Zoya based on authentication and ownership status.
 * Looks up user.openId first, then checks animalOwnerships by ownerOpenId.
 */
export async function determineNutriUserType(userId?: number | null): Promise<"guest" | "registered" | "owner"> {
  if (!userId) return "guest";

  const db = await getDb();
  if (!db) return "registered";

  // Resolve openId from userId
  const [user] = await db
    .select({ openId: users.openId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.openId) return "registered";

  // Check if user has any active ownership
  const [ownership] = await db
    .select({ id: animalOwnerships.id })
    .from(animalOwnerships)
    .where(
      and(
        eq(animalOwnerships.ownerOpenId, user.openId),
        eq(animalOwnerships.status, "active"),
      )
    )
    .limit(1);

  return ownership ? "owner" : "registered";
}

/**
 * Get rich context about an owner's animals and products for Zoya personalization.
 * Uses ownerOpenId (resolved from userId) to query ownership-related tables.
 */
export async function getOwnerNutriContext(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Resolve openId from userId
  const [user] = await db
    .select({ openId: users.openId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.openId) return null;

  // Get active ownerships with animal details
  const ownerships = await db
    .select({
      ownershipId: animalOwnerships.id,
      animalId: animalOwnerships.animalId,
      animalName: animals.name,
      animalSlug: animals.slug,
      species: animals.species,
      breed: animals.breed,
    })
    .from(animalOwnerships)
    .innerJoin(animals, eq(animalOwnerships.animalId, animals.id))
    .where(
      and(
        eq(animalOwnerships.ownerOpenId, user.openId),
        eq(animalOwnerships.status, "active"),
      )
    );

  if (!ownerships.length) return null;

  // ── Enrich each animal with real milk/product data ──
  type OwnershipRow = typeof ownerships[number];
  const animalSlugs = ownerships.map((o: OwnershipRow) => o.animalSlug);
  const animalIds = ownerships.map((o: OwnershipRow) => o.animalId);

  // 1. Real milk composition snapshots (label/value pairs per animal)
  const compositionRows = animalSlugs.length > 0
    ? await db
        .select()
        .from(productCompositionSnapshots)
        .where(
          and(
            inArray(productCompositionSnapshots.animalSlug, animalSlugs),
            eq(productCompositionSnapshots.ownerOpenId, user.openId),
          )
        )
        .orderBy(productCompositionSnapshots.sortOrder)
    : [];

  // 2. Monthly metrics (milk volume, protein%, fat% per month)
  const monthlyRows = animalSlugs.length > 0
    ? await db
        .select()
        .from(productMonthlyMetrics)
        .where(
          and(
            inArray(productMonthlyMetrics.animalSlug, animalSlugs),
            eq(productMonthlyMetrics.ownerOpenId, user.openId),
          )
        )
        .orderBy(productMonthlyMetrics.sortOrder)
    : [];

  // 3. Production profiles (annual milk yield per animal)
  const productionRows = animalIds.length > 0
    ? await db
        .select()
        .from(animalProductionProfiles)
        .where(inArray(animalProductionProfiles.animalId, animalIds))
    : [];

  // 4. Product options (what products are made from each animal's milk)
  const productOptionRows = animalIds.length > 0
    ? await db
        .select()
        .from(productOptions)
        .where(
          and(
            inArray(productOptions.animalId, animalIds),
            eq(productOptions.isEnabled, 1),
          )
        )
        .orderBy(productOptions.sortOrder)
    : [];

  // Group data by animal
  const enrichedAnimals = ownerships.map((o: OwnershipRow) => {
    const composition = compositionRows
      .filter((c: typeof productCompositionSnapshots.$inferSelect) => c.animalSlug === o.animalSlug)
      .map((c: typeof productCompositionSnapshots.$inferSelect) => ({ label: c.label, value: c.value, note: c.note }));

    const monthly = monthlyRows
      .filter((m: typeof productMonthlyMetrics.$inferSelect) => m.animalSlug === o.animalSlug)
      .map((m: typeof productMonthlyMetrics.$inferSelect) => ({
        month: m.monthLabel,
        milkLiters: m.milkVolumeLiters,
        proteinPercent: m.proteinPercentTenth / 10,
        fatPercent: m.fatPercentTenth / 10,
      }));

    const production = productionRows.find((p: typeof animalProductionProfiles.$inferSelect) => p.animalId === o.animalId);
    const products = productOptionRows
      .filter((p: typeof productOptions.$inferSelect) => p.animalId === o.animalId)
      .map((p: typeof productOptions.$inferSelect) => ({ label: p.label, type: p.productType, unit: p.unit }));

    return {
      ...o,
      milkComposition: composition,
      monthlyMetrics: monthly,
      annualMilkLiters: production?.annualMilkLiters ?? null,
      availableProducts: products,
    };
  });

  // Get product plans for the owner
  const productPlans = await db
    .select()
    .from(ownerProductPlans)
    .where(eq(ownerProductPlans.ownerOpenId, user.openId));

  // Get delivery schedule
  const deliveries = await db
    .select()
    .from(deliverySchedule)
    .where(eq(deliverySchedule.ownerOpenId, user.openId))
    .orderBy(desc(deliverySchedule.createdAt))
    .limit(5);

  return {
    animals: enrichedAnimals,
    productPlans,
    deliveries,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Recipes
// ═══════════════════════════════════════════════════════════════════

export async function listRecipes(filters?: {
  goals?: string[];
  season?: string;
  status?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(nutriRecipes.status, filters.status as any));
  }
  if (filters?.season && filters.season !== "all") {
    conditions.push(eq(nutriRecipes.season, filters.season as any));
  }

  return db
    .select()
    .from(nutriRecipes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(nutriRecipes.title)
    .limit(filters?.limit ?? 50);
}

// ═══════════════════════════════════════════════════════════════════
// Analytics helpers
// ═══════════════════════════════════════════════════════════════════

export async function getNutriAnalytics(days = 30) {
  const db = await getDb();
  if (!db) return null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalSessions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriSessions)
    .where(gte(nutriSessions.createdAt, since));

  const [totalMessages] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMessages)
    .where(gte(nutriMessages.createdAt, since));

  const userTypeBreakdown = await db
    .select({
      userType: nutriSessions.userType,
      count: sql<number>`count(*)`,
    })
    .from(nutriSessions)
    .where(gte(nutriSessions.createdAt, since))
    .groupBy(nutriSessions.userType);

  const [knowledgeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriKnowledge)
    .where(eq(nutriKnowledge.status, "active"));

  const [profileCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriProfiles);

  const [mealPlanCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMealPlans)
    .where(gte(nutriMealPlans.createdAt, since));

  return {
    period: { days, since: since.toISOString() },
    sessions: totalSessions?.count ?? 0,
    messages: totalMessages?.count ?? 0,
    userTypeBreakdown,
    activeKnowledgeEntries: knowledgeCount?.count ?? 0,
    totalProfiles: profileCount?.count ?? 0,
    mealPlansCreated: mealPlanCount?.count ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Shared Content (shareable links for Zoya responses)
// ═══════════════════════════════════════════════════════════════════

import { zoyaSharedContent } from "../drizzle/schema";
import crypto from "crypto";

/** Share links expire after this many days */
const SHARE_LINK_EXPIRY_DAYS = 3;

/** View count threshold to trigger a "popular link" notification */
const POPULAR_LINK_VIEW_THRESHOLD = 10;

export async function createSharedContent(data: {
  content: string;
  title?: string;
  userQuestion?: string;
  userId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const shareToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  // Set expiry to 3 days from now
  const expiresAt = new Date(Date.now() + SHARE_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(zoyaSharedContent).values({
    shareToken,
    content: data.content,
    title: data.title ?? null,
    userQuestion: data.userQuestion ?? null,
    userId: data.userId ?? null,
    viewCount: 0,
    expiresAt,
  });

  return { shareToken, expiresAt: expiresAt.toISOString() };
}

export async function getSharedContent(shareToken: string) {
  const db = await getDb();
  if (!db) return null;

  const [entry] = await db
    .select()
    .from(zoyaSharedContent)
    .where(eq(zoyaSharedContent.shareToken, shareToken))
    .limit(1);

  if (!entry) return null;

  // Check expiry
  if (entry.expiresAt && entry.expiresAt < new Date()) {
    return { ...entry, expired: true };
  }

  // Increment view count
  const newViewCount = (entry.viewCount ?? 0) + 1;
  await db
    .update(zoyaSharedContent)
    .set({ viewCount: sql`${zoyaSharedContent.viewCount} + 1` })
    .where(eq(zoyaSharedContent.id, entry.id));

  // Trigger popular link notification at threshold
  if (
    newViewCount === POPULAR_LINK_VIEW_THRESHOLD &&
    entry.userId
  ) {
    triggerPopularLinkNotification(entry.id, entry.userId, shareToken, entry.title, newViewCount).catch(
      (err) => console.warn("[Zoya Share] Popular notification error:", err)
    );
  }

  return { ...entry, viewCount: newViewCount, expired: false };
}

/**
 * Clean up expired share links older than the expiry window.
 * Called periodically (e.g., on server startup or via cron).
 */
export async function cleanupExpiredShareLinks() {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();
  const result = await db
    .delete(zoyaSharedContent)
    .where(
      and(
        sql`${zoyaSharedContent.expiresAt} IS NOT NULL`,
        lt(zoyaSharedContent.expiresAt, now)
      )
    );

  const deleted = (result as any)?.[0]?.affectedRows ?? 0;
  if (deleted > 0) {
    console.log(`[Zoya Share] Cleaned up ${deleted} expired share links`);
  }
  return deleted;
}

/**
 * Check for popular share links and notify their creators.
 * A link is "popular" when it reaches the view threshold.
 */
async function triggerPopularLinkNotification(
  entryId: number,
  userId: number,
  shareToken: string,
  title: string | null,
  viewCount: number
) {
  // Resolve user's openId for in-app notification
  const db = await getDb();
  if (!db) return;

  const [user] = await db
    .select({ openId: users.openId, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.openId) return;

  // Send in-app notification
  const { createUserNotification } = await import("./db");
  await createUserNotification({
    userOpenId: user.openId,
    type: "zoya_popular_share",
    title: "\u{1F31F} Ваша ссылка набирает просмотры!",
    body: `Рекомендация «${title || "от Зои"}» уже набрала ${viewCount} просмотров. Люди ценят полезные советы!`,
    link: `/zoya/share/${shareToken}`,
  });

  // Also notify the farm owner via system notification
  try {
    const { notifyOwner } = await import("./_core/notification");
    await notifyOwner({
      title: "Популярная ссылка Зои",
      content: `Ссылка «${title || "рекомендация Зои"}» (пользователь: ${user.name || "аноним"}) набрала ${viewCount} просмотров. Токен: ${shareToken}`,
    });
  } catch {
    // Non-critical — don't fail the view
  }
}


// ═══════════════════════════════════════════════════════════════════
// Extended Nutrition Analytics (Admin Dashboard)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get extended nutrition analytics for the admin dashboard.
 * Includes chat trends, popular topics, user engagement, recipes, shares, etc.
 */
export async function getNutriAnalyticsExtended(days = 30) {
  const db = await getDb();
  if (!db) return null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ─── Basic counts ───
  const [totalSessions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriSessions)
    .where(gte(nutriSessions.createdAt, since));

  const [totalMessages] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMessages)
    .where(gte(nutriMessages.createdAt, since));

  const [userMessages] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMessages)
    .where(and(gte(nutriMessages.createdAt, since), eq(nutriMessages.role, "user")));

  const [assistantMessages] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMessages)
    .where(and(gte(nutriMessages.createdAt, since), eq(nutriMessages.role, "assistant")));

  // ─── User type breakdown ───
  const userTypeBreakdown = await db
    .select({
      userType: nutriSessions.userType,
      count: sql<number>`count(*)`,
    })
    .from(nutriSessions)
    .where(gte(nutriSessions.createdAt, since))
    .groupBy(nutriSessions.userType);

  // ─── Knowledge base stats ───
  const [knowledgeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriKnowledge)
    .where(eq(nutriKnowledge.status, "active"));

  const knowledgeByCategory = await db
    .select({
      category: nutriKnowledge.category,
      count: sql<number>`count(*)`,
    })
    .from(nutriKnowledge)
    .where(eq(nutriKnowledge.status, "active"))
    .groupBy(nutriKnowledge.category);

  // ─── Profiles & meal plans ───
  const [profileCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriProfiles);

  const [mealPlanCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMealPlans)
    .where(gte(nutriMealPlans.createdAt, since));

  const [favoriteMealPlans] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriMealPlans)
    .where(eq(nutriMealPlans.isFavorite, true));

  // ─── Recipes ───
  const [recipeCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriRecipes)
    .where(eq(nutriRecipes.status, "active"));

  // ─── Shared content ───
  const [shareCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(zoyaSharedContent)
    .where(gte(zoyaSharedContent.createdAt, since));

  const [totalShareViews] = await db
    .select({ total: sql<number>`COALESCE(SUM(viewCount), 0)` })
    .from(zoyaSharedContent)
    .where(gte(zoyaSharedContent.createdAt, since));

  // ─── Chat trend by day (raw SQL for GROUP BY compatibility) ───
  const chatTrendRows = await db.execute(sql`
    SELECT
      DATE(createdAt) AS day,
      COUNT(*) AS sessions,
      SUM(messageCount) AS messages
    FROM nutriSessions
    WHERE createdAt >= ${since}
    GROUP BY DATE(createdAt)
    ORDER BY DATE(createdAt)
  `);
  const chatTrend = (chatTrendRows[0] as any[]) || [];

  // ─── Avg messages per session ───
  const [avgMsgsPerSession] = await db
    .select({
      avg: sql<number>`ROUND(AVG(messageCount), 1)`,
    })
    .from(nutriSessions)
    .where(and(gte(nutriSessions.createdAt, since), sql`messageCount > 0`));

  // ─── Top user questions (last N user messages for topic analysis) ───
  const recentUserMessages = await db
    .select({
      content: nutriMessages.content,
      createdAt: nutriMessages.createdAt,
    })
    .from(nutriMessages)
    .where(and(gte(nutriMessages.createdAt, since), eq(nutriMessages.role, "user")))
    .orderBy(desc(nutriMessages.createdAt))
    .limit(100);

  // ─── Guest conversion (guests who later registered) ───
  const [guestSessions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriSessions)
    .where(and(gte(nutriSessions.createdAt, since), eq(nutriSessions.userType, "guest")));

  const [registeredSessions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriSessions)
    .where(and(gte(nutriSessions.createdAt, since), eq(nutriSessions.userType, "registered")));

  const [ownerSessions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(nutriSessions)
    .where(and(gte(nutriSessions.createdAt, since), eq(nutriSessions.userType, "owner")));

  // ─── Popular shared content ───
  const popularShares = await db
    .select({
      id: zoyaSharedContent.id,
      title: zoyaSharedContent.title,
      shareToken: zoyaSharedContent.shareToken,
      viewCount: zoyaSharedContent.viewCount,
      createdAt: zoyaSharedContent.createdAt,
    })
    .from(zoyaSharedContent)
    .where(gte(zoyaSharedContent.createdAt, since))
    .orderBy(desc(zoyaSharedContent.viewCount))
    .limit(10);

  return {
    period: { days, since: since.toISOString() },
    // Overview
    sessions: totalSessions?.count ?? 0,
    messages: totalMessages?.count ?? 0,
    userMessages: userMessages?.count ?? 0,
    assistantMessages: assistantMessages?.count ?? 0,
    avgMessagesPerSession: avgMsgsPerSession?.avg ?? 0,
    // User segments
    userTypeBreakdown,
    guestSessions: guestSessions?.count ?? 0,
    registeredSessions: registeredSessions?.count ?? 0,
    ownerSessions: ownerSessions?.count ?? 0,
    // Knowledge
    activeKnowledgeEntries: knowledgeCount?.count ?? 0,
    knowledgeByCategory,
    // Profiles & plans
    totalProfiles: profileCount?.count ?? 0,
    mealPlansCreated: mealPlanCount?.count ?? 0,
    favoriteMealPlans: favoriteMealPlans?.count ?? 0,
    // Recipes
    activeRecipes: recipeCount?.count ?? 0,
    // Shares
    sharesCreated: shareCount?.count ?? 0,
    totalShareViews: totalShareViews?.total ?? 0,
    popularShares,
    // Trends
    chatTrend,
    // Recent questions (for topic cloud)
    recentQuestions: recentUserMessages.map((m: { content: string; createdAt: Date }) => m.content).slice(0, 50),
  };
}
