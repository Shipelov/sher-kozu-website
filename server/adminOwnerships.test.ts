/**
 * Tests for adminOwnerships router: listByAnimal and updateStatus procedures.
 *
 * These tests use the real tRPC caller against the live database.
 * They rely on the E2E seed data (ensureSprintOneSeed) having already created
 * animals and ownerships for the OWNER_OPEN_ID.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  listAnimalOwnerships,
  updateOwnershipStatus,
  buildShareDistribution,
  purchaseAnimalShare,
  ensureSprintOneSeed,
} from "./db";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createAdminContext(openId: string, name = "Admin User"): TrpcContext {
  return {
    user: {
      id: 1,
      openId,
      email: `${openId}@admin-test.local`,
      name,
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUserContext(openId: string, name = "Test Buyer"): TrpcContext {
  return {
    user: {
      id: 999,
      openId,
      email: `${openId}@test.local`,
      name,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

describe("adminOwnerships procedures", () => {
  const adminOpenId = process.env.OWNER_OPEN_ID ?? "test-admin-ownership";
  const buyerSuffix = Math.random().toString(36).slice(2, 10);
  const buyerOpenId = `ownership-buyer-${buyerSuffix}-${Date.now()}`;

  let animalId: number;
  let ownershipId: number;

  const adminCaller = appRouter.createCaller(createAdminContext(adminOpenId));
  const buyerCaller = appRouter.createCaller(createUserContext(buyerOpenId));

  // Cleanup: remove test ownerships and buyer user after all tests
  afterAll(async () => {
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return;
      await db.execute({
        sql: `DELETE FROM animalOwnerships WHERE ownerOpenId = ?`,
        params: [buyerOpenId],
      });
      await db.execute({
        sql: `DELETE FROM users WHERE openId = ?`,
        params: [buyerOpenId],
      });
    } catch (err) {
      console.warn("[adminOwnerships cleanup] Failed to clean up test data:", err);
    }
  });

  beforeAll(async () => {
    // Ensure seed data exists for the admin (farm owner)
    await ensureSprintOneSeed(adminOpenId);

    // Get animals from public gallery
    const gallery = await appRouter
      .createCaller(createGuestContext())
      .animals.listPublic();
    expect(gallery.length).toBeGreaterThan(0);
    animalId = gallery[0].id;

    // Get animal profile for purchase details
    const profile = await appRouter
      .createCaller(createGuestContext())
      .animals.getBySlug({ slug: gallery[0].slug });

    if (profile.availableSharePercents.length > 0) {
      const purchaseResult = await buyerCaller.animals.purchaseShare({
        animalId,
        sharePercent: profile.availableSharePercents[0],
        planCode: profile.plans[0]?.code ?? "core-care",
        durationMonths: profile.plans[0]?.durations?.[0]?.months ?? 3,
        familyName: "Тестовая семья Ownership",
      });
      ownershipId = purchaseResult.ownershipId;
    }
  }, 30_000);

  /* ─── listByAnimal ─────────────────────────────────────────────── */

  describe("listByAnimal", () => {
    it("returns ownerships for an animal with correct shape", async () => {
      const ownerships = await adminCaller.adminOwnerships.listByAnimal({ animalId });
      expect(Array.isArray(ownerships)).toBe(true);
      expect(ownerships.length).toBeGreaterThan(0);

      const first = ownerships[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("ownerOpenId");
      expect(first).toHaveProperty("slotIndex");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("priceMinor");
      expect(first).toHaveProperty("createdAt");
      // Joined fields
      expect(first).toHaveProperty("familyName");
      expect(first).toHaveProperty("planCode");
      expect(first).toHaveProperty("planName");
      expect(first).toHaveProperty("durationMonths");
      expect(first).toHaveProperty("durationLabel");
    });

    it("returns empty array for non-existent animal", async () => {
      const ownerships = await adminCaller.adminOwnerships.listByAnimal({ animalId: 999999 });
      expect(ownerships).toEqual([]);
    });

    it("includes the buyer ownership we just created", async () => {
      if (!ownershipId) return; // skip if purchase didn't happen
      const ownerships = await adminCaller.adminOwnerships.listByAnimal({ animalId });
      const buyerOwnership = ownerships.find((o) => o.id === ownershipId);
      expect(buyerOwnership).toBeDefined();
      expect(buyerOwnership!.ownerOpenId).toBe(buyerOpenId);
      expect(buyerOwnership!.familyName).toBe("Тестовая семья Ownership");
    });
  });

  /* ─── updateStatus ─────────────────────────────────────────────── */

  describe("updateStatus", () => {
    it("cancels an active ownership", async () => {
      if (!ownershipId) return;
      const result = await adminCaller.adminOwnerships.updateStatus({
        ownershipId,
        status: "cancelled",
      });
      expect(result).toBeDefined();
      expect(result!.newStatus).toBe("cancelled");

      // Verify in DB
      const ownerships = await listAnimalOwnerships(animalId);
      const updated = ownerships.find((o) => o.id === ownershipId);
      expect(updated?.status).toBe("cancelled");
      expect(updated?.cancelledAt).not.toBeNull();
    });

    it("reactivates a cancelled ownership", async () => {
      if (!ownershipId) return;
      const result = await adminCaller.adminOwnerships.updateStatus({
        ownershipId,
        status: "active",
      });
      expect(result).toBeDefined();
      expect(result!.newStatus).toBe("active");

      // Verify in DB
      const ownerships = await listAnimalOwnerships(animalId);
      const updated = ownerships.find((o) => o.id === ownershipId);
      expect(updated?.status).toBe("active");
      expect(updated?.paidAt).not.toBeNull();
    });

    it("returns NOT_FOUND for non-existent ownership", async () => {
      await expect(
        adminCaller.adminOwnerships.updateStatus({
          ownershipId: 999999,
          status: "cancelled",
        }),
      ).rejects.toThrow("Ownership not found");
    });
  });

  /* ─── db helper: buildShareDistribution ────────────────────────── */

  describe("buildShareDistribution", () => {
    it("returns distribution with correct shape", async () => {
      const distribution = await buildShareDistribution(animalId);
      expect(Array.isArray(distribution)).toBe(true);

      if (distribution.length > 0) {
        const entry = distribution[0];
        expect(entry).toHaveProperty("familyName");
        expect(entry).toHaveProperty("percent");
        expect(entry).toHaveProperty("slots");
        expect(entry).toHaveProperty("planLabel");
        expect(typeof entry.familyName).toBe("string");
        expect(typeof entry.percent).toBe("number");
        expect(Array.isArray(entry.slots)).toBe(true);
      }
    });

    it("returns empty array for animal with no active ownerships", async () => {
      const distribution = await buildShareDistribution(999999);
      expect(distribution).toEqual([]);
    });
  });

  /* ─── db helper: listAnimalOwnerships ──────────────────────────── */

  describe("listAnimalOwnerships (db helper)", () => {
    it("returns ownerships ordered by slotIndex", async () => {
      const ownerships = await listAnimalOwnerships(animalId);
      if (ownerships.length >= 2) {
        for (let i = 1; i < ownerships.length; i++) {
          expect(ownerships[i].slotIndex).toBeGreaterThanOrEqual(ownerships[i - 1].slotIndex);
        }
      }
    });
  });

  /* ─── auth guard ───────────────────────────────────────────────── */

  describe("auth guard", () => {
    it("rejects unauthenticated access to listByAnimal", async () => {
      const guestCaller = appRouter.createCaller(createGuestContext());
      await expect(
        guestCaller.adminOwnerships.listByAnimal({ animalId: 1 }),
      ).rejects.toThrow();
    });

    it("rejects unauthenticated access to updateStatus", async () => {
      const guestCaller = appRouter.createCaller(createGuestContext());
      await expect(
        guestCaller.adminOwnerships.updateStatus({ ownershipId: 1, status: "cancelled" }),
      ).rejects.toThrow();
    });
  });
});
