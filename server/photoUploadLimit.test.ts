import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const ADMIN_OPEN_ID = process.env.OWNER_OPEN_ID || "admin-owner-id";
const USER_OPEN_ID = "regular-user-123";
const USER_NO_SHARES = "user-no-shares-456";

function createContext(openId: string, role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: role === "admin" ? 1 : 2,
    openId,
    email: `${role}@example.com`,
    name: role === "admin" ? "Admin" : "Regular User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Photo Upload Limits", () => {
  const adminCtx = createContext(ADMIN_OPEN_ID, "admin");
  const userCtx = createContext(USER_OPEN_ID, "user");
  const noSharesCtx = createContext(USER_NO_SHARES, "user");
  const adminCaller = appRouter.createCaller(adminCtx);
  const userCaller = appRouter.createCaller(userCtx);
  const noSharesCaller = appRouter.createCaller(noSharesCtx);

  describe("uploadLimit query", () => {
    it("admin gets limit of 1 (cover photo)", async () => {
      const result = await adminCaller.animalPhotos.uploadLimit({ animalSlug: "marta" });
      expect(result).toBeDefined();
      expect(result.isAdmin).toBe(true);
      expect(result.limit).toBe(1);
      expect(typeof result.used).toBe("number");
      expect(typeof result.remaining).toBe("number");
      expect(result.remaining).toBeLessThanOrEqual(1);
    });

    it("user without shares gets limit of 0", async () => {
      const result = await noSharesCaller.animalPhotos.uploadLimit({ animalSlug: "marta" });
      expect(result).toBeDefined();
      expect(result.isAdmin).toBe(false);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it("returns valid structure with used/remaining/limit/isAdmin", async () => {
      const result = await userCaller.animalPhotos.uploadLimit({ animalSlug: "marta" });
      expect(result).toBeDefined();
      expect(typeof result.limit).toBe("number");
      expect(typeof result.used).toBe("number");
      expect(typeof result.remaining).toBe("number");
      expect(typeof result.isAdmin).toBe("boolean");
      expect(result.limit).toBeGreaterThanOrEqual(0);
      expect(result.limit).toBeLessThanOrEqual(10);
      expect(result.used).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      expect(result.remaining).toBeLessThanOrEqual(result.limit);
    });

    it("remaining is never negative", async () => {
      const result = await adminCaller.animalPhotos.uploadLimit({ animalSlug: "marta" });
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("used + remaining equals limit", async () => {
      const result = await adminCaller.animalPhotos.uploadLimit({ animalSlug: "marta" });
      expect(result.used + result.remaining).toBe(result.limit);
    });

    it("handles non-existent animal slug gracefully", async () => {
      const result = await userCaller.animalPhotos.uploadLimit({ animalSlug: "nonexistent-animal-xyz" });
      expect(result).toBeDefined();
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
    });
  });

  describe("upload mutation with limits", () => {
    it("user without shares cannot upload (FORBIDDEN)", async () => {
      try {
        await noSharesCaller.animalPhotos.upload({
          animalSlug: "marta",
          fileName: "test.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          base64Data: btoa("fake-image-data"),
        });
        // If it doesn't throw, the limit check was bypassed (unexpected)
        expect.unreachable("Should have thrown FORBIDDEN");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });
});
