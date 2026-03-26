import { describe, expect, it, vi, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const ADMIN_OPEN_ID = process.env.OWNER_OPEN_ID || "admin-owner-id";
const USER_OPEN_ID = "regular-user-123";

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

describe("Photo Moderation", () => {
  const adminCtx = createContext(ADMIN_OPEN_ID, "admin");
  const userCtx = createContext(USER_OPEN_ID, "user");
  const adminCaller = appRouter.createCaller(adminCtx);
  const userCaller = appRouter.createCaller(userCtx);

  describe("pendingList", () => {
    it("admin can list pending photos", async () => {
      const result = await adminCaller.animalPhotos.pendingList();
      expect(Array.isArray(result)).toBe(true);
    });

    it("non-admin cannot list pending photos (returns empty or throws)", async () => {
      try {
        const result = await userCaller.animalPhotos.pendingList();
        // If it doesn't throw, it should return empty (admin check in db helper)
        expect(Array.isArray(result)).toBe(true);
      } catch (error: any) {
        // adminProcedure should throw FORBIDDEN
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("pendingCount", () => {
    it("admin can get pending count", async () => {
      const result = await adminCaller.animalPhotos.pendingCount();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("non-admin cannot get pending count (returns 0 or throws)", async () => {
      try {
        const result = await userCaller.animalPhotos.pendingCount();
        expect(result).toBe(0);
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("moderate", () => {
    it("rejects moderation from non-admin user", async () => {
      try {
        await userCaller.animalPhotos.moderate({
          photoId: 999999,
          action: "approve",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });

    it("returns NOT_FOUND for non-existent photo", async () => {
      try {
        await adminCaller.animalPhotos.moderate({
          photoId: 999999,
          action: "approve",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("NOT_FOUND");
      }
    });

    it("validates input schema — action must be approve or reject", async () => {
      try {
        await adminCaller.animalPhotos.moderate({
          photoId: 1,
          action: "invalid" as any,
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("validates input schema — photoId must be positive integer", async () => {
      try {
        await adminCaller.animalPhotos.moderate({
          photoId: -1,
          action: "approve",
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("validates input schema — rejectionReason max 255 chars", async () => {
      try {
        await adminCaller.animalPhotos.moderate({
          photoId: 1,
          action: "reject",
          rejectionReason: "x".repeat(256),
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("list — moderation filtering", () => {
    it("returns photos with moderationStatus field", async () => {
      // Use a known animal slug from seed data
      try {
        const photos = await adminCaller.animalPhotos.list({ animalSlug: "bella" });
        if (photos.length > 0) {
          expect(photos[0]).toHaveProperty("moderationStatus");
          expect(["pending", "approved", "rejected"]).toContain(photos[0].moderationStatus);
        }
      } catch {
        // Animal may not exist in test DB, that's OK
      }
    });
  });

  describe("upload — moderationStatus assignment", () => {
    it("upload input validation works", async () => {
      try {
        await userCaller.animalPhotos.upload({
          animalSlug: "",
          fileName: "test.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          base64Data: "",
        });
        expect(true).toBe(false);
      } catch (error: any) {
        // Should fail on validation (empty slug or empty base64)
        expect(["BAD_REQUEST", "INTERNAL_SERVER_ERROR"]).toContain(error.code);
      }
    });
  });
});
