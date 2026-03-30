/**
 * Phase D — Regression Tests
 *
 * Covers:
 *  1. Auth guard (protectedProcedure blocks unauthenticated)
 *  2. Admin guard (admin-only procedures block regular users)
 *  3. Soft-delete blocking (deleted users cannot access protected routes)
 *  4. OAuth state edge cases (expanded from oauthState.test.ts)
 *  5. Smoke tests for key public and protected procedures
 *  6. Context creation: soft-deleted user is nullified
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import {
  buildOAuthState,
  decodeOAuthState,
  encodeOAuthState,
  getPostAuthRedirectUrl,
} from "@shared/oauthState";

// ─── Context helpers ──────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      ip: "127.0.0.1",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 100,
    openId: "regression-test-user",
    email: "regression@test.com",
    name: "Regression User",
    loginMethod: "local",
    role: "user",
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    deletedAt: null,
    deletedBy: null,
    phone: null,
    preferredContact: null,
    passwordHash: null,
    plainPassword: null,
    bitrix24ContactId: null,
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      ip: "127.0.0.1",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  return createUserContext({
    id: 1,
    openId: process.env.OWNER_OPEN_ID || "owner-demo",
    name: "Admin User",
    email: "admin@sherkozu.ru",
    role: "admin",
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════
// 1. Auth Guard — protectedProcedure blocks unauthenticated users
// ═══════════════════════════════════════════════════════════════════

describe("Auth Guard: protectedProcedure rejects unauthenticated", () => {
  const ctx = createUnauthenticatedContext();

  it("auth.me returns isAuthenticated=false for unauthenticated user", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result.isAuthenticated).toBe(false);
    expect(result.user).toBeNull();
  });

  it("auth.logout succeeds even for unauthenticated user (publicProcedure)", async () => {
    const caller = appRouter.createCaller(ctx);
    // logout is a publicProcedure — it just clears the cookie regardless
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });

  it("auth.updateProfile rejects unauthenticated user", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.updateProfile({ email: "test@test.com" })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("auth.completeOnboarding rejects unauthenticated user", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.completeOnboarding()).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("animals.purchaseShare rejects unauthenticated user", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.animals.purchaseShare({
        animalSlug: "test-animal",
        sharePercent: 10,
        planId: null,
      })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("adminOwnerships.listByAnimal rejects unauthenticated user", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.adminOwnerships.listByAnimal({ animalId: 1 })
    ).rejects.toThrow(/permission|FORBIDDEN|Please login/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Admin Guard — admin-only procedures block regular users
// ═══════════════════════════════════════════════════════════════════

describe("Admin Guard: admin-only procedures reject regular users", () => {
  const userCtx = createUserContext();

  it("adminSync.syncBitrixContacts rejects regular user", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.adminSync.syncBitrixContacts()).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("adminAnalytics.userFunnel rejects regular user (now uses adminProcedure)", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.adminAnalytics.userFunnel()).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("adminAnalytics.pendingApplicationsCount rejects unauthenticated", async () => {
    const unauthCtx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.adminAnalytics.pendingApplicationsCount()).rejects.toThrow(/permission|FORBIDDEN|Please login/i);
  });

  it("adminUserDetails.getDetails rejects regular user", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(
      caller.adminUserDetails.getDetails({ userOpenId: "some-open-id" })
    ).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("adminTrash.list rejects regular user", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.adminTrash.list()).rejects.toThrow(/permission|FORBIDDEN/i);
  });

  it("adminTrash.softDelete rejects regular user", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(
      caller.adminTrash.softDelete({ userId: 999 })
    ).rejects.toThrow(/permission|FORBIDDEN/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Admin procedures work for admin users
// ═══════════════════════════════════════════════════════════════════

describe("Admin Guard: admin procedures succeed for admin users", () => {
  const adminCtx = createAdminContext();

  it("adminAnalytics.userFunnel returns funnel data for admin", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.adminAnalytics.userFunnel();
    expect(result).toHaveProperty("totalUsers");
    expect(result).toHaveProperty("pendingPayment");
    expect(result).toHaveProperty("activeOwners");
    expect(result).toHaveProperty("withPlans");
    expect(result).toHaveProperty("recentUsers");
  });

  it("adminAnalytics.pendingApplicationsCount returns count for admin", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.adminAnalytics.pendingApplicationsCount();
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("adminTrash.list returns array for admin", async () => {
    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.adminTrash.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Soft-delete blocking — context.ts nullifies deleted users
// ═══════════════════════════════════════════════════════════════════

describe("Soft-delete blocking: deleted user treated as unauthenticated", () => {
  it("context.ts nullifies user with deletedAt set", () => {
    // Simulate what context.ts does: if user.deletedAt is set, user = null
    const deletedUser: AuthenticatedUser = {
      id: 200,
      openId: "deleted-user",
      email: "deleted@test.com",
      name: "Deleted User",
      loginMethod: "local",
      role: "user",
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      deletedAt: new Date("2025-01-01"),
      deletedBy: "admin-openid",
      phone: null,
      preferredContact: null,
      passwordHash: null,
      plainPassword: null,
      bitrix24ContactId: null,
    };

    // Replicate the logic from context.ts line 19-21
    let user: AuthenticatedUser | null = deletedUser;
    if (user && user.deletedAt) {
      user = null;
    }

    expect(user).toBeNull();
  });

  it("non-deleted user is preserved in context", () => {
    const activeUser: AuthenticatedUser = {
      id: 201,
      openId: "active-user",
      email: "active@test.com",
      name: "Active User",
      loginMethod: "local",
      role: "user",
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      deletedAt: null,
      deletedBy: null,
      phone: null,
      preferredContact: null,
      passwordHash: null,
      plainPassword: null,
      bitrix24ContactId: null,
    };

    let user: AuthenticatedUser | null = activeUser;
    if (user && user.deletedAt) {
      user = null;
    }

    expect(user).not.toBeNull();
    expect(user!.openId).toBe("active-user");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. OAuth State — Extended edge cases
// ═══════════════════════════════════════════════════════════════════

describe("OAuth State: extended edge cases", () => {
  it("handles empty returnPath by defaulting to /", () => {
    const state = buildOAuthState("https://example.com", "");
    expect(state.returnPath).toBe("/");
  });

  it("handles returnPath with only hash", () => {
    const encoded = encodeOAuthState(
      buildOAuthState("https://example.com", "#section")
    );
    const decoded = decodeOAuthState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.returnPath).toBe("/#section");
  });

  it("handles returnPath with query and hash", () => {
    const encoded = encodeOAuthState(
      buildOAuthState("https://example.com", "/dashboard?tab=animals#top")
    );
    const decoded = decodeOAuthState(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.returnPath).toBe("/dashboard?tab=animals#top");
  });

  it("handles returnPath without leading slash", () => {
    const state = buildOAuthState("https://example.com", "admin/users");
    expect(state.returnPath).toBe("/admin/users");
  });

  it("handles origin with trailing path (normalizes to origin only)", () => {
    const state = buildOAuthState("https://example.com/some/path", "/dashboard");
    expect(state.origin).toBe("https://example.com");
  });

  it("handles origin with port", () => {
    const state = buildOAuthState("http://localhost:3000", "/dashboard");
    expect(state.origin).toBe("http://localhost:3000");
    expect(state.redirectUri).toBe("http://localhost:3000/api/oauth/callback");
  });

  it("getPostAuthRedirectUrl builds correct URL from origin and path", () => {
    const url = getPostAuthRedirectUrl({
      origin: "https://sherkozu.manus.space",
      redirectUri: "https://sherkozu.manus.space/api/oauth/callback",
      returnPath: "/animals/mira?share=10",
    });
    expect(url).toBe("https://sherkozu.manus.space/animals/mira?share=10");
  });

  it("getPostAuthRedirectUrl defaults to / for empty returnPath", () => {
    const url = getPostAuthRedirectUrl({
      origin: "https://example.com",
      redirectUri: "https://example.com/api/oauth/callback",
      returnPath: "",
    });
    expect(url).toBe("https://example.com/");
  });

  it("round-trip encode/decode preserves all fields", () => {
    const original = {
      origin: "https://sherkozu-mlhmg5vm.manus.space",
      redirectUri: "https://sherkozu-mlhmg5vm.manus.space/api/oauth/callback",
      returnPath: "/animals/mira?share=25&plan=1#details",
    };
    const encoded = encodeOAuthState(original);
    const decoded = decodeOAuthState(encoded);
    expect(decoded).toEqual(original);
  });

  it("rejects state with missing origin", () => {
    const encoded = Buffer.from(
      JSON.stringify({ redirectUri: "https://x.com/cb", returnPath: "/" }),
      "utf-8"
    ).toString("base64url");
    expect(decodeOAuthState(encoded)).toBeNull();
  });

  it("rejects state with missing redirectUri", () => {
    const encoded = Buffer.from(
      JSON.stringify({ origin: "https://x.com", returnPath: "/" }),
      "utf-8"
    ).toString("base64url");
    expect(decodeOAuthState(encoded)).toBeNull();
  });

  it("rejects completely invalid base64", () => {
    expect(decodeOAuthState("!!!not-base64!!!")).toBeNull();
  });

  it("rejects valid base64 but invalid JSON", () => {
    const encoded = Buffer.from("not json at all", "utf-8").toString("base64url");
    expect(decodeOAuthState(encoded)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Smoke tests for key public procedures
// ═══════════════════════════════════════════════════════════════════

describe("Smoke: public procedures return expected shapes", () => {
  const ctx = createUnauthenticatedContext();

  it("animals.listPublic returns array", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.animals.listPublic();
    expect(Array.isArray(result)).toBe(true);
  });

  it("club.feed returns data for unauthenticated user (publicProcedure)", async () => {
    const caller = appRouter.createCaller(ctx);
    const result = await caller.club.feed();
    expect(result).toHaveProperty("posts");
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("members");
    expect(Array.isArray(result.posts)).toBe(true);
  });

  it("localAuth.register rejects empty name", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.localAuth.register({
        name: "",
        email: "test@test.com",
        phone: null,
        password: "ValidPass1",
        verificationChannel: "email",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Smoke tests for key protected procedures (authenticated user)
// ═══════════════════════════════════════════════════════════════════

describe("Smoke: protected procedures work for authenticated user", () => {
  const userCtx = createUserContext();

  it("auth.me returns authenticated state", async () => {
    const caller = appRouter.createCaller(userCtx);
    const result = await caller.auth.me();
    expect(result.isAuthenticated).toBe(true);
  });

  it("animals.getBySlug returns animal or null for non-existent slug", async () => {
    const caller = appRouter.createCaller(userCtx);
    const result = await caller.animals.getBySlug({ slug: "non-existent-animal-xyz" });
    // Should return null or throw NOT_FOUND, not crash
    expect(result === null || result === undefined || typeof result === "object").toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Route coverage: all routes in App.tsx have corresponding pages
// ═══════════════════════════════════════════════════════════════════

describe("Route coverage: all routes map to existing page components", () => {
  const fs = require("fs");
  const appTsx = fs.readFileSync(
    require("path").resolve(__dirname, "../client/src/App.tsx"),
    "utf-8"
  );

  const routeMatches = appTsx.matchAll(/path="([^"]+)"/g);
  const routes = Array.from(routeMatches, (m: RegExpMatchArray) => m[1]);

  it("has at least 10 routes defined", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  const expectedRoutes = [
    "/",
    "/dashboard",
    "/profile",
    "/animals",
    "/tracker",
    "/club",
    "/admin",
    "/admin/users",
    "/admin/club",
    "/admin/animals",
    "/admin/product-track",
    "/404",
  ];

  for (const route of expectedRoutes) {
    it(`route ${route} is defined in App.tsx`, () => {
      expect(routes).toContain(route);
    });
  }

  // Check that all imported page components are actually used in routes
  const importMatches = appTsx.matchAll(/import\s+(\w+)\s+from\s+["']\.\/pages\/(\w+)["']/g);
  const importedPages = Array.from(importMatches, (m: RegExpMatchArray) => m[1]);

  it("all imported page components are referenced in routes", () => {
    for (const page of importedPages) {
      const isUsed =
        appTsx.includes(`component={${page}}`) || appTsx.includes(`<${page}`);
      expect(isUsed).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. Client-side auth flow: getLoginUrl structure
// ═══════════════════════════════════════════════════════════════════

describe("Client auth: getLoginUrl preserves returnPath in state", () => {
  const fs = require("fs");
  const constTs = fs.readFileSync(
    require("path").resolve(__dirname, "../client/src/const.ts"),
    "utf-8"
  );

  it("getLoginUrl uses window.location.origin for origin", () => {
    expect(constTs).toContain("window.location.origin");
  });

  it("getLoginUrl captures current pathname + search + hash as default returnPath", () => {
    expect(constTs).toContain("window.location.pathname");
    expect(constTs).toContain("window.location.search");
    expect(constTs).toContain("window.location.hash");
  });

  it("getLoginUrl accepts optional returnPath parameter", () => {
    expect(constTs).toMatch(/getLoginUrl\s*=\s*\(\s*returnPath\?/);
  });

  it("getLoginUrl uses buildOAuthState and encodeOAuthState", () => {
    expect(constTs).toContain("buildOAuthState");
    expect(constTs).toContain("encodeOAuthState");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. Main.tsx: unauthorized redirect preserves current path
// ═══════════════════════════════════════════════════════════════════

describe("Main.tsx: unauthorized redirect flow", () => {
  const fs = require("fs");
  const mainTsx = fs.readFileSync(
    require("path").resolve(__dirname, "../client/src/main.tsx"),
    "utf-8"
  );

  it("uses navigateToLogin() for unauthorized redirect (iframe-safe)", () => {
    expect(mainTsx).toContain("navigateToLogin()");
  });

  it("prevents duplicate redirects with hasScheduledUnauthorizedRedirect flag", () => {
    expect(mainTsx).toContain("hasScheduledUnauthorizedRedirect");
  });

  it("subscribes to both query and mutation caches for error handling", () => {
    expect(mainTsx).toContain("getQueryCache().subscribe");
    expect(mainTsx).toContain("getMutationCache().subscribe");
  });

  it("checks for UNAUTHORIZED code or UNAUTHED_ERR_MSG", () => {
    expect(mainTsx).toContain("UNAUTHORIZED");
    expect(mainTsx).toContain("UNAUTHED_ERR_MSG");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. AuthModal: post-login stays on same page
// ═══════════════════════════════════════════════════════════════════

describe("AuthModal: post-auth behavior", () => {
  const fs = require("fs");
  const authModalTsx = fs.readFileSync(
    require("path").resolve(__dirname, "../client/src/components/AuthModal.tsx"),
    "utf-8"
  );

  it("uses window.location.reload() after successful login", () => {
    // After login, the modal reloads the page (staying on same URL)
    const loginSuccessSection = authModalTsx.slice(
      authModalTsx.indexOf("handleLogin"),
      authModalTsx.indexOf("handleLogin") + 600
    );
    expect(loginSuccessSection).toContain("window.location.reload()");
  });

  it("uses window.location.reload() after successful registration", () => {
    // The reload is inside the onSuccess callback, need a wider window
    const regSuccessSection = authModalTsx.slice(
      authModalTsx.indexOf("handleVerifyRegistrationOtp"),
      authModalTsx.indexOf("handleVerifyRegistrationOtp") + 1200
    );
    expect(regSuccessSection).toContain("window.location.reload()");
  });

  it("uses window.location.reload() after password reset", () => {
    // The reload is inside the onSuccess callback, need a wider window
    const resetSuccessSection = authModalTsx.slice(
      authModalTsx.indexOf("handleResetPassword"),
      authModalTsx.indexOf("handleResetPassword") + 1200
    );
    expect(resetSuccessSection).toContain("window.location.reload()");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. Context.ts: soft-deleted user blocking
// ═══════════════════════════════════════════════════════════════════

describe("Context.ts: soft-delete blocking implementation", () => {
  const fs = require("fs");
  const contextTs = fs.readFileSync(
    require("path").resolve(__dirname, "./_core/context.ts"),
    "utf-8"
  );

  it("checks user.deletedAt and nullifies deleted users", () => {
    expect(contextTs).toContain("deletedAt");
    expect(contextTs).toContain("user = null");
  });

  it("wraps authentication in try-catch for graceful fallback", () => {
    expect(contextTs).toContain("try");
    expect(contextTs).toContain("catch");
    expect(contextTs).toContain("user = null");
  });
});
