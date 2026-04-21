/**
 * Tests for Farm Worker Authentication Module.
 *
 * Tests the farmAuth tRPC router (login, logout, me, changePassword)
 * and the underlying auth utilities (hash, verify, JWT).
 */

import { describe, expect, it } from "vitest";
import {
  hashFarmPassword,
  verifyFarmPassword,
  validateFarmPasswordStrength,
  signFarmToken,
  verifyFarmToken,
  FARM_COOKIE_NAME,
} from "./farmAuth";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Unit tests for auth utilities ───────────────────────────

describe("farmAuth utilities", () => {
  describe("hashFarmPassword / verifyFarmPassword", () => {
    it("hashes and verifies a password correctly", async () => {
      const plain = "testPass123";
      const hash = await hashFarmPassword(plain);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(plain);
      expect(await verifyFarmPassword(plain, hash)).toBe(true);
      expect(await verifyFarmPassword("wrongPass", hash)).toBe(false);
    });

    it("produces different hashes for the same password (salt)", async () => {
      const plain = "samePassword";
      const hash1 = await hashFarmPassword(plain);
      const hash2 = await hashFarmPassword(plain);
      expect(hash1).not.toBe(hash2);
      // Both should still verify
      expect(await verifyFarmPassword(plain, hash1)).toBe(true);
      expect(await verifyFarmPassword(plain, hash2)).toBe(true);
    });
  });

  describe("validateFarmPasswordStrength", () => {
    it("rejects passwords shorter than 6 characters", () => {
      const result = validateFarmPasswordStrength("12345");
      expect(result.valid).toBe(false);
      expect(result.message).toContain("6");
    });

    it("accepts passwords with 6+ characters", () => {
      expect(validateFarmPasswordStrength("123456").valid).toBe(true);
      expect(validateFarmPasswordStrength("abcdef").valid).toBe(true);
      expect(validateFarmPasswordStrength("a1b2c3").valid).toBe(true);
    });
  });

  describe("signFarmToken / verifyFarmToken", () => {
    it("signs and verifies a JWT token", () => {
      const mockWorker = {
        id: 42,
        login: "ivan",
        name: "Иван",
        role: "milker" as const,
        passwordHash: "xxx",
        mustChangePassword: false,
        isActive: true,
        telegramChatId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const token = signFarmToken(mockWorker);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const payload = verifyFarmToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.workerId).toBe(42);
      expect(payload!.login).toBe("ivan");
      expect(payload!.role).toBe("milker");
    });

    it("returns null for invalid tokens", () => {
      expect(verifyFarmToken("invalid.token.here")).toBeNull();
      expect(verifyFarmToken("")).toBeNull();
    });
  });
});

// ─── tRPC router integration tests ──────────────────────────

describe("farmAuth tRPC router", () => {
  // Helper to create a public context (no user) with cookie tracking
  function createFarmContext() {
    const setCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
        cookies: {},
      } as any,
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => {
          setCookies.push({ name, value, options });
        },
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as any,
    };

    return { ctx, setCookies, clearedCookies };
  }

  describe("farmAuth.me", () => {
    it("returns null when no farm_session cookie is present", async () => {
      const { ctx } = createFarmContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.farmAuth.me();
      expect(result).toBeNull();
    });
  });

  describe("farmAuth.logout", () => {
    it("clears the farm_session cookie", async () => {
      const { ctx, clearedCookies } = createFarmContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.farmAuth.logout();
      expect(result).toEqual({ success: true });
      expect(clearedCookies).toHaveLength(1);
      expect(clearedCookies[0]?.name).toBe(FARM_COOKIE_NAME);
    });
  });

  describe("farmAuth.login", () => {
    it("rejects login with empty credentials", async () => {
      const { ctx } = createFarmContext();
      const caller = appRouter.createCaller(ctx);

      // Empty login should fail zod validation (min 1)
      await expect(
        caller.farmAuth.login({ login: "", password: "test" }),
      ).rejects.toThrow();
    });

    it("rejects login with non-existent user", async () => {
      const { ctx } = createFarmContext();
      const caller = appRouter.createCaller(ctx);

      // This will fail because the user doesn't exist in DB
      await expect(
        caller.farmAuth.login({
          login: "nonexistent_user_xyz_12345",
          password: "somepassword",
        }),
      ).rejects.toThrow();
    });
  });

  describe("farmAuth.changePassword", () => {
    it("rejects password change when not authenticated", async () => {
      const { ctx } = createFarmContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.farmAuth.changePassword({
          currentPassword: "old",
          newPassword: "newpass123",
        }),
      ).rejects.toThrow("Необходимо войти в систему");
    });

    it("rejects new password shorter than 6 characters", async () => {
      const { ctx } = createFarmContext();
      const caller = appRouter.createCaller(ctx);

      // Zod validation should reject short password
      await expect(
        caller.farmAuth.changePassword({
          currentPassword: "old",
          newPassword: "12345",
        }),
      ).rejects.toThrow();
    });
  });
});

// ─── farmAdmin router tests (requires admin context) ─────────

describe("farmAdmin tRPC router", () => {
  function createAdminContext() {
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "admin-user",
        email: "admin@farm.test",
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
      } as any,
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as any,
    };
    return ctx;
  }

  function createNonAdminContext() {
    const ctx: TrpcContext = {
      user: {
        id: 2,
        openId: "regular-user",
        email: "user@farm.test",
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
      } as any,
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as any,
    };
    return ctx;
  }

  describe("farmAdmin.listWorkers", () => {
    it("returns a list of workers for admin", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      const workers = await caller.farmAdmin.listWorkers();
      expect(Array.isArray(workers)).toBe(true);
    });

    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.farmAdmin.listWorkers()).rejects.toThrow();
    });
  });

  describe("farmAdmin.createWorker", () => {
    it("rejects non-admin users", async () => {
      const ctx = createNonAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.farmAdmin.createWorker({
          login: "testworker",
          name: "Test Worker",
          password: "testpass123",
          role: "milker",
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid role", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.farmAdmin.createWorker({
          login: "testworker",
          name: "Test Worker",
          password: "testpass123",
          role: "invalid_role" as any,
        }),
      ).rejects.toThrow();
    });
  });
});
