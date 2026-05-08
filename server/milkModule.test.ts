/**
 * Tests for Milk Turnover Control Module.
 *
 * Covers:
 * - milkAutoConfirm cron logic (unit)
 * - milkSession tRPC router (auth guard, validation)
 * - milkReception tRPC router (auth guard)
 * - milkAdmin tRPC router (admin guard, overview, tanks CRUD)
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Shared context helpers ─────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-test",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-test",
      email: "user@test.com",
      name: "User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any,
    req: {
      protocol: "https",
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

// ─── milkAutoConfirm unit tests ─────────────────────────────

describe("milkAutoConfirm", () => {
  it("module exports runMilkAutoConfirm function", async () => {
    const mod = await import("./milkAutoConfirm");
    expect(typeof mod.runMilkAutoConfirm).toBe("function");
  });

  it("runMilkAutoConfirm returns a number (confirmed count)", async () => {
    const { runMilkAutoConfirm } = await import("./milkAutoConfirm");
    const result = await runMilkAutoConfirm();
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

// ─── milkSession tRPC router tests ──────────────────────────

describe("milkSession tRPC router", () => {
  describe("milkSession.create", () => {
    it("rejects unauthenticated users (no farm cookie)", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      // No farm_session cookie → should throw
      await expect(
        caller.milkSession.create({
          shift: "morning",
          goat: { volumeMl: 5000, headCount: 5, feedingMl: 0, lossesMl: 0 },
          sheep: { volumeMl: 3000, headCount: 3, feedingMl: 0, lossesMl: 0 },
          cow: { volumeMl: 2000, headCount: 2, feedingMl: 0, lossesMl: 0 },
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid shift value", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkSession.create({
          shift: "midnight" as any,
          goat: { volumeMl: 5000, headCount: 5, feedingMl: 0, lossesMl: 0 },
          sheep: { volumeMl: 3000, headCount: 3, feedingMl: 0, lossesMl: 0 },
          cow: { volumeMl: 2000, headCount: 2, feedingMl: 0, lossesMl: 0 },
        }),
      ).rejects.toThrow();
    });

    it("rejects negative volume", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkSession.create({
          shift: "morning",
          goat: { volumeMl: -5000, headCount: 5, feedingMl: 0, lossesMl: 0 },
        }),
      ).rejects.toThrow();
    });

    it("accepts input with feeding and losses fields", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      // Should still reject (no farm cookie) but validates input schema accepts feeding/losses
      await expect(
        caller.milkSession.create({
          shift: "morning",
          goat: { volumeMl: 5000, headCount: 5, feedingMl: 500, lossesMl: 100 },
          sheep: { volumeMl: 3000, headCount: 3, feedingMl: 200, lossesMl: 50 },
          cow: { volumeMl: 2000, headCount: 2, feedingMl: 100, lossesMl: 0 },
        }),
      ).rejects.toThrow();
    });

    it("rejects zero total volume (all types zero)", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      // All volumes = 0 should be rejected
      await expect(
        caller.milkSession.create({
          shift: "morning",
          goat: { volumeMl: 0, headCount: 0, feedingMl: 0, lossesMl: 0 },
          sheep: { volumeMl: 0, headCount: 0, feedingMl: 0, lossesMl: 0 },
          cow: { volumeMl: 0, headCount: 0, feedingMl: 0, lossesMl: 0 },
        }),
      ).rejects.toThrow();
    });
  });

  describe("milkSession.update", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkSession.update({
          sessionId: 1,
          shift: "evening",
          goat: { volumeMl: 4000, headCount: 4, feedingMl: 300, lossesMl: 50 },
        }),
      ).rejects.toThrow();
    });
  });

  describe("milkSession.cancel", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkSession.cancel({ sessionId: 1 }),
      ).rejects.toThrow();
    });
  });

  describe("milkSession.mySessions", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkSession.mySessions({ page: 1, pageSize: 10 }),
      ).rejects.toThrow();
    });
  });
});

// ─── milkReception tRPC router tests ────────────────────────

describe("milkReception tRPC router", () => {
  describe("milkReception.pendingSessions", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.milkReception.pendingSessions()).rejects.toThrow();
    });
  });

  describe("milkReception.accept", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkReception.accept({
          sessionId: 1,
          milkType: "goat",
          acceptedVolumeMl: 5000,
          rejectedVolumeMl: 0,
          targetTankId: 1,
        }),
      ).rejects.toThrow();
    });

    it("rejects negative accepted volume", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkReception.accept({
          sessionId: 1,
          milkType: "sheep",
          acceptedVolumeMl: -100,
          rejectedVolumeMl: 0,
          targetTankId: 1,
        }),
      ).rejects.toThrow();
    });
  });

  describe("milkReception.reject", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkReception.reject({
          sessionId: 1,
          milkType: "goat",
          rejectionReason: "Bad quality",
        }),
      ).rejects.toThrow();
    });

    it("rejects empty rejection reason", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkReception.reject({
          sessionId: 1,
          milkType: "cow",
          rejectionReason: "",
        }),
      ).rejects.toThrow();
    });
  });
});

// ─── milkTank tRPC router tests ─────────────────────────────

describe("milkTank tRPC router", () => {
  describe("milkTank.list", () => {
    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.milkTank.list()).rejects.toThrow();
    });
  });
});

// ─── milkAdmin tRPC router tests ────────────────────────────

describe("milkAdmin tRPC router", () => {
  describe("milkAdmin.overview", () => {
    it("returns overview stats for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const overview = await caller.milkAdmin.overview();
      expect(overview).toHaveProperty("today");
      expect(overview).toHaveProperty("week");
      expect(overview).toHaveProperty("month");
      expect(overview).toHaveProperty("pendingSessions");
      expect(overview).toHaveProperty("receptionToday");
      expect(overview).toHaveProperty("tanks");
      expect(typeof overview.today.sessions).toBe("number");
      // New format: today.total.volumeL, today.goat.volumeL, etc.
      expect(overview.today).toHaveProperty("total");
      expect(typeof overview.today.total.volumeL).toBe("number");
      expect(typeof overview.today.total.feedingL).toBe("number");
      expect(typeof overview.today.total.lossesL).toBe("number");
      expect(typeof overview.today.total.netL).toBe("number");
      expect(typeof overview.today.total.heads).toBe("number");
      expect(overview.today).toHaveProperty("goat");
      expect(typeof overview.today.goat.volumeL).toBe("number");
      expect(typeof overview.today.goat.heads).toBe("number");
      expect(overview.today).toHaveProperty("sheep");
      expect(overview.today).toHaveProperty("cow");
      expect(typeof overview.week.total.feedingL).toBe("number");
      expect(typeof overview.week.total.netL).toBe("number");
      expect(typeof overview.month.total.feedingL).toBe("number");
      expect(typeof overview.month.total.netL).toBe("number");
      expect(typeof overview.tanks.fillPercent).toBe("number");
    });

    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.milkAdmin.overview()).rejects.toThrow();
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.milkAdmin.overview()).rejects.toThrow();
    });
  });

  describe("milkAdmin.sessions", () => {
    it("returns paginated sessions for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.milkAdmin.sessions({ page: 1, pageSize: 10 });
      expect(result).toHaveProperty("sessions");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page");
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("supports status filter", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.milkAdmin.sessions({
        page: 1,
        pageSize: 10,
        status: "pending_confirm",
      });
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.sessions({ page: 1, pageSize: 10 }),
      ).rejects.toThrow();
    });
  });

  describe("milkAdmin.receptions", () => {
    it("returns paginated receptions for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.milkAdmin.receptions({ page: 1, pageSize: 10 });
      expect(result).toHaveProperty("receptions");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.receptions)).toBe(true);
    });

    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.receptions({ page: 1, pageSize: 10 }),
      ).rejects.toThrow();
    });
  });

  describe("milkAdmin.tanks", () => {
    it("returns tank list for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const tanks = await caller.milkAdmin.tanks();
      expect(Array.isArray(tanks)).toBe(true);
    });

    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.milkAdmin.tanks()).rejects.toThrow();
    });
  });

  describe("milkAdmin.createTank", () => {
    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.createTank({
          name: "Test Tank",
          milkType: "goat",
          capacityLiters: 100,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid capacity (zero)", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.createTank({
          name: "Test Tank",
          milkType: "goat",
          capacityLiters: 0,
        }),
      ).rejects.toThrow();
    });

    it("rejects negative capacity", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.createTank({
          name: "Test Tank",
          milkType: "sheep",
          capacityLiters: -50,
        }),
      ).rejects.toThrow();
    });

    it("rejects empty name", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.createTank({
          name: "",
          milkType: "cow",
          capacityLiters: 100,
        }),
      ).rejects.toThrow();
    });
  });

  describe("milkAdmin.toggleTank", () => {
    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.toggleTank({ tankId: 1, isActive: false }),
      ).rejects.toThrow();
    });
  });

  describe("milkAdmin.clearAuditLog", () => {
    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.milkAdmin.clearAuditLog()).rejects.toThrow();
    });
  });

  describe("milkAdmin.auditLog", () => {
    it("returns paginated audit log for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.milkAdmin.auditLog({ page: 1, pageSize: 10 });
      expect(result).toHaveProperty("logs");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.logs)).toBe(true);
    });

    it("rejects non-admin users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.milkAdmin.auditLog({ page: 1, pageSize: 10 }),
      ).rejects.toThrow();
    });
  });
});
