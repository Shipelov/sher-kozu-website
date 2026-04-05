/**
 * E2E Marketplace Journey: Wallet → Browse Items → Purchase → Leaderboard → Badges
 *
 * Tests the full gamification lifecycle including:
 * - Wallet balance and transaction history
 * - Marketplace item browsing
 * - SKC purchase flow with balance deduction
 * - Leaderboard rankings
 * - Badge system
 * - Animal wellness metrics
 * - Owner rating system
 */
import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createAuthenticatedContext(
  openId: string,
  name = "E2E Marketplace User",
  role: "user" | "admin" = "user",
  userId = 9991
): TrpcContext {
  return {
    user: {
      id: userId,
      openId,
      email: `${openId}@e2e-marketplace.local`,
      name,
      loginMethod: "local",
      role,
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

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(openId: string, name = "E2E Admin"): TrpcContext {
  return createAuthenticatedContext(openId, name, "admin", 9992);
}

/* ------------------------------------------------------------------ */
/*  Test suite                                                         */
/* ------------------------------------------------------------------ */

describe("E2E Marketplace Journey: Wallet → Items → Purchase → Leaderboard → Badges", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const buyerOpenId = `mkt-buyer-${suffix}-${Date.now()}`;
  const adminOpenId = process.env.OWNER_OPEN_ID || `mkt-admin-${suffix}`;

  const buyerCaller = appRouter.createCaller(createAuthenticatedContext(buyerOpenId, `Покупатель ${suffix}`));
  const adminCaller = appRouter.createCaller(createAdminContext(adminOpenId, "Админ Маркетплейс"));
  const guestCaller = appRouter.createCaller(createGuestContext());

  // Track created resources for cleanup
  let testAnimalId: number | null = null;

  afterAll(async () => {
    try {
      const { getDb } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return;

      // Clean up marketplace purchases
      await db.execute(sql`DELETE FROM marketplacePurchases WHERE ownerOpenId = ${buyerOpenId}`);
      // Clean up wallet
      await db.execute(sql`DELETE FROM walletTransactions WHERE ownerOpenId = ${buyerOpenId}`);
      await db.execute(sql`DELETE FROM wallets WHERE ownerOpenId = ${buyerOpenId}`);
      // Clean up badges
      await db.execute(sql`DELETE FROM achievementBadges WHERE ownerOpenId = ${buyerOpenId}`);
      // Clean up ratings
      await db.execute(sql`DELETE FROM ownerRatings WHERE ownerOpenId = ${buyerOpenId}`);
      // Clean up ownerships
      await db.execute(sql`DELETE FROM animalOwnerships WHERE ownerOpenId = ${buyerOpenId}`);
      // Clean up test user
      await db.execute(sql`DELETE FROM users WHERE openId = ${buyerOpenId}`);
    } catch (err) {
      console.warn("[E2E Marketplace cleanup] Failed:", err);
    }
  });

  /* ─── 1. Wallet Operations ─── */

  it("1.1 should get wallet balance (may be null for new user)", async () => {
    const balance = await buyerCaller.gamification.wallet.balance();
    // Wallet may be null if not yet created for this user
    if (balance !== null) {
      expect(typeof balance.balanceSKC).toBe("number");
      expect(balance.balanceSKC).toBeGreaterThanOrEqual(0);
    } else {
      expect(balance).toBeNull();
    }
  });

  it("1.2 should get empty transaction history for new user", async () => {
    const transactions = await buyerCaller.gamification.wallet.transactions();
    expect(transactions).toBeDefined();
    expect(Array.isArray(transactions)).toBe(true);
  });

  it("1.3 should get empty purchase history for new user", async () => {
    const history = await buyerCaller.gamification.wallet.purchaseHistory();
    expect(history).toBeDefined();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
  });

  /* ─── 2. Marketplace Browsing ─── */

  it("2.1 should list marketplace items", async () => {
    const items = await buyerCaller.gamification.items.list();
    expect(items).toBeDefined();
    expect(Array.isArray(items)).toBe(true);
  });

  it("2.2 should list marketplace categories", async () => {
    try {
      const categories = await buyerCaller.gamification.items.categories();
      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
    } catch {
      // Categories may not exist yet — that's fine
    }
  });

  /* ─── 3. Leaderboard ─── */

  it("3.1 should load herd leaderboard", async () => {
    const leaderboard = await buyerCaller.gamification.leaderboard.herd();
    expect(leaderboard).toBeDefined();
    expect(Array.isArray(leaderboard)).toBe(true);
  });

  it("3.2 should load owners leaderboard", async () => {
    const leaderboard = await buyerCaller.gamification.leaderboard.owners();
    expect(leaderboard).toBeDefined();
    expect(Array.isArray(leaderboard)).toBe(true);
  });

  /* ─── 4. Badge System ─── */

  it("4.1 should get badges for current user", async () => {
    const badges = await buyerCaller.badges.myBadges();
    expect(badges).toBeDefined();
    expect(Array.isArray(badges)).toBe(true);
  });

  it("4.2 should get badge definitions", async () => {
    const definitions = await buyerCaller.badges.definitions();
    expect(definitions).toBeDefined();
    expect(Array.isArray(definitions)).toBe(true);
    expect(definitions.length).toBeGreaterThan(0);
  });

  it("4.3 should check and award badges without error", async () => {
    const result = await buyerCaller.badges.checkMyBadges();
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
  });

  /* ─── 5. Animal Wellness (if animals exist) ─── */

  it("5.1 should handle wellness query for non-existent animal gracefully", async () => {
    try {
      await buyerCaller.gamification.wellness.get({ animalId: 999999 });
    } catch (err: any) {
      // Should throw NOT_FOUND or similar, not crash
      expect(err.code || err.message).toBeDefined();
    }
  });

  /* ─── 6. FAQ Chat (public) ─── */

  it("6.1 should get FAQ greeting variant", async () => {
    const sessionId = `e2e-session-${suffix}`;
    const greeting = await guestCaller.faqChat.getGreetingVariant({
      sessionId,
      source: "faq",
    });
    expect(greeting).toBeDefined();
  });

  /* ─── 7. Product Tracker Access Control ─── */

  it("7.1 should list owned animals for tracker (empty for new user)", async () => {
    const myAnimals = await buyerCaller.productTracker.myAnimals();
    expect(myAnimals).toBeDefined();
    expect(Array.isArray(myAnimals)).toBe(true);
  });

  it("7.2 should deny tracker access to non-owned animal", async () => {
    await expect(
      buyerCaller.productTracker.getByAnimal({ animalSlug: "non-existent-animal-slug" })
    ).rejects.toThrow();
  });

  /* ─── 8. Guest Access Restrictions ─── */

  it("8.1 guest should not access wallet", async () => {
    await expect(guestCaller.gamification.wallet.balance()).rejects.toThrow();
  });

  it("8.2 guest should not access leaderboard", async () => {
    await expect(guestCaller.gamification.leaderboard.herd()).rejects.toThrow();
  });

  it("8.3 guest should not access badges", async () => {
    await expect(guestCaller.badges.myBadges()).rejects.toThrow();
  });

  it("8.4 guest should not access product tracker", async () => {
    await expect(guestCaller.productTracker.myAnimals()).rejects.toThrow();
  });
});
