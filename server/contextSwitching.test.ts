import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for "Automatic Context Switching" feature.
 *
 * When the user changes their primary animal in the Dashboard,
 * the Product Tracker and Club Feed should automatically reflect
 * the new animal's data by invalidating their cached queries.
 *
 * Covers:
 * 1. Dashboard: invalidates productTracker and club queries on setPrimaryAnimal success
 * 2. ProductTracker: derives animal context from ownerDashboard data
 * 3. ClubFeed: derives animal context from ownerDashboard data
 * 4. Server: ownerDashboard returns correct primary animal data
 * 5. Server: productTracker.getByAnimal uses animalSlug parameter
 */

const DASHBOARD_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"),
  "utf-8",
);
const TRACKER_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/ProductTracker.tsx"),
  "utf-8",
);
const CLUB_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/ClubFeed.tsx"),
  "utf-8",
);
const DB_SRC = fs.readFileSync(path.resolve(__dirname, "db.ts"), "utf-8");
const ROUTERS_SRC = fs.readFileSync(path.resolve(__dirname, "routers.ts"), "utf-8");

describe("Context Switching: Dashboard invalidation cascade", () => {
  it("invalidates ownerDashboard on setPrimaryAnimal success", () => {
    expect(DASHBOARD_SRC).toContain("utils.animals.ownerDashboard.invalidate()");
  });

  it("invalidates productTracker.getByAnimal on setPrimaryAnimal success", () => {
    expect(DASHBOARD_SRC).toContain("utils.productTracker.getByAnimal.invalidate()");
  });

  it("invalidates club.feed on setPrimaryAnimal success", () => {
    expect(DASHBOARD_SRC).toContain("utils.club.feed.invalidate()");
  });

  it("all three invalidations are in the onSuccess handler", () => {
    // Find the onSuccess block
    const onSuccessStart = DASHBOARD_SRC.indexOf("onSuccess: (_data, variables) => {");
    expect(onSuccessStart).toBeGreaterThan(-1);

    // Find the closing of the onSuccess handler (next onError)
    const onErrorStart = DASHBOARD_SRC.indexOf("onError:", onSuccessStart);
    expect(onErrorStart).toBeGreaterThan(onSuccessStart);

    const onSuccessBlock = DASHBOARD_SRC.substring(onSuccessStart, onErrorStart);

    expect(onSuccessBlock).toContain("utils.animals.ownerDashboard.invalidate()");
    expect(onSuccessBlock).toContain("utils.productTracker.getByAnimal.invalidate()");
    expect(onSuccessBlock).toContain("utils.club.feed.invalidate()");
  });

  it("toast message mentions tracker and club context update", () => {
    expect(DASHBOARD_SRC).toContain("трекер продукции и клуб теперь показывают");
  });
});

describe("Context Switching: ProductTracker derives animal from ownerDashboard", () => {
  it("calls trpc.animals.ownerDashboard.useQuery()", () => {
    expect(TRACKER_SRC).toContain("trpc.animals.ownerDashboard.useQuery(undefined");
  });

  it("extracts ownerAnimalSlug from dashboard data", () => {
    expect(TRACKER_SRC).toContain("ownerDashboardQuery.data?.animal?.slug");
  });

  it("uses ownerAnimalSlug as fallback for tracker query", () => {
    expect(TRACKER_SRC).toContain("requestedAnimalSlug ?? ownerAnimalSlug");
  });

  it("passes fallbackAnimalSlug to productTracker.getByAnimal query", () => {
    expect(TRACKER_SRC).toContain("trpc.productTracker.getByAnimal.useQuery");
    expect(TRACKER_SRC).toContain("animalSlug: fallbackAnimalSlug");
  });

  it("derives featuredAnimalName from dashboard or tracker data", () => {
    expect(TRACKER_SRC).toContain("ownerDashboardQuery.data?.animal?.name");
  });

  it("shows loading state while dashboard or tracker data loads", () => {
    expect(TRACKER_SRC).toContain("trackerQuery.isLoading || ownerDashboardQuery.isLoading");
  });

  it("generates cross-navigation links using current animal slug", () => {
    expect(TRACKER_SRC).toContain("`/dashboard?animal=${currentAnimalSlug}`");
    expect(TRACKER_SRC).toContain("`/club?animal=${currentAnimalSlug}`");
    expect(TRACKER_SRC).toContain("`/animals/${currentAnimalSlug}`");
  });
});

