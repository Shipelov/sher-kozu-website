import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for Achievement Badges, Rating Notifications, and Animal Comparison features.
 *
 * Covers:
 * 1. Badge definitions and server logic (server/badges.ts)
 * 2. Badge tRPC routes (myBadges, getByOwner, definitions, checkMyBadges)
 * 3. Badge UI components (BadgeCard, BadgeGrid, BadgeInline)
 * 4. Dashboard badges integration
 * 5. Rating change notifications in recalculateOwnerRanks
 * 6. Animal comparison page (AnimalCompare.tsx)
 * 7. Comparison radar chart component (RadarChart.tsx)
 * 8. Leaderboard compare link
 */

const BADGES_SRC = fs.readFileSync(path.resolve(__dirname, "badges.ts"), "utf-8");
const ROUTERS_SRC = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf-8");
const GAMIFICATION_SRC = fs.readFileSync(path.resolve(__dirname, "gamification.ts"), "utf-8");
const BADGE_CARD_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/components/BadgeCard.tsx"), "utf-8");
const RADAR_CHART_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/components/RadarChart.tsx"), "utf-8");
const DASHBOARD_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"), "utf-8");
const COMPARE_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/AnimalCompare.tsx"), "utf-8");
const LEADERBOARD_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Leaderboard.tsx"), "utf-8");
const APP_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/App.tsx"), "utf-8");
const SCHEMA_SRC = fs.readFileSync(path.resolve(__dirname, "../drizzle/schema.ts"), "utf-8");

// ═══════════════════════════════════════════════════════════
// 1. ACHIEVEMENT BADGES — DATABASE SCHEMA
// ═══════════════════════════════════════════════════════════

describe("Achievement Badges — Schema", () => {
  it("defines achievementBadges table in schema", () => {
    expect(SCHEMA_SRC).toContain('export const achievementBadges = mysqlTable("achievementBadges"');
  });

  it("has ownerOpenId column", () => {
    expect(SCHEMA_SRC).toContain('ownerOpenId: varchar("ownerOpenId"');
  });

  it("has badgeType column as varchar(64)", () => {
    expect(SCHEMA_SRC).toContain('badgeType: varchar("badgeType", { length: 64 })');
  });

  it("has metadata text column for optional JSON", () => {
    expect(SCHEMA_SRC).toContain("metadata: text(");
  });

  it("has awardedAt timestamp with default", () => {
    expect(SCHEMA_SRC).toContain("awardedAt: timestamp(");
  });

  it("exports AchievementBadge and InsertAchievementBadge types", () => {
    expect(SCHEMA_SRC).toContain("export type AchievementBadge = typeof achievementBadges.$inferSelect");
    expect(SCHEMA_SRC).toContain("export type InsertAchievementBadge = typeof achievementBadges.$inferInsert");
  });
});

// ═══════════════════════════════════════════════════════════
// 2. ACHIEVEMENT BADGES — SERVER LOGIC
// ═══════════════════════════════════════════════════════════

