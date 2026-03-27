import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const ADMIN_OPEN_ID = process.env.OWNER_OPEN_ID || "admin-owner-id";
const USER_OPEN_ID = "regular-user-456";

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

describe("Batch Photo Moderation", () => {
  const adminCtx = createContext(ADMIN_OPEN_ID, "admin");
  const userCtx = createContext(USER_OPEN_ID, "user");
  const adminCaller = appRouter.createCaller(adminCtx);
  const userCaller = appRouter.createCaller(userCtx);

  describe("batchModerate", () => {
    it("non-admin cannot batch moderate", async () => {
      try {
        await userCaller.animalPhotos.batchModerate({
          photoIds: [1, 2],
          action: "approve",
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });

    it("admin can call batchModerate with valid input", async () => {
      // Use non-existent IDs — should process but each may fail gracefully
      const result = await adminCaller.animalPhotos.batchModerate({
        photoIds: [999990, 999991, 999992],
        action: "approve",
      });
      expect(result).toHaveProperty("processed");
      expect(result).toHaveProperty("succeeded");
      expect(result).toHaveProperty("results");
      expect(result.processed).toBe(3);
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBe(3);
    });

    it("validates input — photoIds must be non-empty", async () => {
      try {
        await adminCaller.animalPhotos.batchModerate({
          photoIds: [],
          action: "approve",
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("validates input — max 50 photoIds", async () => {
      try {
        const ids = Array.from({ length: 51 }, (_, i) => i + 1);
        await adminCaller.animalPhotos.batchModerate({
          photoIds: ids,
          action: "approve",
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("validates input — action must be approve or reject", async () => {
      try {
        await adminCaller.animalPhotos.batchModerate({
          photoIds: [1],
          action: "invalid" as any,
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("validates input — rejectionReason max 255 chars", async () => {
      try {
        await adminCaller.animalPhotos.batchModerate({
          photoIds: [1],
          action: "reject",
          rejectionReason: "x".repeat(256),
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("batch reject with reason works", async () => {
      const result = await adminCaller.animalPhotos.batchModerate({
        photoIds: [999993],
        action: "reject",
        rejectionReason: "Низкое качество",
      });
      expect(result.processed).toBe(1);
      expect(result.results[0]).toHaveProperty("photoId", 999993);
    });
  });
});

describe("User Notifications", () => {
  const userCtx = createContext(USER_OPEN_ID, "user");
  const userCaller = appRouter.createCaller(userCtx);

  describe("list", () => {
    it("authenticated user can list notifications", async () => {
      const result = await userCaller.notifications.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("unreadCount", () => {
    it("returns a number", async () => {
      const result = await userCaller.notifications.unreadCount();
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("markRead", () => {
    it("validates notificationId must be positive", async () => {
      try {
        await userCaller.notifications.markRead({ notificationId: -1 });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    });

    it("handles non-existent notification gracefully", async () => {
      const result = await userCaller.notifications.markRead({
        notificationId: 999999,
      });
      expect(result).toHaveProperty("success");
    });
  });

  describe("markAllRead", () => {
    it("returns success", async () => {
      const result = await userCaller.notifications.markAllRead();
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    });
  });
});
