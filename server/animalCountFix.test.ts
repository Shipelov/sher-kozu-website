import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for the animal count fix.
 *
 * Bug: Owner's rating showed 21 animals instead of 3 because the query
 * used COUNT(*) on animalOwnerships rows (which can have multiple rows
 * per animal due to repeated bookings) instead of COUNT(DISTINCT animalId).
 *
 * Fix applied in 3 places:
 * 1. myRating procedure (server/routers/gamification.ts)
 * 2. getOwnerLeaderboard function (server/gamification.ts)
 * 3. checkMyBadges procedure (server/routers.ts)
 * 4. updateOwnerRating deduplicates animalIds before querying metrics
 */

const GAMIFICATION_ROUTER_SRC = fs.readFileSync(path.resolve(__dirname, "routers/gamification.ts"), "utf-8");
const GAMIFICATION_SRC = fs.readFileSync(path.resolve(__dirname, "gamification.ts"), "utf-8");
const ROUTERS_SRC = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf-8");

describe("Animal Count Fix — myRating (routers/gamification.ts)", () => {
  it("uses COUNT(DISTINCT animalId) instead of COUNT(*)", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain("count(DISTINCT animalId)");
  });

  it("does NOT use count(*) for animal counting", () => {
    // Extract the myRating section
    const myRatingStart = GAMIFICATION_ROUTER_SRC.indexOf("myRating:");
    const myRatingEnd = GAMIFICATION_ROUTER_SRC.indexOf("ratingHistory:");
    const myRatingSection = GAMIFICATION_ROUTER_SRC.slice(myRatingStart, myRatingEnd);
    expect(myRatingSection).not.toContain("count(*)");
  });

  it("still filters by ownerOpenId and active status", () => {
    expect(GAMIFICATION_ROUTER_SRC).toContain("animalOwnerships.ownerOpenId");
    expect(GAMIFICATION_ROUTER_SRC).toContain('eq(animalOwnerships.status, "active")');
  });
});

describe("Animal Count Fix — getOwnerLeaderboard (gamification.ts)", () => {
  it("uses COUNT(DISTINCT animalId) for leaderboard animal count", () => {
    // Find the getOwnerLeaderboard section
    const fnStart = GAMIFICATION_SRC.indexOf("getOwnerLeaderboard");
    const fnEnd = GAMIFICATION_SRC.indexOf("// ─── Farmer Checklists");
    const fnSection = GAMIFICATION_SRC.slice(fnStart, fnEnd);
    expect(fnSection).toContain("count(DISTINCT animalId)");
  });

  it("does NOT use count(*) for animal counting in leaderboard", () => {
    const fnStart = GAMIFICATION_SRC.indexOf("// Enrich with user names and animal count");
    const fnEnd = GAMIFICATION_SRC.indexOf("return result;\n}");
    const fnSection = GAMIFICATION_SRC.slice(fnStart, fnEnd);
    expect(fnSection).not.toContain("count(*)");
  });
});

describe("Animal Count Fix — checkMyBadges (routers.ts)", () => {
  it("uses COUNT(DISTINCT animalId) for badge animal count", () => {
    const badgesStart = ROUTERS_SRC.indexOf("checkMyBadges:");
    const badgesEnd = ROUTERS_SRC.indexOf("return { newBadges, total:");
    const badgesSection = ROUTERS_SRC.slice(badgesStart, badgesEnd);
    expect(badgesSection).toContain("count(DISTINCT animalId)");
  });

  it("does NOT use count(*) for animal counting in badges", () => {
    const badgesStart = ROUTERS_SRC.indexOf("checkMyBadges:");
    const badgesEnd = ROUTERS_SRC.indexOf("return { newBadges, total:");
    const badgesSection = ROUTERS_SRC.slice(badgesStart, badgesEnd);
    expect(badgesSection).not.toContain("count(*)`.from(animalOwnerships)");
  });
});

describe("Animal Count Fix — updateOwnerRating deduplication (gamification.ts)", () => {
  it("deduplicates animal IDs with Set before querying metrics", () => {
    const fnStart = GAMIFICATION_SRC.indexOf("updateOwnerRating");
    const fnEnd = GAMIFICATION_SRC.indexOf("// Calculate activity bonus");
    const fnSection = GAMIFICATION_SRC.slice(fnStart, fnEnd);
    expect(fnSection).toContain("new Set(");
    expect(fnSection).toContain("Array.from(");
  });

  it("uses typed number[] for deduplicated animalIds", () => {
    expect(GAMIFICATION_SRC).toContain("const animalIds: number[] = Array.from(new Set(");
  });
});
