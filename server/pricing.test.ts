/**
 * Pricing Router Tests
 *
 * Tests public procedures: getTiers, getMarketPrices, getConversions, calculate
 * Tests admin procedures: adminListMarketPrices, adminUpdateMarketPrice, adminListTiers
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ─── Helpers ─── */

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@sherkozu.ru",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@sherkozu.ru",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Public Procedures
   ═══════════════════════════════════════════════════════════════════════════ */

describe("pricing.getTiers", () => {
  it("returns an array of active tiers", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const tiers = await caller.pricing.getTiers();

    expect(Array.isArray(tiers)).toBe(true);
    // We seeded 4 tiers: guest, basic, standard, professional
    expect(tiers.length).toBeGreaterThanOrEqual(1);

    // Each tier should have required fields
    for (const tier of tiers) {
      expect(tier).toHaveProperty("id");
      expect(tier).toHaveProperty("name");
      expect(tier).toHaveProperty("slug");
      expect(tier).toHaveProperty("monthlyFee");
      expect(typeof tier.monthlyFee).toBe("number");
      expect(tier).toHaveProperty("featureHighlights");
      expect(Array.isArray(tier.featureHighlights)).toBe(true);
    }
  });

  it("returns tiers ordered by displayOrder", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const tiers = await caller.pricing.getTiers();

    if (tiers.length > 1) {
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].displayOrder).toBeGreaterThanOrEqual(tiers[i - 1].displayOrder);
      }
    }
  });
});

describe("pricing.getTierBySlug", () => {
  it("returns a specific tier by slug", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const tier = await caller.pricing.getTierBySlug({ slug: "basic" });

    expect(tier).toBeDefined();
    expect(tier.slug).toBe("basic");
    expect(tier.name).toBeTruthy();
    expect(typeof tier.monthlyFee).toBe("number");
    expect(tier.monthlyFee).toBeGreaterThan(0);
  });

  it("throws NOT_FOUND for non-existent slug", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(
      caller.pricing.getTierBySlug({ slug: "non-existent-tier" })
    ).rejects.toThrow();
  });
});

describe("pricing.getMarketPrices", () => {
  it("returns an array of market prices", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const prices = await caller.pricing.getMarketPrices();

    expect(Array.isArray(prices)).toBe(true);
    expect(prices.length).toBeGreaterThanOrEqual(1);

    for (const p of prices) {
      expect(p).toHaveProperty("productName");
      expect(p).toHaveProperty("species");
      expect(p).toHaveProperty("avgPrice");
      expect(typeof p.avgPrice).toBe("number");
      expect(p.avgPrice).toBeGreaterThan(0);
    }
  });

  it("filters by species when provided", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const goatPrices = await caller.pricing.getMarketPrices({ species: "goat" });

    for (const p of goatPrices) {
      expect(p.species).toBe("goat");
    }
  });
});

describe("pricing.getConversions", () => {
  it("returns conversion rates with product info", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const conversions = await caller.pricing.getConversions();

    expect(Array.isArray(conversions)).toBe(true);
    expect(conversions.length).toBeGreaterThanOrEqual(1);

    for (const c of conversions) {
      expect(c).toHaveProperty("milkLitersPerUnit");
      expect(c).toHaveProperty("productName");
      expect(typeof c.milkLitersPerUnit).toBe("number");
      expect(c.milkLitersPerUnit).toBeGreaterThan(0);
    }
  });
});

describe("pricing.calculate", () => {
  it("calculates savings for alpine goat at 100% share", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const result = await caller.pricing.calculate({
      breed: "alpine",
      sharePercent: 100,
      productAllocation: {
        "fresh-milk": 30,
        "tvorog": 20,
        "kefir": 15,
        "yogurt": 10,
        "soft-cheese": 25,
      },
      animalPriceRub: 95000,
    });

    expect(result).toBeDefined();
    expect(result.breed).toBe("Альпийская коза");
    expect(result.species).toBe("goat");
    expect(result.sharePercent).toBe(100);
    expect(result.myAnnualMilk).toBe(900);
    expect(result.products.length).toBeGreaterThan(0);
    expect(typeof result.totalMarketValueRub).toBe("number");
    expect(result.totalMarketValueRub).toBeGreaterThan(0);
    expect(typeof result.annualSavingsRub).toBe("number");
    expect(typeof result.savingsPercent).toBe("number");
    expect(result.tierSlug).toBe("standard");
  });

  it("calculates for anglo-nubian at 50% share (basic tier)", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const result = await caller.pricing.calculate({
      breed: "anglo-nubian",
      sharePercent: 50,
      productAllocation: {
        "fresh-milk": 35,
        "tvorog": 20,
        "kefir": 15,
        "yogurt": 10,
        "soft-cheese": 20,
      },
    });

    expect(result.breed).toBe("Англо-нубийская коза");
    expect(result.sharePercent).toBe(50);
    expect(result.myAnnualMilk).toBe(400);
    expect(result.tierSlug).toBe("basic");
  });

  it("calculates for lacaune sheep", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    const result = await caller.pricing.calculate({
      breed: "lacaune",
      sharePercent: 100,
      productAllocation: {
        "fresh-milk": 40,
        "tvorog": 30,
        "kefir": 30,
      },
    });

    expect(result.species).toBe("sheep");
    expect(result.myAnnualMilk).toBe(350);
  });

  it("rejects allocation that does not sum to 100%", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    await expect(
      caller.pricing.calculate({
        breed: "alpine",
        sharePercent: 100,
        productAllocation: {
          "fresh-milk": 50,
          "tvorog": 10,
        },
      })
    ).rejects.toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Admin Procedures
   ═══════════════════════════════════════════════════════════════════════════ */

describe("pricing.adminListMarketPrices", () => {
  it("returns all market prices for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const prices = await caller.pricing.adminListMarketPrices();

    expect(Array.isArray(prices)).toBe(true);
    expect(prices.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.pricing.adminListMarketPrices()).rejects.toThrow();
  });
});

describe("pricing.adminListTiers", () => {
  it("returns all tiers for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const tiers = await caller.pricing.adminListTiers();

    expect(Array.isArray(tiers)).toBe(true);
    expect(tiers.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.pricing.adminListTiers()).rejects.toThrow();
  });
});

describe("pricing.adminGetAnalytics", () => {
  it("returns analytics data for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const analytics = await caller.pricing.adminGetAnalytics({ days: 30 });

    expect(analytics).toHaveProperty("period");
    expect(analytics).toHaveProperty("pageViews");
    expect(analytics).toHaveProperty("calculatorSessions");
    expect(analytics).toHaveProperty("popularConfigs");
    expect(analytics.period.days).toBe(30);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());

    await expect(caller.pricing.adminGetAnalytics({ days: 30 })).rejects.toThrow();
  });
});

describe("pricing.logPageView", () => {
  it("logs a page view successfully", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.pricing.logPageView({
      pagePath: "/pricing",
      referrer: "https://google.com",
      sessionId: "test-session-123",
    });

    expect(result).toEqual({ ok: true });
  });
});
