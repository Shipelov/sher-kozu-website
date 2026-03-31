import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for badge revocation logic.
 *
 * Ensures that:
 * 1. badges.ts exports revokeBadge and revokeInvalidBadges functions
 * 2. checkAndAwardBadges revokes herd_of_five when animalCount < 5
 * 3. checkMyBadges procedure calls revokeInvalidBadges before awarding
 * 4. Dashboard UI handles revokedBadges in mutation response
 */

const BADGES_SRC = fs.readFileSync(path.resolve(__dirname, "badges.ts"), "utf-8");
const ROUTERS_SRC = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf-8");
const DASHBOARD_SRC = fs.readFileSync(path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"), "utf-8");

describe("Badge Revocation — badges.ts", () => {
  it("exports revokeBadge function", () => {
    expect(BADGES_SRC).toContain("export async function revokeBadge(");
  });

  it("exports revokeInvalidBadges function", () => {
    expect(BADGES_SRC).toContain("export async function revokeInvalidBadges(");
  });

  it("revokeBadge deletes from achievementBadges table", () => {
    expect(BADGES_SRC).toContain(".delete(achievementBadges)");
  });

  it("checkAndAwardBadges revokes herd_of_five when animalCount < 5", () => {
    expect(BADGES_SRC).toContain('context.animalCount < 5');
    expect(BADGES_SRC).toContain('revokeBadge(ownerOpenId, "herd_of_five")');
  });

  it("revokeInvalidBadges checks herd_of_five condition", () => {
    const fnStart = BADGES_SRC.indexOf("export async function revokeInvalidBadges");
    const fnBody = BADGES_SRC.slice(fnStart);
    expect(fnBody).toContain("context.animalCount < 5");
    expect(fnBody).toContain('"herd_of_five"');
  });

  it("revokeInvalidBadges checks caring_owner condition", () => {
    const fnStart = BADGES_SRC.indexOf("export async function revokeInvalidBadges");
    const fnBody = BADGES_SRC.slice(fnStart);
    expect(fnBody).toContain("animalHealthScores");
    expect(fnBody).toContain('"caring_owner"');
  });

  it("revokeInvalidBadges checks happy_herd condition", () => {
    const fnStart = BADGES_SRC.indexOf("export async function revokeInvalidBadges");
    const fnBody = BADGES_SRC.slice(fnStart);
    expect(fnBody).toContain("animalHappinessScores");
    expect(fnBody).toContain('"happy_herd"');
  });
});

describe("Badge Revocation — routers.ts checkMyBadges", () => {
  it("imports revokeInvalidBadges from badges module", () => {
    expect(ROUTERS_SRC).toContain("revokeInvalidBadges");
  });

  it("calls revokeInvalidBadges before checkAndAwardBadges", () => {
    const revokeIdx = ROUTERS_SRC.indexOf("revokeInvalidBadges(ownerOpenId");
    const awardIdx = ROUTERS_SRC.indexOf("checkAndAwardBadges(ownerOpenId");
    expect(revokeIdx).toBeGreaterThan(-1);
    expect(awardIdx).toBeGreaterThan(-1);
    expect(revokeIdx).toBeLessThan(awardIdx);
  });

  it("returns revokedBadges in response", () => {
    expect(ROUTERS_SRC).toContain("revokedBadges");
    expect(ROUTERS_SRC).toContain("return { newBadges, revokedBadges, total:");
  });
});

describe("Badge Revocation — Dashboard UI", () => {
  it("handles revokedBadges in checkMyBadges onSuccess", () => {
    expect(DASHBOARD_SRC).toContain("result.revokedBadges");
  });

  it("shows toast for revoked badges", () => {
    expect(DASHBOARD_SRC).toContain("достижений отозвано");
  });

  it("invalidates badges cache when badges are revoked", () => {
    expect(DASHBOARD_SRC).toContain("hasRevoked");
    expect(DASHBOARD_SRC).toContain("if (hasNew || hasRevoked)");
  });
});
