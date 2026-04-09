/**
 * Nutritionist (Zoya) — Database helpers
 *
 * All DB operations for the AI nutritionist feature.
 * Separated from main db.ts to keep files manageable.
 */

import { eq, desc, and, like, sql, gte, lt, inArray } from "drizzle-orm";
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

// ═══════════════════════════════════════════════════════════════════
// Sessions
// ═══════════════════════════════════════════════════════════════════

export async function createNutriSession(data: {
  userId?: number | null;
  userType: "guest" | "registered" | "owner";
  guestFingerprint?: string | null;
  goal?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [result] = await db.insert(nutriSessions).values({
    userId: data.userId ?? undefined,
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
  const db = await getDb();
  if (!db) return null;

  const [profile] = await db
    .select()
    .from(nutriProfiles)
    .where(eq(nutriProfiles.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function upsertNutriProfile(userId: number, data: {
  goals?: string[];
  allergies?: string[];
  restrictions?: string[];
  familyMembers?: Array<{ name: string; age?: number; notes?: string }>;
  preferredProducts?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const existing = await getNutriProfile(userId);

  if (existing) {
    await db
      .update(nutriProfiles)
      .set({
        goals: data.goals ?? existing.goals,
        allergies: data.allergies ?? existing.allergies,
        restrictions: data.restrictions ?? existing.restrictions,
        familyMembers: data.familyMembers ?? existing.familyMembers,
        preferredProducts: data.preferredProducts ?? existing.preferredProducts,
      })
      .where(eq(nutriProfiles.userId, userId));

    return getNutriProfile(userId);
  }

  const [result] = await db.insert(nutriProfiles).values({
    userId,
    goals: data.goals ?? [],
    allergies: data.allergies ?? [],
    restrictions: data.restrictions ?? [],
    familyMembers: data.familyMembers ?? [],
    preferredProducts: data.preferredProducts ?? [],
  }).$returningId();

  const [profile] = await db
    .select()
    .from(nutriProfiles)
    .where(eq(nutriProfiles.id, result.id))
    .limit(1);

  return profile;
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
 * Search knowledge base using MySQL LIKE (simple text search).
 * Returns top-N entries matching the query, ranked by relevance heuristic.
 */
export async function searchKnowledge(query: string, options?: {
  category?: string;
  limit?: number;
  statusFilter?: string[];
}): Promise<NutriKnowledgeEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = options?.limit ?? 10;
  const conditions = [
    eq(nutriKnowledge.status, "active"),
  ];

  if (options?.category) {
    conditions.push(eq(nutriKnowledge.category, options.category as any));
  }

  // Search in title and content
  const searchTerm = `%${query}%`;
  const titleMatch = like(nutriKnowledge.title, searchTerm);
  const contentMatch = like(nutriKnowledge.content, searchTerm);

  // First try title matches (higher relevance), then content matches
  const titleResults = await db
    .select()
    .from(nutriKnowledge)
    .where(and(...conditions, titleMatch))
    .orderBy(desc(nutriKnowledge.confidence))
    .limit(limit);

  if (titleResults.length >= limit) return titleResults;

  const remaining = limit - titleResults.length;
  const titleIds: number[] = titleResults.map((r: NutriKnowledgeEntry) => r.id);

  const contentResults = await db
    .select()
    .from(nutriKnowledge)
    .where(
      and(
        ...conditions,
        contentMatch,
        titleIds.length > 0 ? sql`${nutriKnowledge.id} NOT IN (${sql.join(titleIds.map((id: number) => sql`${id}`), sql`, `)})` : undefined,
      )
    )
    .orderBy(desc(nutriKnowledge.confidence))
    .limit(remaining);

  return [...titleResults, ...contentResults];
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
    animals: ownerships,
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

export async function createSharedContent(data: {
  content: string;
  title?: string;
  userQuestion?: string;
  userId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const shareToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  await db.insert(zoyaSharedContent).values({
    shareToken,
    content: data.content,
    title: data.title ?? null,
    userQuestion: data.userQuestion ?? null,
    userId: data.userId ?? null,
    viewCount: 0,
  });

  return { shareToken };
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
  if (entry.expiresAt && entry.expiresAt < new Date()) return null;

  // Increment view count
  await db
    .update(zoyaSharedContent)
    .set({ viewCount: sql`${zoyaSharedContent.viewCount} + 1` })
    .where(eq(zoyaSharedContent.id, entry.id));

  return entry;
}
