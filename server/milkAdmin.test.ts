import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Tests for:
 * 1. milkAdmin.updateSession — admin can update session fields
 * 2. milkAdmin.deleteSession — admin can delete a session
 *
 * These tests call the tRPC router directly with an admin context.
 * They hit the real DB so they are integration tests.
 */

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      email: "admin@test.com",
      name: "Test Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "test-user",
      email: "user@test.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("milkAdmin.updateSession", () => {
  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.milkAdmin.updateSession({
        sessionId: 999999,
        status: "confirmed",
      }),
    ).rejects.toThrow();
  });

  it("returns NOT_FOUND for non-existent session", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.milkAdmin.updateSession({
        sessionId: 999999,
        note: "test",
      }),
    ).rejects.toThrow(/не найдена/);
  });

  it("validates input schema — rejects negative volume", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.milkAdmin.updateSession({
        sessionId: 1,
        goatVolumeMl: -100,
      }),
    ).rejects.toThrow();
  });

  it("validates input schema — rejects volume over max", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.milkAdmin.updateSession({
        sessionId: 1,
        goatVolumeMl: 999999,
      }),
    ).rejects.toThrow();
  });
});

describe("milkAdmin.deleteSession", () => {
  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.milkAdmin.deleteSession({ sessionId: 999999 }),
    ).rejects.toThrow();
  });

  it("returns NOT_FOUND for non-existent session", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.milkAdmin.deleteSession({ sessionId: 999999 }),
    ).rejects.toThrow(/не найдена/);
  });

  it("validates input schema — rejects non-positive sessionId", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.milkAdmin.deleteSession({ sessionId: 0 }),
    ).rejects.toThrow();
  });

  it("validates input schema — rejects negative sessionId", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.milkAdmin.deleteSession({ sessionId: -1 }),
    ).rejects.toThrow();
  });
});