describe("Context Switching: ClubFeed derives animal from ownerDashboard", () => {
  it("calls trpc.animals.ownerDashboard.useQuery conditionally", () => {
    expect(CLUB_SRC).toContain("trpc.animals.ownerDashboard.useQuery");
  });

  it("extracts ownerAnimal from dashboard data", () => {
    expect(CLUB_SRC).toContain("dashboardQuery.data?.animal");
  });

  it("uses ownerAnimal slug as primary active animal slug", () => {
    expect(CLUB_SRC).toContain("ownerAnimal?.slug ?? requestedAnimalSlug");
  });

  it("uses ownerAnimal name as active animal name", () => {
    expect(CLUB_SRC).toContain("ownerAnimal?.name ?? fallbackAnimal?.name");
  });

  it("uses ownership share percent from dashboard data", () => {
    expect(CLUB_SRC).toContain("ownership?.sharePercent ?? ownerAnimal?.mySharePercent");
  });

  it("generates cross-navigation links using active animal slug", () => {
    expect(CLUB_SRC).toContain("`/tracker?animal=${activeAnimalSlug}`");
    expect(CLUB_SRC).toContain("`/dashboard?animal=${activeAnimalSlug}`");
    expect(CLUB_SRC).toContain("`/animals/${activeAnimalSlug}`");
  });

  it("displays animal name in club hero section", () => {
    expect(CLUB_SRC).toContain("activeAnimalName");
    // Check it's used in visible text
    expect(CLUB_SRC).toContain("${activeAnimalName}");
  });

  it("displays share percentage in club context", () => {
    expect(CLUB_SRC).toContain("activeAnimalSharePercent");
    expect(CLUB_SRC).toContain("${activeAnimalSharePercent}%");
  });
});

describe("Context Switching: Server-side data flow", () => {
  it("getOwnerDashboardData reads primaryAnimalId from users table", () => {
    expect(DB_SRC).toContain("users.primaryAnimalId");
    expect(DB_SRC).toContain("preferredAnimalId");
  });

  it("getOwnerDashboardData uses preferredAnimalId to select primary ownership group", () => {
    expect(DB_SRC).toContain("preferredAnimalId && groupedByAnimal.has(preferredAnimalId)");
  });

  it("getOwnerDashboardData fetches tracker data for the primary animal", () => {
    expect(DB_SRC).toContain("getProductTrackerData(ownerOpenId, primaryOwnership.animalSlug)");
  });

  it("getOwnerDashboardData fetches club data for the owner", () => {
    expect(DB_SRC).toContain("getClubFeedData(ownerOpenId)");
  });

  it("getOwnerDashboardData returns animal slug in response", () => {
    expect(DB_SRC).toContain("slug: currentAnimal.slug");
  });

  it("productTracker.getByAnimal accepts animalSlug parameter", () => {
    expect(ROUTERS_SRC).toContain("getProductTrackerData(ctx.user.openId, input.animalSlug)");
  });

  it("getProductTrackerData filters by animalSlug", () => {
    expect(DB_SRC).toContain("eq(productBatches.animalSlug, animalSlug)");
    expect(DB_SRC).toContain("eq(productCompositionSnapshots.animalSlug, animalSlug)");
    expect(DB_SRC).toContain("eq(productMonthlyMetrics.animalSlug, animalSlug)");
    expect(DB_SRC).toContain("eq(productDeliveries.animalSlug, animalSlug)");
  });

  it("getProductTrackerData returns currentAnimal with slug and name", () => {
    expect(DB_SRC).toContain("slug: animal.slug");
    expect(DB_SRC).toContain("name: animal.name");
  });
});

describe("Context Switching: URL-based animal override", () => {
  it("ProductTracker supports ?animal= query parameter", () => {
    expect(TRACKER_SRC).toContain('getRequestedAnimalSlug');
    expect(TRACKER_SRC).toContain('.get("animal")');
  });

  it("ClubFeed supports ?animal= query parameter", () => {
    expect(CLUB_SRC).toContain('getRequestedAnimalSlug');
    expect(CLUB_SRC).toContain('.get("animal")');
  });

  it("URL parameter takes priority over dashboard primary animal in ProductTracker", () => {
    // requestedAnimalSlug ?? ownerAnimalSlug — URL comes first
    const line = TRACKER_SRC.match(/const fallbackAnimalSlug = .+/)?.[0] ?? "";
    expect(line).toMatch(/requestedAnimalSlug.*ownerAnimalSlug/);
  });

  it("Dashboard generates tracker and club links with animal slug", () => {
    expect(DASHBOARD_SRC).toContain("/tracker?animal=");
    expect(DASHBOARD_SRC).toContain("/club?animal=");
  });
});
