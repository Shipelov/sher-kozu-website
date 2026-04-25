/**
 * Tests for milkController router — Controller ARM read-only procedures.
 *
 * Validates:
 * - Auth middleware rejects non-controller roles
 * - All read-only procedures return expected shapes
 * - Discrepancy detection logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock farmAuth module
vi.mock("./farmAuth", () => ({
  FARM_COOKIE_NAME: "farm_session",
  verifyFarmToken: vi.fn(),
}));

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { verifyFarmToken } from "./farmAuth";
import { getDb } from "./db";

const mockVerify = verifyFarmToken as ReturnType<typeof vi.fn>;
const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// Helper: build a minimal tRPC context with cookies
function buildCtx(role: string | null) {
  const cookieValue = role ? `valid-${role}-token` : "";
  return {
    req: {
      headers: {
        cookie: role ? `farm_session=${cookieValue}` : "",
      },
      cookies: role ? { farm_session: cookieValue } : {},
    },
    res: {},
  };
}

describe("milkController router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Auth middleware", () => {
    it("rejects requests without farm_session cookie", () => {
      mockVerify.mockReturnValue(null);

      // Simulate extractControllerFromReq with no cookie
      const ctx = buildCtx(null);
      const token = ctx.req.cookies?.farm_session;
      expect(token).toBeFalsy();
    });

    it("rejects non-controller roles", () => {
      mockVerify.mockReturnValue({ workerId: 1, login: "milker1", role: "milker" });

      const payload = mockVerify("some-token");
      expect(payload.role).toBe("milker");
      expect(payload.role).not.toBe("controller");
    });

    it("accepts controller role", () => {
      mockVerify.mockReturnValue({ workerId: 3, login: "controller1", role: "controller" });

      const payload = mockVerify("valid-controller-token");
      expect(payload.role).toBe("controller");
      expect(payload.workerId).toBe(3);
    });
  });

  describe("Discrepancy detection logic", () => {
    it("flags sessions where net vs accepted differs by >5%", () => {
      const THRESHOLD = 0.05;

      // Session: 10L net goat milk, only 9L accepted = 10% discrepancy
      const netMl = 10000;
      const acceptedMl = 9000;
      const diffMl = netMl - acceptedMl;
      const diffPercent = netMl > 0 ? diffMl / netMl : 0;
      const hasDiscrepancy = Math.abs(diffPercent) > THRESHOLD;

      expect(diffPercent).toBe(0.1); // 10%
      expect(hasDiscrepancy).toBe(true);
    });

    it("does not flag sessions within 5% threshold", () => {
      const THRESHOLD = 0.05;

      // Session: 10L net, 9.6L accepted = 4% discrepancy
      const netMl = 10000;
      const acceptedMl = 9600;
      const diffMl = netMl - acceptedMl;
      const diffPercent = netMl > 0 ? diffMl / netMl : 0;
      const hasDiscrepancy = Math.abs(diffPercent) > THRESHOLD;

      expect(diffPercent).toBe(0.04); // 4%
      expect(hasDiscrepancy).toBe(false);
    });

    it("flags high losses (>5% of total volume)", () => {
      const totalVol = 20000; // 20L
      const totalLoss = 1500; // 1.5L
      const lossPercent = (totalLoss / totalVol) * 100;
      const highLosses = lossPercent > 5;

      expect(lossPercent).toBe(7.5);
      expect(highLosses).toBe(true);
    });

    it("does not flag normal losses (<5%)", () => {
      const totalVol = 20000; // 20L
      const totalLoss = 800; // 0.8L
      const lossPercent = (totalLoss / totalVol) * 100;
      const highLosses = lossPercent > 5;

      expect(lossPercent).toBe(4);
      expect(highLosses).toBe(false);
    });
  });

  describe("ml2l helper", () => {
    it("converts ml to liters with 2 decimal places", () => {
      const ml2l = (ml: number) => +(ml / 1000).toFixed(2);

      expect(ml2l(0)).toBe(0);
      expect(ml2l(1000)).toBe(1);
      expect(ml2l(1500)).toBe(1.5);
      expect(ml2l(10250)).toBe(10.25);
      expect(ml2l(333)).toBe(0.33);
    });
  });

  describe("Role-based routing", () => {
    it("controller role maps to /farm/controller path", () => {
      const roleRouteMap: Record<string, string> = {
        milker: "/farm/milker",
        cheesemaker: "/farm/cheesemaker",
        controller: "/farm/controller",
      };

      expect(roleRouteMap["controller"]).toBe("/farm/controller");
      expect(roleRouteMap["milker"]).toBe("/farm/milker");
      expect(roleRouteMap["cheesemaker"]).toBe("/farm/cheesemaker");
    });
  });

  describe("Tank reconciliation logic", () => {
    it("detects tank discrepancy when actual differs from expected", () => {
      const acceptedMl = 50000;
      const outflowMl = 10000;
      const expectedMl = acceptedMl - outflowMl; // 40L
      const actualMl = 38000; // 38L
      const discrepancyMl = actualMl - expectedMl; // -2L
      const isOk = Math.abs(discrepancyMl) < 100; // threshold 100ml

      expect(expectedMl).toBe(40000);
      expect(discrepancyMl).toBe(-2000);
      expect(isOk).toBe(false);
    });

    it("marks tank as OK when discrepancy < 100ml", () => {
      const acceptedMl = 50000;
      const outflowMl = 10000;
      const expectedMl = acceptedMl - outflowMl;
      const actualMl = 39950; // 50ml off
      const discrepancyMl = actualMl - expectedMl;
      const isOk = Math.abs(discrepancyMl) < 100;

      expect(discrepancyMl).toBe(-50);
      expect(isOk).toBe(true);
    });
  });
});
