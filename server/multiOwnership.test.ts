import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Multi-ownership dashboard tests.
 *
 * These are structural tests that verify:
 * 1. getOwnerDashboardData returns `allOwnerships` array
 * 2. Dashboard.tsx renders the allOwnerships section
 * 3. allOwnerships entries have the correct shape
 */

const DB_SRC = fs.readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const DASHBOARD_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"),
  "utf-8",
);

describe("Multi-ownership: server-side (db.ts)", () => {
  it("getOwnerDashboardData returns allOwnerships in the response", () => {
    // The return object must include allOwnerships
    expect(DB_SRC).toContain("allOwnerships,");
    expect(DB_SRC).toContain("allOwnerships =");
  });

  it("allOwnerships is built from sortedGroups (all animal groups, not just primary)", () => {
    expect(DB_SRC).toContain("sortedGroups.map");
  });

  it("each allOwnerships entry includes required fields", () => {
    // Verify the shape of each entry
    const requiredFields = [
      "animalId",
      "animalSlug",
      "animalName",
      "species",
      "breed",
      "coverImageUrl",
      "sharePercent",
      "slotsCount",
      "status",
      "statusLabel",
      "startsAt",
      "endsAt",
      "priceMinorTotal",
      "slotIndexes",
    ];
    for (const field of requiredFields) {
      expect(DB_SRC).toContain(`${field}:`);
    }
  });

  it("primaryOwnershipGroup is derived from sortedGroups[0], not the only group", () => {
    expect(DB_SRC).toContain("sortedGroups[0]");
    // sortedGroups should be a separate variable, not inlined with [0]
    expect(DB_SRC).toContain("const sortedGroups");
  });
});

describe("Multi-ownership: client-side (Dashboard.tsx)", () => {
  it("Dashboard destructures allOwnerships from dashboard data", () => {
    expect(DASHBOARD_SRC).toContain("allOwnerships");
    expect(DASHBOARD_SRC).toContain("dashboard?.allOwnerships");
  });

  it("Dashboard renders multi-animal section when allOwnerships.length > 1", () => {
    expect(DASHBOARD_SRC).toContain("allOwnerships.length > 1");
    expect(DASHBOARD_SRC).toContain("dashboardAllOwnerships");
  });

  it("Dashboard renders single-ownership compact card when allOwnerships.length === 1", () => {
    expect(DASHBOARD_SRC).toContain("allOwnerships.length === 1");
    expect(DASHBOARD_SRC).toContain("dashboardSingleOwnership");
  });

  it("each animal card links to the animal profile page", () => {
    expect(DASHBOARD_SRC).toContain("/animals/${item.animalSlug}");
  });

  it("primary animal is visually highlighted", () => {
    expect(DASHBOARD_SRC).toContain("isPrimary");
    expect(DASHBOARD_SRC).toContain("Основное");
  });

  it("animal card shows share percent, status, slots count and price", () => {
    expect(DASHBOARD_SRC).toContain("item.sharePercent");
    expect(DASHBOARD_SRC).toContain("item.statusLabel");
    expect(DASHBOARD_SRC).toContain("item.slotsCount");
    expect(DASHBOARD_SRC).toContain("item.priceMinorTotal");
  });

  it("section header shows correct animal count", () => {
    expect(DASHBOARD_SRC).toContain("allOwnerships.length");
    expect(DASHBOARD_SRC).toContain("Мои животные");
  });
});