describe("Achievement Badges — Server Logic (badges.ts)", () => {
  describe("BADGE_DEFINITIONS", () => {
    it("exports BADGE_DEFINITIONS record", () => {
      expect(BADGES_SRC).toContain("export const BADGE_DEFINITIONS");
    });

    const badgeTypes = [
      "first_animal",
      "herd_of_five",
      "first_purchase",
      "big_spender",
      "club_member",
      "top_rating",
      "rating_50",
      "rating_100",
      "caring_owner",
      "happy_herd",
    ];

    for (const type of badgeTypes) {
      it(`defines badge type: ${type}`, () => {
        expect(BADGES_SRC).toContain(`${type}:`);
      });
    }

    it("each definition has name, description, emoji, and category", () => {
      expect(BADGES_SRC).toContain("name:");
      expect(BADGES_SRC).toContain("description:");
      expect(BADGES_SRC).toContain("emoji:");
      expect(BADGES_SRC).toContain("category:");
    });

    it("has categories: ownership, marketplace, community, rating, care", () => {
      expect(BADGES_SRC).toContain('"ownership"');
      expect(BADGES_SRC).toContain('"marketplace"');
      expect(BADGES_SRC).toContain('"community"');
      expect(BADGES_SRC).toContain('"rating"');
      expect(BADGES_SRC).toContain('"care"');
    });
  });

  describe("getOwnerBadges", () => {
    it("exports getOwnerBadges function", () => {
      expect(BADGES_SRC).toContain("export async function getOwnerBadges");
    });

    it("queries achievementBadges table by ownerOpenId", () => {
      expect(BADGES_SRC).toContain("achievementBadges.ownerOpenId");
    });

    it("orders by awardedAt", () => {
      expect(BADGES_SRC).toContain("achievementBadges.awardedAt");
    });
  });

  describe("hasBadge", () => {
    it("exports hasBadge function", () => {
      expect(BADGES_SRC).toContain("export async function hasBadge");
    });

    it("checks for existing badge by ownerOpenId and badgeType", () => {
      expect(BADGES_SRC).toContain("achievementBadges.ownerOpenId");
      expect(BADGES_SRC).toContain("achievementBadges.badgeType");
    });

    it("uses limit(1) for efficiency", () => {
      expect(BADGES_SRC).toContain(".limit(1)");
    });
  });

  describe("awardBadge", () => {
    it("exports awardBadge function", () => {
      expect(BADGES_SRC).toContain("export async function awardBadge");
    });

    it("is idempotent — checks hasBadge before inserting", () => {
      expect(BADGES_SRC).toContain("const already = await hasBadge");
      expect(BADGES_SRC).toContain("if (already) return false");
    });

    it("inserts into achievementBadges table", () => {
      expect(BADGES_SRC).toContain("db.insert(achievementBadges)");
    });

    it("supports optional metadata parameter", () => {
      expect(BADGES_SRC).toContain("metadata?: Record<string, unknown>");
    });

    it("serializes metadata as JSON", () => {
      expect(BADGES_SRC).toContain("JSON.stringify(metadata)");
    });
  });

  describe("checkAndAwardBadges", () => {
    it("exports checkAndAwardBadges function", () => {
      expect(BADGES_SRC).toContain("export async function checkAndAwardBadges");
    });

    it("accepts context with animalCount, totalSpent, isClubMember, rank, totalScore", () => {
      expect(BADGES_SRC).toContain("animalCount?: number");
      expect(BADGES_SRC).toContain("totalSpent?: number");
      expect(BADGES_SRC).toContain("isClubMember?: boolean");
      expect(BADGES_SRC).toContain("rank?: number");
      expect(BADGES_SRC).toContain("totalScore?: number");
    });

    it("awards first_animal when animalCount >= 1", () => {
      expect(BADGES_SRC).toContain('context.animalCount >= 1');
      expect(BADGES_SRC).toContain('"first_animal"');
    });

    it("awards herd_of_five when animalCount >= 5", () => {
      expect(BADGES_SRC).toContain('context.animalCount >= 5');
      expect(BADGES_SRC).toContain('"herd_of_five"');
    });

    it("awards first_purchase when hasPurchases is true", () => {
      expect(BADGES_SRC).toContain("context.hasPurchases");
      expect(BADGES_SRC).toContain('"first_purchase"');
    });

    it("awards big_spender when totalSpent >= 100", () => {
      expect(BADGES_SRC).toContain("context.totalSpent >= 100");
      expect(BADGES_SRC).toContain('"big_spender"');
    });

    it("awards top_rating when rank === 1", () => {
      expect(BADGES_SRC).toContain("context.rank === 1");
      expect(BADGES_SRC).toContain('"top_rating"');
    });

    it("awards rating_50 when totalScore >= 50", () => {
      expect(BADGES_SRC).toContain("context.totalScore >= 50");
      expect(BADGES_SRC).toContain('"rating_50"');
    });

    it("awards rating_100 when totalScore >= 100", () => {
      expect(BADGES_SRC).toContain("context.totalScore >= 100");
      expect(BADGES_SRC).toContain('"rating_100"');
    });

    it("awards caring_owner when all animal health scores > 70", () => {
      expect(BADGES_SRC).toContain("animalHealthScores");
      expect(BADGES_SRC).toContain('"caring_owner"');
    });

    it("awards happy_herd when all animal happiness scores > 70", () => {
      expect(BADGES_SRC).toContain("animalHappinessScores");
      expect(BADGES_SRC).toContain('"happy_herd"');
    });

    it("returns array of newly awarded badge types", () => {
      expect(BADGES_SRC).toContain("const newBadges: string[] = []");
      expect(BADGES_SRC).toContain("return newBadges");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 3. ACHIEVEMENT BADGES — tRPC ROUTES
// ═══════════════════════════════════════════════════════════

describe("Achievement Badges — tRPC Routes", () => {
  it("registers badges router in appRouter", () => {
    expect(ROUTERS_SRC).toContain("badges: router({");
  });

  it("imports badge functions from ./badges", () => {
    expect(ROUTERS_SRC).toContain('import { getOwnerBadges, checkAndAwardBadges, BADGE_DEFINITIONS } from "./badges"');
  });

  describe("myBadges", () => {
    it("defines myBadges as protectedProcedure query", () => {
      expect(ROUTERS_SRC).toContain("myBadges: protectedProcedure.query");
    });

    it("calls getOwnerBadges with ctx.user.openId", () => {
      expect(ROUTERS_SRC).toContain("getOwnerBadges(ctx.user.openId)");
    });

    it("enriches badges with definition metadata", () => {
      expect(ROUTERS_SRC).toContain("BADGE_DEFINITIONS[b.badgeType]");
    });
  });

  describe("getByOwner", () => {
    it("defines getByOwner as publicProcedure", () => {
      expect(ROUTERS_SRC).toContain("getByOwner: publicProcedure");
    });

    it("accepts ownerOpenId input", () => {
      expect(ROUTERS_SRC).toContain("ownerOpenId: z.string()");
    });
  });

  describe("definitions", () => {
    it("defines definitions as publicProcedure", () => {
      expect(ROUTERS_SRC).toContain("definitions: publicProcedure.query");
    });

    it("returns all badge definitions", () => {
      expect(ROUTERS_SRC).toContain("Object.entries(BADGE_DEFINITIONS)");
    });
  });

  describe("checkMyBadges", () => {
    it("defines checkMyBadges as protectedProcedure mutation", () => {
      expect(ROUTERS_SRC).toContain("checkMyBadges: protectedProcedure.mutation");
    });

    it("counts animals from animalOwnerships", () => {
      expect(ROUTERS_SRC).toContain("animalOwnerships");
    });

    it("counts purchases from walletTransactions", () => {
      expect(ROUTERS_SRC).toContain("walletTransactions");
    });

    it("uses correct column name amountMinor for total spent", () => {
      expect(ROUTERS_SRC).toContain("SUM(ABS(amountMinor))");
    });

    it("calls checkAndAwardBadges with gathered context", () => {
      expect(ROUTERS_SRC).toContain("checkAndAwardBadges(ownerOpenId");
    });

    it("returns newBadges and total count", () => {
      expect(ROUTERS_SRC).toContain("return { newBadges, total:");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 4. ACHIEVEMENT BADGES — UI COMPONENTS
// ═══════════════════════════════════════════════════════════

describe("Achievement Badges — UI Components (BadgeCard.tsx)", () => {
  it("exports BadgeCard component", () => {
    expect(BADGE_CARD_SRC).toContain("export function BadgeCard");
  });

  it("exports BadgeGrid component", () => {
    expect(BADGE_CARD_SRC).toContain("export function BadgeGrid");
  });

  it("exports BadgeInline component", () => {
    expect(BADGE_CARD_SRC).toContain("export function BadgeInline");
  });

  it("BadgeCard displays emoji", () => {
    expect(BADGE_CARD_SRC).toContain("badge.definition.emoji");
  });

  it("BadgeCard displays name", () => {
    expect(BADGE_CARD_SRC).toContain("badge.definition.name");
  });

  it("BadgeCard displays formatted date", () => {
    expect(BADGE_CARD_SRC).toContain("toLocaleDateString");
  });

  it("BadgeCard has hover tooltip with description", () => {
    expect(BADGE_CARD_SRC).toContain("badge.definition.description");
    expect(BADGE_CARD_SRC).toContain("group-hover:opacity-100");
  });

  it("BadgeCard uses category-based color scheme", () => {
    expect(BADGE_CARD_SRC).toContain("categoryColors");
    expect(BADGE_CARD_SRC).toContain("ownership");
    expect(BADGE_CARD_SRC).toContain("marketplace");
    expect(BADGE_CARD_SRC).toContain("community");
    expect(BADGE_CARD_SRC).toContain("rating");
    expect(BADGE_CARD_SRC).toContain("care");
  });

  it("BadgeCard uses framer-motion animation", () => {
    expect(BADGE_CARD_SRC).toContain("motion.div");
    expect(BADGE_CARD_SRC).toContain("initial");
    expect(BADGE_CARD_SRC).toContain("animate");
  });

  it("BadgeGrid shows empty state message", () => {
    expect(BADGE_CARD_SRC).toContain("Пока нет достижений");
  });

  it("BadgeGrid renders responsive grid", () => {
    expect(BADGE_CARD_SRC).toContain("grid-cols-2");
    expect(BADGE_CARD_SRC).toContain("sm:grid-cols-3");
  });

  it("BadgeInline limits visible badges with max prop", () => {
    expect(BADGE_CARD_SRC).toContain("max = 5");
    expect(BADGE_CARD_SRC).toContain("badges.slice(0, max)");
  });

  it("BadgeInline shows remaining count", () => {
    expect(BADGE_CARD_SRC).toContain("remaining > 0");
    expect(BADGE_CARD_SRC).toContain("+{remaining}");
  });
});

// ═══════════════════════════════════════════════════════════
// 5. DASHBOARD BADGES INTEGRATION
// ═══════════════════════════════════════════════════════════

describe("Dashboard — Badges Integration", () => {
  it("imports BadgeGrid component", () => {
    expect(DASHBOARD_SRC).toContain('import { BadgeGrid } from "@/components/BadgeCard"');
  });

  it("defines DashboardBadgesSection component", () => {
    expect(DASHBOARD_SRC).toContain("function DashboardBadgesSection");
  });

  it("uses trpc.badges.myBadges.useQuery", () => {
    expect(DASHBOARD_SRC).toContain("trpc.badges.myBadges.useQuery");
  });

  it("uses trpc.badges.checkMyBadges.useMutation", () => {
    expect(DASHBOARD_SRC).toContain("trpc.badges.checkMyBadges.useMutation");
  });

  it("shows badge count (N из 10)", () => {
    expect(DASHBOARD_SRC).toContain("из 10 бейджей");
  });

  it("has 'Проверить новые' button", () => {
    expect(DASHBOARD_SRC).toContain("Проверить новые");
  });

  it("shows toast on new badges", () => {
    expect(DASHBOARD_SRC).toContain("Новые достижения:");
  });

  it("invalidates myBadges after check", () => {
    expect(DASHBOARD_SRC).toContain("badges.myBadges.invalidate");
  });

  it("renders BadgeGrid with badges data", () => {
    expect(DASHBOARD_SRC).toContain("<BadgeGrid badges={");
  });

  it("renders DashboardBadgesSection in the dashboard", () => {
    expect(DASHBOARD_SRC).toContain("<DashboardBadgesSection");
  });
});

// ═══════════════════════════════════════════════════════════
// 6. RATING CHANGE NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

describe("Rating Change Notifications", () => {
  it("recalculateOwnerRanks tracks rank changes", () => {
    expect(GAMIFICATION_SRC).toContain("const rankChanges:");
    expect(GAMIFICATION_SRC).toContain("oldRank");
    expect(GAMIFICATION_SRC).toContain("newRank");
  });

  it("compares oldRank vs newRank for each owner", () => {
    expect(GAMIFICATION_SRC).toContain("oldRank !== newRank");
  });

  it("pushes rank changes to array when rank differs", () => {
    expect(GAMIFICATION_SRC).toContain("rankChanges.push");
  });

  it("calls sendRankChangeNotifications when changes exist", () => {
    expect(GAMIFICATION_SRC).toContain("sendRankChangeNotifications(rankChanges)");
  });

  it("sendRankChangeNotifications is non-blocking (.catch)", () => {
    expect(GAMIFICATION_SRC).toContain(".catch((err)");
  });

  it("sendRankChangeNotifications imports notifyOwner", () => {
    expect(GAMIFICATION_SRC).toContain('import("./_core/notification")');
    expect(GAMIFICATION_SRC).toContain("notifyOwner");
  });

  it("notification includes direction emoji (up/down)", () => {
    expect(GAMIFICATION_SRC).toContain("⬆️");
    expect(GAMIFICATION_SRC).toContain("⬇️");
  });

  it("notification includes verb (поднялись/опустились)", () => {
    expect(GAMIFICATION_SRC).toContain("поднялись");
    expect(GAMIFICATION_SRC).toContain("опустились");
  });

  it("notification includes position change count", () => {
    expect(GAMIFICATION_SRC).toContain("Math.abs(change.oldRank - change.newRank)");
  });

  it("notification includes old and new rank numbers", () => {
    expect(GAMIFICATION_SRC).toContain("change.oldRank");
    expect(GAMIFICATION_SRC).toContain("change.newRank");
  });

  it("notification includes total score", () => {
    expect(GAMIFICATION_SRC).toContain("change.totalScore");
  });

  it("logs errors for individual notification failures", () => {
    expect(GAMIFICATION_SRC).toContain("[Gamification] Notification failed for");
  });
});

// ═══════════════════════════════════════════════════════════
// 7. ANIMAL COMPARISON PAGE
// ═══════════════════════════════════════════════════════════

describe("Animal Comparison Page (AnimalCompare.tsx)", () => {
  it("is registered in App.tsx at /compare route", () => {
    expect(APP_SRC).toContain('path="/compare"');
    expect(APP_SRC).toContain("AnimalCompare");
  });

  it("imports ComparisonRadarChart from RadarChart", () => {
    expect(COMPARE_SRC).toContain('import { ComparisonRadarChart } from "@/components/RadarChart"');
  });

  it("fetches herd data from gamification.leaderboard.herd", () => {
    expect(COMPARE_SRC).toContain("trpc.gamification.leaderboard.herd.useQuery");
  });

  it("defines METRIC_LABELS with 6 metrics", () => {
    expect(COMPARE_SRC).toContain("METRIC_LABELS");
    expect(COMPARE_SRC).toContain("happiness");
    expect(COMPARE_SRC).toContain("health");
    expect(COMPARE_SRC).toContain("attachment");
    expect(COMPARE_SRC).toContain("mood");
    expect(COMPARE_SRC).toContain("obedience");
    expect(COMPARE_SRC).toContain("overallRating");
  });

  it("has two animal selectors (A and B)", () => {
    expect(COMPARE_SRC).toContain('label="Животное A"');
    expect(COMPARE_SRC).toContain('label="Животное B"');
  });

  it("AnimalSelector shows animal avatar and species", () => {
    expect(COMPARE_SRC).toContain("coverImageUrl");
    expect(COMPARE_SRC).toContain("🐐 Коза");
    expect(COMPARE_SRC).toContain("🐑 Овца");
  });

  it("excludes already-selected animal from other selector", () => {
    expect(COMPARE_SRC).toContain("excludeId");
    expect(COMPARE_SRC).toContain("animals.filter");
  });

  it("renders ComparisonRadarChart when both animals selected", () => {
    expect(COMPARE_SRC).toContain("<ComparisonRadarChart");
  });

  it("shows winner banner based on total metrics", () => {
    expect(COMPARE_SRC).toContain("лидирует");
    expect(COMPARE_SRC).toContain("totalA > totalB");
  });

  it("shows metric-by-metric comparison rows", () => {
    expect(COMPARE_SRC).toContain("MetricComparisonRow");
    expect(COMPARE_SRC).toContain("Детальное сравнение");
  });

  it("MetricComparisonRow shows progress bars", () => {
    expect(COMPARE_SRC).toContain("h-full rounded-l-full");
    expect(COMPARE_SRC).toContain("h-full rounded-r-full");
  });

  it("MetricComparisonRow shows diff indicator", () => {
    expect(COMPARE_SRC).toContain("diff !== 0");
    expect(COMPARE_SRC).toContain("diff === 0");
  });

  it("shows links to both animal profiles", () => {
    expect(COMPARE_SRC).toContain("Открыть профиль →");
    expect(COMPARE_SRC).toContain("/animals/");
  });

  it("shows empty state when no animals selected", () => {
    expect(COMPARE_SRC).toContain("Выберите двух животных для сравнения");
  });

  it("has breadcrumb navigation", () => {
    expect(COMPARE_SRC).toContain('Главная');
    expect(COMPARE_SRC).toContain('Каталог');
    expect(COMPARE_SRC).toContain('Сравнение');
    expect(COMPARE_SRC).toContain('Breadcrumb');
  });

  it("uses framer-motion for animations", () => {
    expect(COMPARE_SRC).toContain("motion.div");
  });
});

// ═══════════════════════════════════════════════════════════
// 8. COMPARISON RADAR CHART COMPONENT
// ═══════════════════════════════════════════════════════════

describe("Comparison Radar Chart (RadarChart.tsx)", () => {
  it("exports RadarChart component", () => {
    expect(RADAR_CHART_SRC).toContain("export function RadarChart");
  });

  it("exports ComparisonRadarChart component", () => {
    expect(RADAR_CHART_SRC).toContain("export function ComparisonRadarChart");
  });

  it("uses SVG for rendering", () => {
    expect(RADAR_CHART_SRC).toContain("<svg");
    expect(RADAR_CHART_SRC).toContain("</svg>");
  });

  it("implements polarToCartesian helper", () => {
    expect(RADAR_CHART_SRC).toContain("function polarToCartesian");
    expect(RADAR_CHART_SRC).toContain("Math.cos");
    expect(RADAR_CHART_SRC).toContain("Math.sin");
  });

  it("builds polygon points from values", () => {
    expect(RADAR_CHART_SRC).toContain("function buildPolygonPoints");
  });

  it("renders grid levels (20, 40, 60, 80, 100)", () => {
    expect(RADAR_CHART_SRC).toContain("[20, 40, 60, 80, 100]");
  });

  it("renders axis lines from center to edges", () => {
    expect(RADAR_CHART_SRC).toContain("x1={cx}");
    expect(RADAR_CHART_SRC).toContain("y1={cy}");
  });

  it("ComparisonRadarChart renders two data polygons", () => {
    expect(RADAR_CHART_SRC).toContain("pointsA");
    expect(RADAR_CHART_SRC).toContain("pointsB");
  });

  it("uses distinct colors for A and B", () => {
    expect(RADAR_CHART_SRC).toContain("#6d8c54"); // green for A
    expect(RADAR_CHART_SRC).toContain("#c77d3a"); // amber for B
  });

  it("renders legend with both labels", () => {
    expect(RADAR_CHART_SRC).toContain("{labelA}");
    expect(RADAR_CHART_SRC).toContain("{labelB}");
  });

  it("shows both values in axis labels", () => {
    expect(RADAR_CHART_SRC).toContain("dataA[i].value");
    expect(RADAR_CHART_SRC).toContain("dataB[i].value");
  });

  it("renders data points as circles", () => {
    expect(RADAR_CHART_SRC).toContain("<circle");
    expect(RADAR_CHART_SRC).toContain("r={3.5}");
  });

  it("uses useMemo for polygon point calculations", () => {
    expect(RADAR_CHART_SRC).toContain("useMemo");
  });
});

// ═══════════════════════════════════════════════════════════
// 9. LEADERBOARD — COMPARE LINK
// ═══════════════════════════════════════════════════════════

describe("Leaderboard — Compare Link", () => {
  it("has link to /compare page", () => {
    expect(LEADERBOARD_SRC).toContain('href="/compare"');
  });

  it("shows 'Сравнить' label", () => {
    expect(LEADERBOARD_SRC).toContain("Сравнить");
  });

  it("imports ArrowLeftRight icon", () => {
    expect(LEADERBOARD_SRC).toContain("ArrowLeftRight");
  });
});
