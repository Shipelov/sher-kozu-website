import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression tests: ClubFeed animal switcher must only show owned animals
 * (from ownerDashboard.allOwnerships), not all public animals (listPublic).
 *
 * Same pattern as trackerOwnershipFilter.test.ts — validates that the
 * ClubFeed component no longer references trpc.animals.listPublic for
 * its animal switcher dropdown.
 */

const clubFeedPath = path.resolve(__dirname, "../client/src/pages/ClubFeed.tsx");
const clubFeedSource = fs.readFileSync(clubFeedPath, "utf-8");

describe("ClubFeed animal switcher ownership filter", () => {
  it("should NOT use trpc.animals.listPublic.useQuery for the switcher data source", () => {
    expect(clubFeedSource).not.toContain("trpc.animals.listPublic.useQuery");
  });

  it("should derive allOwnerships from dashboardQuery (ownerDashboard)", () => {
    expect(clubFeedSource).toContain("dashboardQuery.data?.allOwnerships");
  });

  it("should use allOwnerships for the animal switcher visibility condition", () => {
    expect(clubFeedSource).toContain("allOwnerships.length > 1");
  });

  it("should iterate allOwnerships in the switcher dropdown", () => {
    expect(clubFeedSource).toContain("allOwnerships.map(");
  });

  it("should use owned.animalSlug for navigation in the switcher", () => {
    expect(clubFeedSource).toContain("owned.animalSlug");
  });

  it("should use owned.animalName for display in the switcher", () => {
    expect(clubFeedSource).toContain("owned.animalName");
  });

  it("should display share percent in the switcher dropdown", () => {
    expect(clubFeedSource).toContain("owned.sharePercent");
  });

  it("should resolve activeOwnership from allOwnerships by activeAnimalSlug", () => {
    expect(clubFeedSource).toContain("allOwnerships.find((o) => o.animalSlug === activeAnimalSlug)");
  });

  it("should derive activeAnimalName from activeOwnership first (not ownerAnimal)", () => {
    expect(clubFeedSource).toContain("activeOwnership?.animalName ?? ownerAnimal?.name");
  });

  it("should derive activeAnimalCoverUrl from activeOwnership first", () => {
    expect(clubFeedSource).toContain("activeOwnership?.coverImageUrl ?? ownerAnimal?.coverImageUrl");
  });

  it("should derive activeAnimalSharePercent from activeOwnership first", () => {
    expect(clubFeedSource).toContain("activeOwnership?.sharePercent");
  });

  it("should use activeOwnership for guest journey check", () => {
    expect(clubFeedSource).toContain("!activeOwnership && !ownership");
  });
});

describe("Dashboard animal display uses allOwnerships (not listPublic)", () => {
  const dashboardPath = path.resolve(__dirname, "../client/src/pages/Dashboard.tsx");
  const dashboardSource = fs.readFileSync(dashboardPath, "utf-8");

  it("should NOT use trpc.animals.listPublic.useQuery in Dashboard", () => {
    expect(dashboardSource).not.toContain("trpc.animals.listPublic.useQuery");
  });

  it("should derive allOwnerships from ownerDashboardQuery", () => {
    expect(dashboardSource).toContain("dashboard?.allOwnerships");
  });

  it("should use allOwnerships for multi-animal section", () => {
    expect(dashboardSource).toContain("allOwnerships.length > 1");
  });
});
