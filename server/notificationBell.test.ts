import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createUserNotification } from "./db";

/* ─── Shared mock helpers ─── */
const mockUser = (overrides: Partial<TrpcContext["user"]> = {}): TrpcContext["user"] => ({
  id: 1,
  openId: "bell-test-user-1",
  name: "Bell Test User",
  role: "user",
  ...overrides,
});

const createCaller = (user: TrpcContext["user"]) =>
  appRouter.createCaller({ user } as TrpcContext);

/* ─── Tests ─── */
describe("Notification Bell — Owner Integration", () => {

  describe("unreadCount", () => {
    it("returns 0 for a user with no notifications", async () => {
      const caller = createCaller(mockUser({ openId: "bell-empty-user" }));
      const count = await caller.notifications.unreadCount();
      expect(count).toBe(0);
    });

    it("returns correct unread count after creating notifications", async () => {
      const openId = "bell-count-user-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      // Create 3 notifications
      await createUserNotification({
        userOpenId: openId,
        type: "delivery_status",
        title: "Доставка готова",
        body: "Ваша доставка за апрель готова",
        link: "/tracker?animal=mira",
      });
      await createUserNotification({
        userOpenId: openId,
        type: "productPlanUpdate",
        title: "План подтверждён",
        body: "Ваш план подтверждён администратором",
        link: "/tracker?animal=mira",
      });
      await createUserNotification({
        userOpenId: openId,
        type: "composition_update",
        title: "Состав молока обновлён",
        body: "Жирность: 4.8%",
        link: "/animals/mira",
      });

      const count = await caller.notifications.unreadCount();
      expect(count).toBe(3);
    });
  });

  describe("list", () => {
    it("returns empty list for user with no notifications", async () => {
      const caller = createCaller(mockUser({ openId: "bell-list-empty" }));
      const list = await caller.notifications.list();
      expect(list).toEqual([]);
    });

    it("returns notifications in reverse chronological order", async () => {
      const openId = "bell-list-order-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      await createUserNotification({
        userOpenId: openId,
        type: "delivery_status",
        title: "Доставка 1",
        body: "Первая",
        link: "/tracker",
      });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 50));
      await createUserNotification({
        userOpenId: openId,
        type: "productPlanUpdate",
        title: "План 2",
        body: "Вторая",
        link: "/tracker",
      });

      const list = await caller.notifications.list();
      expect(list.length).toBe(2);
      // Most recent first
      expect(list[0].title).toBe("План 2");
      expect(list[1].title).toBe("Доставка 1");
    });

    it("returns notifications with correct fields", async () => {
      const openId = "bell-list-fields-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      await createUserNotification({
        userOpenId: openId,
        type: "metrics_update",
        title: "Метрики обновлены",
        body: "Надой: 85 л",
        link: "/animals/mira",
      });

      const list = await caller.notifications.list();
      expect(list.length).toBe(1);
      const n = list[0];
      expect(n.type).toBe("metrics_update");
      expect(n.title).toBe("Метрики обновлены");
      expect(n.body).toBe("Надой: 85 л");
      expect(n.link).toBe("/animals/mira");
      expect(n.isRead).toBe(false);
      expect(n.createdAt).toBeDefined();
    });
  });

  describe("markRead", () => {
    it("marks a single notification as read", async () => {
      const openId = "bell-markread-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      await createUserNotification({
        userOpenId: openId,
        type: "delivery_status",
        title: "Доставка выполнена",
        body: "Доставка за март доставлена",
        link: "/tracker",
      });

      const list = await caller.notifications.list();
      expect(list[0].isRead).toBe(false);

      const result = await caller.notifications.markRead({ notificationId: list[0].id });
      expect(result.success).toBe(true);

      const updatedList = await caller.notifications.list();
      expect(updatedList[0].isRead).toBe(true);

      const count = await caller.notifications.unreadCount();
      expect(count).toBe(0);
    });
  });

  describe("markAllRead", () => {
    it("marks all notifications as read at once", async () => {
      const openId = "bell-markallread-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      await createUserNotification({
        userOpenId: openId,
        type: "delivery_status",
        title: "Доставка 1",
        body: "Тело",
        link: "/tracker",
      });
      await createUserNotification({
        userOpenId: openId,
        type: "club_event",
        title: "Событие клуба",
        body: "Тело",
        link: "/club",
      });
      await createUserNotification({
        userOpenId: openId,
        type: "composition_update",
        title: "Состав обновлён",
        body: "Тело",
        link: "/animals/mira",
      });

      let count = await caller.notifications.unreadCount();
      expect(count).toBe(3);

      const result = await caller.notifications.markAllRead();
      expect(result.success).toBe(true);

      count = await caller.notifications.unreadCount();
      expect(count).toBe(0);

      const list = await caller.notifications.list();
      expect(list.every((n: any) => n.isRead === true)).toBe(true);
    });
  });

  describe("notification types coverage", () => {
    it("supports all notification types used by the system", async () => {
      const openId = "bell-types-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      const types = [
        { type: "delivery_status", title: "Доставка", body: "Тест" },
        { type: "productPlanUpdate", title: "План", body: "Тест" },
        { type: "composition_update", title: "Состав", body: "Тест" },
        { type: "metrics_update", title: "Метрики", body: "Тест" },
        { type: "photo_approved", title: "Фото одобрено", body: "Тест" },
        { type: "photo_rejected", title: "Фото отклонено", body: "Тест" },
        { type: "club_post", title: "Пост клуба", body: "Тест" },
        { type: "club_event", title: "Событие клуба", body: "Тест" },
      ];

      for (const t of types) {
        await createUserNotification({
          userOpenId: openId,
          type: t.type,
          title: t.title,
          body: t.body,
          link: "/test",
        });
      }

      const list = await caller.notifications.list();
      expect(list.length).toBe(types.length);

      const returnedTypes = list.map((n: any) => n.type).sort();
      const expectedTypes = types.map(t => t.type).sort();
      expect(returnedTypes).toEqual(expectedTypes);
    });
  });

  describe("user isolation", () => {
    it("notifications are scoped to the user who received them", async () => {
      const openIdA = "bell-isolation-a-" + Date.now();
      const openIdB = "bell-isolation-b-" + Date.now();
      const callerA = createCaller(mockUser({ openId: openIdA }));
      const callerB = createCaller(mockUser({ openId: openIdB }));

      await createUserNotification({
        userOpenId: openIdA,
        type: "delivery_status",
        title: "Для пользователя A",
        body: "Тест",
        link: "/tracker",
      });
      await createUserNotification({
        userOpenId: openIdB,
        type: "club_post",
        title: "Для пользователя B",
        body: "Тест",
        link: "/club",
      });

      const listA = await callerA.notifications.list();
      const listB = await callerB.notifications.list();

      expect(listA.length).toBe(1);
      expect(listA[0].title).toBe("Для пользователя A");
      expect(listA[0].type).toBe("delivery_status");

      expect(listB.length).toBe(1);
      expect(listB[0].title).toBe("Для пользователя B");
      expect(listB[0].type).toBe("club_post");
    });
  });

  describe("deliveryStatus notification preference", () => {
    it("deliveryStatus preference defaults to true", async () => {
      const caller = createCaller(mockUser({ openId: "bell-pref-default-" + Date.now() }));
      const prefs = await caller.notifications.getPreferences();
      expect(prefs.deliveryStatus).toBe(true);
    });

    it("can disable deliveryStatus notifications", async () => {
      const openId = "bell-pref-disable-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      await caller.notifications.updatePreferences({ deliveryStatus: false });
      const prefs = await caller.notifications.getPreferences();
      expect(prefs.deliveryStatus).toBe(false);
    });

    it("can re-enable deliveryStatus notifications", async () => {
      const openId = "bell-pref-reenable-" + Date.now();
      const caller = createCaller(mockUser({ openId }));

      await caller.notifications.updatePreferences({ deliveryStatus: false });
      await caller.notifications.updatePreferences({ deliveryStatus: true });
      const prefs = await caller.notifications.getPreferences();
      expect(prefs.deliveryStatus).toBe(true);
    });
  });
});
