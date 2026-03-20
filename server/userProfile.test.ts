import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "profile-test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.updateProfile", () => {
  it("accepts valid email and phone", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      email: "owner@farm.ru",
      phone: "+7 999 123-45-67",
    });

    expect(result).toEqual({ success: true });
  });

  it("accepts null email and phone (clearing contacts)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      email: null,
      phone: null,
    });

    expect(result).toEqual({ success: true });
  });

  it("accepts only email without phone", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      email: "owner@farm.ru",
    });

    expect(result).toEqual({ success: true });
  });

  it("accepts only phone without email", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.updateProfile({
      phone: "+7 999 123-45-67",
    });

    expect(result).toEqual({ success: true });
  });

  it("rejects invalid email format", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.updateProfile({
        email: "not-an-email",
        phone: "+7 999 123-45-67",
      }),
    ).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.updateProfile({
        email: "owner@farm.ru",
        phone: "+7 999 123-45-67",
      }),
    ).rejects.toThrow();
  });
});

describe("auth.me with profile data", () => {
  it("returns user with email and phone fields for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result.isAuthenticated).toBe(true);
    expect(result.user).toBeDefined();
    // The user object should contain email and phone fields (may be null from DB)
    expect(result.user).toHaveProperty("email");
    expect(result.user).toHaveProperty("phone");
  });

  it("returns null user for unauthenticated request", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result.isAuthenticated).toBe(false);
    expect(result.user).toBeNull();
  });
});
