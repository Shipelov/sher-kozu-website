import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ─── Helpers ─── */

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "regular-user",
      email: "user@example.com",
      name: "User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

/* ─── Public tracking endpoints ─── */

describe("analytics.trackVisit", () => {
  it("records a page visit and returns success", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackVisit({
      visitorId: "test-visitor-001",
      sessionId: "test-session-001",
      pagePath: "/test-page",
      isEntry: true,
      isExit: false,
    });
    expect(result).toEqual({ success: true });
  });

  it("records a visit with full metadata", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackVisit({
      visitorId: "test-visitor-002",
      sessionId: "test-session-002",
      pagePath: "/animals",
      referrer: "https://google.com",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring-promo",
      deviceType: "desktop",
      browser: "Chrome",
      os: "Windows",
      screenWidth: 1920,
      isEntry: true,
      isExit: false,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("analytics.trackEvent", () => {
  it("records a user event and returns success", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackEvent({
      visitorId: "test-visitor-001",
      sessionId: "test-session-001",
      category: "navigation",
      action: "click",
      label: "catalog-button",
    });
    expect(result).toEqual({ success: true });
  });

  it("records an event with numeric value and metadata", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackEvent({
      visitorId: "test-visitor-001",
      sessionId: "test-session-001",
      category: "engagement",
      action: "scroll",
      label: "home-page",
      value: 75,
      pagePath: "/",
      metadata: JSON.stringify({ scrollDepth: "75%" }),
    });
    expect(result).toEqual({ success: true });
  });
});

describe("analytics.updateTime", () => {
  it("updates time on page and returns success", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.updateTime({
      sessionId: "test-session-001",
      pagePath: "/test-page",
      timeOnPage: 45,
    });
    expect(result).toEqual({ success: true });
  });
});

/* ─── Admin dashboard endpoints ─── */

const dateRange = {
  from: new Date(Date.now() - 30 * 86400000).toISOString(),
  to: new Date().toISOString(),
};

describe("analytics.overview (admin)", () => {
  it("returns overview metrics for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.overview(dateRange);
    expect(result).toHaveProperty("pageViews");
    expect(result).toHaveProperty("uniqueVisitors");
    expect(result).toHaveProperty("sessions");
    expect(result).toHaveProperty("avgTimeOnPage");
    expect(result).toHaveProperty("bounceRate");
    expect(typeof result.pageViews).toBe("number");
    expect(typeof result.uniqueVisitors).toBe("number");
    expect(typeof result.sessions).toBe("number");
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.analytics.overview(dateRange)).rejects.toThrow();
  });

  it("rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.analytics.overview(dateRange)).rejects.toThrow();
  });
});

describe("analytics.pageViewsByDay (admin)", () => {
  it("returns daily page view data", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.pageViewsByDay(dateRange);
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("views");
      expect(result[0]).toHaveProperty("visitors");
    }
  });
});

describe("analytics.topPages (admin)", () => {
  it("returns top pages with views and visitors", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.topPages({ ...dateRange, limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("pagePath");
      expect(result[0]).toHaveProperty("views");
      expect(result[0]).toHaveProperty("visitors");
      expect(result[0]).toHaveProperty("avgTime");
    }
  });
});

describe("analytics.referrers (admin)", () => {
  it("returns referrer breakdown", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.referrers({ ...dateRange, limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("referrer");
      expect(result[0]).toHaveProperty("visits");
    }
  });
});

describe("analytics.devices (admin)", () => {
  it("returns device, browser, and OS breakdown", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.devices(dateRange);
    expect(result).toHaveProperty("devices");
    expect(result).toHaveProperty("browsers");
    expect(result).toHaveProperty("os");
    expect(Array.isArray(result.devices)).toBe(true);
    expect(Array.isArray(result.browsers)).toBe(true);
    expect(Array.isArray(result.os)).toBe(true);
  });
});

describe("analytics.utmCampaigns (admin)", () => {
  it("returns UTM campaign breakdown", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.utmCampaigns(dateRange);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("analytics.conversionFunnel (admin)", () => {
  it("returns funnel steps with visitor counts", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.conversionFunnel(dateRange);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("step");
    expect(result[0]).toHaveProperty("visitors");
  });
});

describe("analytics.events (admin)", () => {
  it("returns event summary", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.events(dateRange);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("analytics.hourlyTraffic (admin)", () => {
  it("returns hourly traffic data", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.hourlyTraffic(dateRange);
    expect(Array.isArray(result)).toBe(true);
  });
});
