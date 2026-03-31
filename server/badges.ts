import { getDb } from "./db";
import { achievementBadges, type AchievementBadge } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * Badge type definitions with display metadata.
 */
export const BADGE_DEFINITIONS: Record<
  string,
  { name: string; description: string; emoji: string; category: string }
> = {
  first_animal: {
    name: "Первое животное",
    description: "Стали владельцем первого животного на ферме",
    emoji: "🐾",
    category: "ownership",
  },
  herd_of_five: {
    name: "Стадо из 5",
    description: "Владеете 5 или более животными",
    emoji: "🐐",
    category: "ownership",
  },
  first_purchase: {
    name: "Первая покупка",
    description: "Совершили первую покупку в маркетплейсе",
    emoji: "🛒",
    category: "marketplace",
  },
  big_spender: {
    name: "Щедрый хозяин",
    description: "Потратили более 100 SKC в маркетплейсе",
    emoji: "💎",
    category: "marketplace",
  },
  club_member: {
    name: "Член клуба",
    description: "Присоединились к клубу фермы",
    emoji: "🤝",
    category: "community",
  },
  top_rating: {
    name: "Лучший рейтинг",
    description: "Заняли 1-е место в рейтинге владельцев",
    emoji: "🏆",
    category: "rating",
  },
  rating_50: {
    name: "Рейтинг 50+",
    description: "Достигли рейтинга 50 очков и выше",
    emoji: "⭐",
    category: "rating",
  },
  rating_100: {
    name: "Рейтинг 100+",
    description: "Достигли рейтинга 100 очков и выше",
    emoji: "🌟",
    category: "rating",
  },
  caring_owner: {
    name: "Заботливый хозяин",
    description: "Все животные имеют рейтинг здоровья выше 70",
    emoji: "💚",
    category: "care",
  },
  happy_herd: {
    name: "Счастливое стадо",
    description: "Все животные имеют рейтинг счастья выше 70",
    emoji: "😊",
    category: "care",
  },
};

/**
 * Get all badges for a specific owner.
 */
export async function getOwnerBadges(ownerOpenId: string): Promise<AchievementBadge[]> {
  const db = await getDb();
  return db
    .select()
    .from(achievementBadges)
    .where(eq(achievementBadges.ownerOpenId, ownerOpenId))
    .orderBy(achievementBadges.awardedAt);
}

/**
 * Check if an owner already has a specific badge.
 */
export async function hasBadge(ownerOpenId: string, badgeType: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .select({ id: achievementBadges.id })
    .from(achievementBadges)
    .where(
      and(
        eq(achievementBadges.ownerOpenId, ownerOpenId),
        eq(achievementBadges.badgeType, badgeType)
      )
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Award a badge to an owner (idempotent — skips if already awarded).
 * Returns true if newly awarded, false if already had it.
 */
export async function awardBadge(
  ownerOpenId: string,
  badgeType: string,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const already = await hasBadge(ownerOpenId, badgeType);
  if (already) return false;

  const db = await getDb();
  await db.insert(achievementBadges).values({
    ownerOpenId,
    badgeType,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
  return true;
}

/**
 * Revoke a badge from an owner if they no longer meet the criteria.
 * Returns true if revoked, false if they didn't have it.
 */
export async function revokeBadge(
  ownerOpenId: string,
  badgeType: string
): Promise<boolean> {
  const has = await hasBadge(ownerOpenId, badgeType);
  if (!has) return false;

  const db = await getDb();
  await db
    .delete(achievementBadges)
    .where(
      and(
        eq(achievementBadges.ownerOpenId, ownerOpenId),
        eq(achievementBadges.badgeType, badgeType)
      )
    );
  return true;
}

/**
 * Check and award badges based on current owner state.
 * Called after key events (purchase, ownership change, rating update).
 */
export async function checkAndAwardBadges(
  ownerOpenId: string,
  context: {
    animalCount?: number;
    totalSpent?: number;
    isClubMember?: boolean;
    rank?: number;
    totalScore?: number;
    animalHealthScores?: number[];
    animalHappinessScores?: number[];
    hasPurchases?: boolean;
  }
): Promise<string[]> {
  const newBadges: string[] = [];

  const revokedBadges: string[] = [];

  // Ownership badges
  if (context.animalCount && context.animalCount >= 1) {
    if (await awardBadge(ownerOpenId, "first_animal")) newBadges.push("first_animal");
  }
  if (context.animalCount !== undefined && context.animalCount >= 5) {
    if (await awardBadge(ownerOpenId, "herd_of_five")) newBadges.push("herd_of_five");
  } else if (context.animalCount !== undefined && context.animalCount < 5) {
    if (await revokeBadge(ownerOpenId, "herd_of_five")) revokedBadges.push("herd_of_five");
  }

  // Marketplace badges
  if (context.hasPurchases) {
    if (await awardBadge(ownerOpenId, "first_purchase")) newBadges.push("first_purchase");
  }
  if (context.totalSpent && context.totalSpent >= 100) {
    if (await awardBadge(ownerOpenId, "big_spender")) newBadges.push("big_spender");
  }

  // Community badges
  if (context.isClubMember) {
    if (await awardBadge(ownerOpenId, "club_member")) newBadges.push("club_member");
  }

  // Rating badges
  if (context.rank === 1) {
    if (await awardBadge(ownerOpenId, "top_rating")) newBadges.push("top_rating");
  }
  if (context.totalScore && context.totalScore >= 50) {
    if (await awardBadge(ownerOpenId, "rating_50")) newBadges.push("rating_50");
  }
  if (context.totalScore && context.totalScore >= 100) {
    if (await awardBadge(ownerOpenId, "rating_100")) newBadges.push("rating_100");
  }

  // Care badges
  if (
    context.animalHealthScores &&
    context.animalHealthScores.length > 0 &&
    context.animalHealthScores.every((s) => s > 70)
  ) {
    if (await awardBadge(ownerOpenId, "caring_owner")) newBadges.push("caring_owner");
  }
  if (
    context.animalHappinessScores &&
    context.animalHappinessScores.length > 0 &&
    context.animalHappinessScores.every((s) => s > 70)
  ) {
    if (await awardBadge(ownerOpenId, "happy_herd")) newBadges.push("happy_herd");
  }

  return newBadges;
}

/**
 * Revoke badges that no longer meet criteria and return list of revoked badge types.
 * Called alongside checkAndAwardBadges to ensure badge accuracy.
 */
export async function revokeInvalidBadges(
  ownerOpenId: string,
  context: {
    animalCount?: number;
    totalSpent?: number;
    totalScore?: number;
    animalHealthScores?: number[];
    animalHappinessScores?: number[];
  }
): Promise<string[]> {
  const revoked: string[] = [];

  // Revoke herd_of_five if animal count dropped below 5
  if (context.animalCount !== undefined && context.animalCount < 5) {
    if (await revokeBadge(ownerOpenId, "herd_of_five")) revoked.push("herd_of_five");
  }

  // Revoke caring_owner if any animal health dropped below 70
  if (
    context.animalHealthScores &&
    context.animalHealthScores.length > 0 &&
    !context.animalHealthScores.every((s) => s > 70)
  ) {
    if (await revokeBadge(ownerOpenId, "caring_owner")) revoked.push("caring_owner");
  }

  // Revoke happy_herd if any animal happiness dropped below 70
  if (
    context.animalHappinessScores &&
    context.animalHappinessScores.length > 0 &&
    !context.animalHappinessScores.every((s) => s > 70)
  ) {
    if (await revokeBadge(ownerOpenId, "happy_herd")) revoked.push("happy_herd");
  }

  return revoked;
}
