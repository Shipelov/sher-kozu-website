import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ─── Shared mock helpers ─── */
const mockUser = (overrides: Partial<TrpcContext["user"]> = {}): TrpcContext["user"] => ({
  id: 1,
  openId: "user-pref-1",
  name: "Test User",
  role: "user",
  ...overrides,
});

const createCaller = (user: TrpcContext["user"]) =>
  appRouter.createCaller({ user } as TrpcContext);

/* ─── Tests ─── */
describe("Notification Preferences", () => {
  describe("getPreferences", () => {
    it("returns default preferences (all enabled) for new user", async () => {
      const caller = createCaller(mockUser({ openId: "new-user-prefs-test" }));
      const prefs = await caller.notifications.getPreferences();

      expect(prefs).toEqual({
        photoApproved: true,
        photoRejected: true,
        clubPost: true,
        clubEvent: true,
      });
    });
  });

  describe("updatePreferences", () => {
    it("can disable a single notification type", async () => {
      const caller = createCaller(mockUser({ openId: "update-pref-user-1" }));

      const result = await caller.notifications.updatePreferences({
        clubPost: false,
      });
      expect(result.success).toBe(true);

      const prefs = await caller.notifications.getPreferences();
      expect(prefs.clubPost).toBe(false);
      expect(prefs.clubEvent).toBe(true);
      expect(prefs.photoApproved).toBe(true);
      expect(prefs.photoRejected).toBe(true);
    });

    it("can disable multiple notification types at once", async () => {
      const caller = createCaller(mockUser({ openId: "update-pref-user-2" }));

      await caller.notifications.updatePreferences({
        photoApproved: false,
        clubEvent: false,
      });

      const prefs = await caller.notifications.getPreferences();
      expect(prefs.photoApproved).toBe(false);
      expect(prefs.clubEvent).toBe(false);
      expect(prefs.photoRejected).toBe(true);
      expect(prefs.clubPost).toBe(true);
    });

    it("can re-enable a previously disabled type", async () => {
      const caller = createCaller(mockUser({ openId: "update-pref-user-3" }));

      // Disable first
      await caller.notifications.updatePreferences({ clubPost: false });
      let prefs = await caller.notifications.getPreferences();
      expect(prefs.clubPost).toBe(false);

      // Re-enable
      await caller.notifications.updatePreferences({ clubPost: true });
      prefs = await caller.notifications.getPreferences();
      expect(prefs.clubPost).toBe(true);
    });

    it("preserves other preferences when updating one", async () => {
      const caller = createCaller(mockUser({ openId: "update-pref-user-4" }));

      // Set initial state
      await caller.notifications.updatePreferences({
        photoApproved: false,
        photoRejected: false,
        clubPost: false,
        clubEvent: false,
      });

      // Update only one
      await caller.notifications.updatePreferences({ clubEvent: true });

      const prefs = await caller.notifications.getPreferences();
      expect(prefs.photoApproved).toBe(false);
      expect(prefs.photoRejected).toBe(false);
      expect(prefs.clubPost).toBe(false);
      expect(prefs.clubEvent).toBe(true);
    });
  });

  describe("preferences are user-scoped", () => {
    it("different users have independent preferences", async () => {
      const callerA = createCaller(mockUser({ openId: "scope-user-a" }));
      const callerB = createCaller(mockUser({ openId: "scope-user-b" }));

      await callerA.notifications.updatePreferences({ clubPost: false });
      await callerB.notifications.updatePreferences({ clubEvent: false });

      const prefsA = await callerA.notifications.getPreferences();
      const prefsB = await callerB.notifications.getPreferences();

      expect(prefsA.clubPost).toBe(false);
      expect(prefsA.clubEvent).toBe(true);

      expect(prefsB.clubPost).toBe(true);
      expect(prefsB.clubEvent).toBe(false);
    });
  });
});
