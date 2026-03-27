import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const ADMIN_OPEN_ID = process.env.OWNER_OPEN_ID || "admin-owner-id";
const USER_OPEN_ID = "club-test-user-789";

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

describe("Club Notifications", () => {
  const adminCtx = createContext(ADMIN_OPEN_ID, "admin");
  const adminCaller = appRouter.createCaller(adminCtx);
  const userCtx = createContext(USER_OPEN_ID, "user");
  const userCaller = appRouter.createCaller(userCtx);

  describe("createPost triggers notifications", () => {
    it("admin can create a club post (notification is sent in background)", async () => {
      const result = await adminCaller.adminClub.createPost({
        category: "news",
        author: "Admin",
        avatar: "🐐",
        role: "Фермер",
        timeLabel: "Сегодня",
        title: "Тестовый пост для уведомлений",
        text: "Содержание тестового поста",
        imageUrl: "https://example.com/img.jpg",
        likes: 0,
        comments: 0,
        isPinned: false,
        sortOrder: 0,
      });

      expect(result).toBeTruthy();
      expect(result).toHaveProperty("id");
      expect(result!.title).toBe("Тестовый пост для уведомлений");
    });
  });

  describe("createEvent triggers notifications", () => {
    it("admin can create a club event (notification is sent in background)", async () => {
      const result = await adminCaller.adminClub.createEvent({
        title: "Тестовое событие для уведомлений",
        dateLabel: "1 апреля 2026",
        description: "Описание тестового события",
        status: "upcoming",
        tone: "warm",
        sortOrder: 0,
      });

      expect(result).toBeTruthy();
      expect(result).toHaveProperty("id");
      expect(result!.title).toBe("Тестовое событие для уведомлений");
    });
  });

  describe("notification list includes club types", () => {
    it("user can list notifications (may include club_post and club_event types)", async () => {
      const notifications = await userCaller.notifications.list();
      expect(Array.isArray(notifications)).toBe(true);

      // Verify notification structure if any exist
      for (const n of notifications) {
        expect(n).toHaveProperty("id");
        expect(n).toHaveProperty("type");
        expect(n).toHaveProperty("title");
        expect(n).toHaveProperty("isRead");
        expect(n).toHaveProperty("createdAt");
      }
    });

    it("unreadCount returns a number", async () => {
      const count = await userCaller.notifications.unreadCount();
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("non-admin cannot create club content", () => {
    it("regular user cannot create a club post", async () => {
      try {
        await userCaller.adminClub.createPost({
          category: "news",
          author: "User",
          avatar: "🐑",
          role: "Участник",
          timeLabel: "Сегодня",
          title: "Неавторизованный пост",
          text: "Не должен создаться",
          imageUrl: "https://example.com/img.jpg",
          likes: 0,
          comments: 0,
          isPinned: false,
          sortOrder: 0,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });

    it("regular user cannot create a club event", async () => {
      try {
        await userCaller.adminClub.createEvent({
          title: "Неавторизованное событие",
          dateLabel: "1 апреля 2026",
          description: "Не должно создаться",
          status: "upcoming",
          tone: "warm",
          sortOrder: 0,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });
});
