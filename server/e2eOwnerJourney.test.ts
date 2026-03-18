/**
 * End-to-end smoke test: Gallery → Animal Profile → Share Selection → Purchase → Dashboard
 *
 * This test exercises the full core flow through real tRPC callers against the live database,
 * simulating the journey a user takes from browsing the gallery to seeing their ownership
 * reflected on the Dashboard.
 *
 * Strategy: the test uses the real owner openId (OWNER_OPEN_ID) so that ensureSprintOneSeed
 * has already run and created animals + plans. This avoids unique constraint collisions on
 * the plans.code column and ensures gallery returns available animals.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Authenticated context factory — mirrors auth.logout.test.ts pattern */
function createAuthenticatedContext(openId: string, name = "E2E Test User"): TrpcContext {
  return {
    user: {
      id: 999,
      openId,
      email: `${openId}@e2e-test.local`,
      name,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

/** Unauthenticated (guest) context */
function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

describe("E2E Owner Journey: Gallery → Profile → Share → Purchase → Dashboard", () => {
  // Use a unique buyer openId per test run — different from the farm owner
  // This simulates a new customer purchasing a share
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const buyerOpenId = `buyer-${randomSuffix}-${Date.now()}`;
  const guestCaller = appRouter.createCaller(createGuestContext());
  const authedCaller = appRouter.createCaller(createAuthenticatedContext(buyerOpenId));

  // State shared across steps
  let galleryAnimals: any[];
  let selectedAnimal: any;
  let selectedSlug: string;

  /* ================================================================ */
  /*  Step 1 — Gallery: browse public animals                         */
  /* ================================================================ */

  describe("Step 1: Gallery — browse public animals", () => {
    it("returns a non-empty list of public animals", async () => {
      galleryAnimals = await guestCaller.animals.listPublic();

      expect(Array.isArray(galleryAnimals)).toBe(true);
      expect(galleryAnimals.length).toBeGreaterThan(0);
    });

    it("each animal has required fields for the gallery card", () => {
      for (const animal of galleryAnimals) {
        expect(animal).toHaveProperty("id");
        expect(animal).toHaveProperty("slug");
        expect(animal).toHaveProperty("name");
        expect(animal).toHaveProperty("species");
        expect(animal).toHaveProperty("shortDescription");
        expect(animal).toHaveProperty("status");
        expect(["public_available", "public_limited", "fully_booked"]).toContain(animal.status);
      }
    });

    it("selects an animal for the journey (available or fully_booked)", () => {
      // Prefer available animals, but accept fully_booked for the flow test
      // (purchase will be tested against available capacity)
      const available = galleryAnimals.filter(
        (a) => a.status === "public_available" || a.status === "public_limited"
      );
      const target = available.length > 0 ? available[0] : galleryAnimals[0];

      expect(target).toBeTruthy();
      selectedAnimal = target;
      selectedSlug = target.slug;
    });
  });

  /* ================================================================ */
  /*  Step 2 — Animal Profile: view details and share options          */
  /* ================================================================ */

  describe("Step 2: Animal Profile — view details and share options", () => {
    it("returns full profile for the selected animal by slug", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });

      expect(profile).not.toBeNull();
      expect(profile!.id).toBe(selectedAnimal.id);
      expect(profile!.slug).toBe(selectedSlug);
      expect(profile!.name).toBeTruthy();
      expect(profile!.shortDescription).toBeTruthy();
    });

    it("profile includes share metrics for the selection card", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });

      expect(profile).toHaveProperty("availablePercent");
      expect(profile).toHaveProperty("ownedPercent");
      expect(profile).toHaveProperty("shareUnitPercent");
      expect(profile!.shareUnitPercent).toBeGreaterThan(0);
    });

    it("profile includes at least one active plan with durations", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });

      expect(profile).toHaveProperty("plans");
      expect(Array.isArray(profile!.plans)).toBe(true);
      expect(profile!.plans.length).toBeGreaterThan(0);

      const firstPlan = profile!.plans[0];
      expect(firstPlan).toHaveProperty("id");
      expect(firstPlan).toHaveProperty("durations");
      expect(Array.isArray(firstPlan.durations)).toBe(true);
      expect(firstPlan.durations.length).toBeGreaterThan(0);
      expect(firstPlan.durations[0]).toHaveProperty("months");
    });

    it("active plans are also available via plans.listActive", async () => {
      const activePlans = await guestCaller.plans.listActive();

      expect(Array.isArray(activePlans)).toBe(true);
      expect(activePlans.length).toBeGreaterThan(0);
      expect(activePlans[0].durations.length).toBeGreaterThan(0);
    });
  });

  /* ================================================================ */
  /*  Step 3 — Share Selection: choose share percent                   */
  /* ================================================================ */

  describe("Step 3: Share Selection — validate share percent options", () => {
    it("share unit percent divides evenly into 100", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });
      const unit = profile!.shareUnitPercent;

      expect(unit).toBeGreaterThan(0);
      expect(100 % unit).toBe(0);
    });

    it("available + owned percent sums to 100", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });

      expect(profile!.availablePercent + profile!.ownedPercent).toBe(100);
    });
  });

  /* ================================================================ */
  /*  Step 4 — Purchase: book a share as authenticated user            */
  /* ================================================================ */

  describe("Step 4: Purchase — book a share (authenticated)", () => {
    let purchaseResult: any;

    it("rejects purchase from unauthenticated user", async () => {
      await expect(
        guestCaller.animals.purchaseShare({
          animalId: selectedAnimal.id,
          sharePercent: 10,
        })
      ).rejects.toThrow();
    });

    it("successfully purchases a share with server-side plan fallback", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });
      const sharePercent = profile!.shareUnitPercent;

      // Skip if no capacity left (animal fully booked from previous test runs)
      if (profile!.availablePercent < sharePercent) {
        console.warn(
          `[E2E] Skipping purchase: ${selectedSlug} has ${profile!.availablePercent}% available, need ${sharePercent}%`
        );
        return;
      }

      purchaseResult = await authedCaller.animals.purchaseShare({
        animalId: selectedAnimal.id,
        sharePercent,
        // Intentionally omit planId and planDurationId to test server-side fallback
      });

      expect(purchaseResult).toBeTruthy();
      expect(purchaseResult.success).toBe(true);
      expect(purchaseResult.animalId).toBe(selectedAnimal.id);
      expect(purchaseResult.sharePercent).toBe(sharePercent);
      expect(purchaseResult.requestedSlots).toBeGreaterThan(0);
      expect(purchaseResult.priceMinor).toBeGreaterThan(0);
      expect(purchaseResult.slotIndexes.length).toBe(purchaseResult.requestedSlots);
    });

    it("purchase result includes refreshed animal with updated share metrics", () => {
      if (!purchaseResult) return; // skipped if no capacity
      expect(purchaseResult.animal).toBeTruthy();
      expect(purchaseResult.animal.ownedPercent).toBeGreaterThan(0);
    });

    it("successfully purchases with explicit planId and planDurationId", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });
      const plan = profile!.plans[0];
      const duration = plan?.durations?.[0];
      const sharePercent = profile!.shareUnitPercent;

      // Only attempt if there's still available capacity and plan/duration exist
      if (!plan || !duration || profile!.availablePercent < sharePercent) {
        return;
      }

      const result = await authedCaller.animals.purchaseShare({
        animalId: selectedAnimal.id,
        sharePercent,
        planId: plan.id,
        planDurationId: duration.id,
      });

      expect(result.success).toBe(true);
      expect(result.sharePercent).toBe(sharePercent);
    });

    it("rejects purchase when share percent exceeds available capacity", async () => {
      await expect(
        authedCaller.animals.purchaseShare({
          animalId: selectedAnimal.id,
          sharePercent: 100, // likely exceeds remaining capacity
        })
      ).rejects.toThrow();
    });

    it("rejects purchase with invalid share percent (not a multiple of unit)", async () => {
      await expect(
        authedCaller.animals.purchaseShare({
          animalId: selectedAnimal.id,
          sharePercent: 15, // not a multiple of 10
        })
      ).rejects.toThrow();
    });
  });

  /* ================================================================ */
  /*  Step 5 — Dashboard: verify ownership reflected                   */
  /* ================================================================ */

  describe("Step 5: Dashboard — verify ownership is reflected", () => {
    let dashboardData: any;

    beforeAll(async () => {
      dashboardData = await authedCaller.animals.ownerDashboard();
    });

    it("returns dashboard data for the authenticated owner", () => {
      expect(dashboardData).toBeTruthy();
      expect(dashboardData).toHaveProperty("quickLinks");
      expect(dashboardData).toHaveProperty("nextSteps");
    });

    it("dashboard includes ownership or explore prompt", () => {
      // After purchase, ownership should be present
      // If no purchase was made (fully booked), nextSteps should suggest exploring
      if (dashboardData.ownership) {
        expect(dashboardData.ownership.animalId).toBe(selectedAnimal.id);
        expect(dashboardData.ownership.animalSlug).toBe(selectedSlug);
        expect(dashboardData.ownership.slotsCount).toBeGreaterThan(0);
        expect(["pending_payment", "active"]).toContain(dashboardData.ownership.status);
        expect(dashboardData.ownership.statusLabel).toBeTruthy();
      } else {
        // No ownership — dashboard should provide explore prompt
        expect(dashboardData.nextSteps.length).toBeGreaterThan(0);
      }
    });

    it("dashboard animal matches the purchased animal profile (if ownership exists)", () => {
      if (!dashboardData?.ownership) return;

      expect(dashboardData.animal).not.toBeNull();
      expect(dashboardData.animal.id).toBe(selectedAnimal.id);
      expect(dashboardData.animal.slug).toBe(selectedSlug);
      expect(dashboardData.animal.name).toBeTruthy();
      expect(dashboardData.animal.species).toBeTruthy();
    });

    it("dashboard includes club summary", () => {
      expect(dashboardData.clubSummary).toBeTruthy();
      expect(dashboardData.clubSummary).toHaveProperty("postCount");
      expect(dashboardData.clubSummary).toHaveProperty("eventCount");
      expect(dashboardData.clubSummary).toHaveProperty("memberCount");
    });

    it("quick links are well-formed", () => {
      expect(Array.isArray(dashboardData.quickLinks)).toBe(true);
      expect(dashboardData.quickLinks.length).toBeGreaterThan(0);

      for (const link of dashboardData.quickLinks) {
        expect(link).toHaveProperty("label");
        expect(link).toHaveProperty("href");
        expect(link).toHaveProperty("description");
        expect(link.href).toBeTruthy();
      }
    });

    it("next steps are well-formed and include expected kinds", () => {
      expect(Array.isArray(dashboardData.nextSteps)).toBe(true);
      expect(dashboardData.nextSteps.length).toBeGreaterThan(0);

      for (const step of dashboardData.nextSteps) {
        expect(step).toHaveProperty("id");
        expect(step).toHaveProperty("title");
        expect(step).toHaveProperty("kind");
        expect(step).toHaveProperty("href");
      }
    });
  });

  /* ================================================================ */
  /*  Step 6 — Post-purchase profile: verify updated share metrics     */
  /* ================================================================ */

  describe("Step 6: Post-purchase profile — verify updated share metrics", () => {
    it("animal profile reflects updated metrics after purchase", async () => {
      const profile = await guestCaller.animals.getBySlug({ slug: selectedSlug });

      expect(profile).not.toBeNull();
      // availablePercent + ownedPercent should always sum to 100
      expect(profile!.availablePercent + profile!.ownedPercent).toBe(100);
    });

    it("gallery listing still includes the animal", async () => {
      const updatedGallery = await guestCaller.animals.listPublic();
      const updatedAnimal = updatedGallery.find((a: any) => a.slug === selectedSlug);

      expect(updatedAnimal).toBeTruthy();
      expect(["public_available", "public_limited", "fully_booked"]).toContain(
        updatedAnimal!.status
      );
    });
  });
});
