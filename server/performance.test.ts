import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getGeoIpCacheStats, resetGeoIpCacheStats, lookupGeoIp, extractClientIp } from "./geoip";

/* ─── Helpers ─── */

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-perf-test",
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

/* ─── trackPerformance endpoint ─── */

describe("analytics.trackPerformance", () => {
  it("accepts minimal performance data and returns success", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackPerformance({
      visitorId: "perf-visitor-001",
      sessionId: "perf-session-001",
      pagePath: "/",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts full performance data with all metrics", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackPerformance({
      visitorId: "perf-visitor-002",
      sessionId: "perf-session-002",
      pagePath: "/dashboard",
      dnsMs: 10,
      tcpMs: 20,
      tlsMs: 15,
      ttfbMs: 150,
      downloadMs: 80,
      domInteractiveMs: 500,
      domContentLoadedMs: 600,
      pageLoadMs: 1200,
      fcpMs: 400,
      lcpMs: 900,
      fidMs: 12,
      clsX1000: 50,
      transferSizeBytes: 512000,
      resourceCount: 45,
      deviceType: "desktop",
      connectionType: "4g",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts null optional fields", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.analytics.trackPerformance({
      visitorId: "perf-visitor-003",
      sessionId: "perf-session-003",
      pagePath: "/animals",
      dnsMs: null,
      tcpMs: null,
      pageLoadMs: 2500,
      deviceType: "mobile",
      connectionType: null,
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects invalid pagePath (empty string)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.analytics.trackPerformance({
        visitorId: "perf-visitor-004",
        sessionId: "perf-session-004",
        pagePath: "",
      })
    ).rejects.toThrow();
  });

  it("rejects negative pageLoadMs", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.analytics.trackPerformance({
        visitorId: "perf-visitor-005",
        sessionId: "perf-session-005",
        pagePath: "/test",
        pageLoadMs: -100,
      })
    ).rejects.toThrow();
  });
});

/* ─── Admin performance endpoints ─── */

describe("admin performance endpoints", () => {
  const dateRange = {
    from: new Date(Date.now() - 30 * 86400000).toISOString(),
    to: new Date().toISOString(),
  };

  it("performanceOverview returns expected shape", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.performanceOverview(dateRange);
    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalSamples");
    expect(result).toHaveProperty("avgPageLoad");
    expect(result).toHaveProperty("avgTtfb");
    expect(result).toHaveProperty("slowPages");
  });

  it("performanceByPage returns array", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.performanceByPage({ ...dateRange, limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("performanceTrend returns array", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.performanceTrend(dateRange);
    expect(Array.isArray(result)).toBe(true);
  });

  it("webVitals returns expected shape", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.webVitals(dateRange);
    expect(result).toBeDefined();
    // SUM in TiDB may return string or number depending on data; just check the property exists
    expect(result).toHaveProperty("fcpGood");
    expect(result).toHaveProperty("lcpGood");
    expect(result).toHaveProperty("fidGood");
    expect(result).toHaveProperty("clsGood");
  });

  it("slowPages returns array", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.slowPages({ ...dateRange, limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("performanceByDevice returns array", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.performanceByDevice(dateRange);
    expect(Array.isArray(result)).toBe(true);
  });

  it("geoIpCacheStats returns expected shape", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.analytics.geoIpCacheStats();
    expect(result).toBeDefined();
    expect(typeof result.hits).toBe("number");
    expect(typeof result.misses).toBe("number");
    expect(typeof result.size).toBe("number");
    expect(typeof result.maxSize).toBe("number");
    expect(typeof result.ttlMs).toBe("number");
    expect(typeof result.avgLookupMs).toBe("number");
  });

  it("non-admin cannot access performanceOverview", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.analytics.performanceOverview(dateRange)).rejects.toThrow();
  });
});

/* ─── GeoIP module ─── */

describe("GeoIP module", () => {
  it("getGeoIpCacheStats returns stats object", () => {
    const stats = getGeoIpCacheStats();
    expect(stats).toBeDefined();
    expect(typeof stats.hits).toBe("number");
    expect(typeof stats.misses).toBe("number");
    expect(typeof stats.evictions).toBe("number");
    expect(typeof stats.errors).toBe("number");
    expect(typeof stats.avgLookupMs).toBe("number");
    expect(stats.maxSize).toBe(5000);
    expect(stats.ttlMs).toBe(6 * 60 * 60 * 1000);
  });

  it("resetGeoIpCacheStats resets counters", () => {
    resetGeoIpCacheStats();
    const stats = getGeoIpCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.evictions).toBe(0);
    expect(stats.errors).toBe(0);
  });

  it("lookupGeoIp returns EMPTY for private IPs", async () => {
    const result = await lookupGeoIp("127.0.0.1");
    expect(result.country).toBeNull();
    expect(result.city).toBeNull();
  });

  it("lookupGeoIp returns EMPTY for empty string", async () => {
    const result = await lookupGeoIp("");
    expect(result.country).toBeNull();
  });

  it("extractClientIp handles X-Forwarded-For", () => {
    const ip = extractClientIp({
      headers: { "x-forwarded-for": "203.0.113.50, 70.41.3.18" },
    });
    expect(ip).toBe("203.0.113.50");
  });

  it("extractClientIp returns null for private IPs only", () => {
    const ip = extractClientIp({
      headers: { "x-forwarded-for": "192.168.1.1" },
      socket: { remoteAddress: "10.0.0.1" },
    });
    expect(ip).toBeNull();
  });

  it("GeoIP timeout is 600ms", async () => {
    // Read the source to verify timeout value
    const fs = await import("fs");
    const src = fs.readFileSync("server/geoip.ts", "utf-8");
    expect(src).toContain("600"); // 600ms timeout
    expect(src).not.toContain("3000"); // no longer 3s
    expect(src).not.toContain("1500"); // no longer 1.5s
  });
});
