import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Onboarding Flow Tests ──────────────────────────────────────────────────

describe("Visitor → Owner: Onboarding Flow", () => {
  describe("completeUserOnboarding", () => {
    it("should be exported from db module", async () => {
      const db = await import("./db");
      expect(typeof db.completeUserOnboarding).toBe("function");
    });
  });

  describe("getUserFunnelAnalytics", () => {
    it("should be exported from db module", async () => {
      const db = await import("./db");
      expect(typeof db.getUserFunnelAnalytics).toBe("function");
    });

    it("should return correct shape with all funnel fields", async () => {
      const db = await import("./db");
      const result = await db.getUserFunnelAnalytics();
      expect(result).toHaveProperty("totalUsers");
      expect(result).toHaveProperty("pendingPayment");
      expect(result).toHaveProperty("activeOwners");
      expect(result).toHaveProperty("withPlans");
      expect(result).toHaveProperty("recentUsers");
      expect(typeof result.totalUsers).toBe("number");
      expect(typeof result.pendingPayment).toBe("number");
      expect(typeof result.activeOwners).toBe("number");
      expect(typeof result.withPlans).toBe("number");
      expect(Array.isArray(result.recentUsers)).toBe(true);
    });

    it("should return non-negative counts", async () => {
      const db = await import("./db");
      const result = await db.getUserFunnelAnalytics();
      expect(result.totalUsers).toBeGreaterThanOrEqual(0);
      expect(result.pendingPayment).toBeGreaterThanOrEqual(0);
      expect(result.activeOwners).toBeGreaterThanOrEqual(0);
      expect(result.withPlans).toBeGreaterThanOrEqual(0);
    });

    it("recentUsers should have expected fields", async () => {
      const db = await import("./db");
      const result = await db.getUserFunnelAnalytics();
      if (result.recentUsers.length > 0) {
        const user = result.recentUsers[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("openId");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("role");
        expect(user).toHaveProperty("createdAt");
      }
    });
  });

  describe("getPendingApplicationsCount", () => {
    it("should be exported from db module", async () => {
      const db = await import("./db");
      expect(typeof db.getPendingApplicationsCount).toBe("function");
    });

    it("should return a non-negative number", async () => {
      const db = await import("./db");
      const count = await db.getPendingApplicationsCount();
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── Notification Integration Tests ─────────────────────────────────────────

describe("Visitor → Owner: Notification on purchaseShare", () => {
  it("notifyOwner should be importable from notification module", async () => {
    const mod = await import("./_core/notification");
    expect(typeof mod.notifyOwner).toBe("function");
  });
});

// ─── getAnimalNameById Tests ────────────────────────────────────────────────

describe("Visitor → Owner: getAnimalNameById helper", () => {
  it("should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.getAnimalNameById).toBe("function");
  });

  it("should return a fallback name for non-existent animal", async () => {
    const db = await import("./db");
    const name = await db.getAnimalNameById(999999);
    expect(typeof name).toBe("string");
    expect(name!.length).toBeGreaterThan(0);
  });
});

// ─── Ownership Status Flow Tests ────────────────────────────────────────────

describe("Visitor → Owner: Ownership status transitions", () => {
  it("updateOwnershipStatus should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.updateOwnershipStatus).toBe("function");
  });

  it("listAnimalOwnerships should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.listAnimalOwnerships).toBe("function");
  });
});

// ─── Reset Plan Flow Tests ──────────────────────────────────────────────────

describe("Visitor → Owner: Reset plan flow", () => {
  it("resetOwnerProductPlan should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.resetOwnerProductPlan).toBe("function");
  });

  it("deleteDeliverySchedule should be exported from db module", async () => {
    const db = await import("./db");
    expect(typeof db.deleteDeliverySchedule).toBe("function");
  });
});
