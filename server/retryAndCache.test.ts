import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, isTransientDbError } from "./retryUtils";
import { TtlCache, cmsCacheKey, CMS_TTL_MS, CMS_CACHE_PREFIX } from "./cache";
import { analyticsMonitor } from "./analyticsMonitor";

/* ═══════════════════════════════════════════════════════════
   Section 1: withRetry utility
   ═══════════════════════════════════════════════════════════ */

describe("withRetry", () => {
  it("should return result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { label: "test", maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on transient error and succeed", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("read ECONNRESET"))
      .mockResolvedValue("recovered");
    const result = await withRetry(fn, {
      label: "test",
      maxAttempts: 3,
      baseDelayMs: 10,
      isRetryable: isTransientDbError,
    });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("read ECONNRESET"));
    await expect(
      withRetry(fn, {
        label: "test",
        maxAttempts: 3,
        baseDelayMs: 10,
        isRetryable: isTransientDbError,
      })
    ).rejects.toThrow("read ECONNRESET");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should NOT retry on non-transient errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Syntax error in SQL"));
    await expect(
      withRetry(fn, {
        label: "test",
        maxAttempts: 3,
        baseDelayMs: 10,
        isRetryable: isTransientDbError,
      })
    ).rejects.toThrow("Syntax error in SQL");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry all attempts if isRetryable is not provided", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("any error"));
    await expect(
      withRetry(fn, { label: "test", maxAttempts: 2, baseDelayMs: 10 })
    ).rejects.toThrow("any error");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should use exponential backoff between retries", async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn: any, delay?: number) => {
      delays.push(delay ?? 0);
      // Execute immediately for test speed
      if (typeof fn === "function") fn();
      return 0 as any;
    });

    const fnMock = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValue("ok");

    await withRetry(fnMock, {
      label: "test",
      maxAttempts: 3,
      baseDelayMs: 100,
      isRetryable: isTransientDbError,
    });

    // First retry delay should be ~100ms, second ~200ms (with jitter)
    expect(delays.length).toBe(2);
    expect(delays[0]).toBeGreaterThanOrEqual(50);
    expect(delays[0]).toBeLessThanOrEqual(200);
    expect(delays[1]).toBeGreaterThanOrEqual(100);
    expect(delays[1]).toBeLessThanOrEqual(400);

    vi.restoreAllMocks();
  });
});

/* ═══════════════════════════════════════════════════════════
   Section 2: isTransientDbError
   ═══════════════════════════════════════════════════════════ */

describe("isTransientDbError", () => {
  it("should detect ECONNRESET", () => {
    expect(isTransientDbError(new Error("read ECONNRESET"))).toBe(true);
  });

  it("should detect ECONNREFUSED", () => {
    expect(isTransientDbError(new Error("connect ECONNREFUSED"))).toBe(true);
  });

  it("should detect ETIMEDOUT", () => {
    expect(isTransientDbError(new Error("connect ETIMEDOUT"))).toBe(true);
  });

  it("should detect connection lost", () => {
    expect(isTransientDbError(new Error("Connection lost: The server closed the connection."))).toBe(true);
  });

  it("should detect Too many connections", () => {
    expect(isTransientDbError(new Error("Too many connections"))).toBe(true);
  });

  it("should detect ER_CON_COUNT_ERROR", () => {
    expect(isTransientDbError(new Error("ER_CON_COUNT_ERROR"))).toBe(true);
  });

  it("should detect socket hang up", () => {
    expect(isTransientDbError(new Error("socket hang up"))).toBe(true);
  });

  it("should NOT detect syntax errors as transient", () => {
    expect(isTransientDbError(new Error("Syntax error near SELECT"))).toBe(false);
  });

  it("should NOT detect null/undefined errors as transient", () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
  });

  it("should detect nested cause errors", () => {
    const cause = new Error("read ECONNRESET");
    const wrapper = new Error("DrizzleQueryError: Failed query");
    (wrapper as any).cause = cause;
    expect(isTransientDbError(wrapper)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════
   Section 3: TtlCache
   ═══════════════════════════════════════════════════════════ */

describe("TtlCache", () => {
  let cache: TtlCache;

  beforeEach(() => {
    cache = new TtlCache();
  });

  it("should store and retrieve values", () => {
    cache.set("key1", "value1", 60000);
    expect(cache.get("key1")).toBe("value1");
  });

  it("should return null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should expire entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "value1", 1000);
    expect(cache.get("key1")).toBe("value1");

    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeNull();
    vi.useRealTimers();
  });

  it("should invalidate specific keys", () => {
    cache.set("key1", "value1", 60000);
    cache.set("key2", "value2", 60000);
    cache.invalidate("key1");
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBe("value2");
  });

  it("should invalidate by prefix", () => {
    cache.set("cms:page:home:visible", "data1", 60000);
    cache.set("cms:page:about:visible", "data2", 60000);
    cache.set("catalog:animals", "data3", 60000);
    cache.invalidatePrefix("cms:page:");
    expect(cache.get("cms:page:home:visible")).toBeNull();
    expect(cache.get("cms:page:about:visible")).toBeNull();
    expect(cache.get("catalog:animals")).toBe("data3");
  });

  it("should clear all entries", () => {
    cache.set("key1", "v1", 60000);
    cache.set("key2", "v2", 60000);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("should report correct size", () => {
    expect(cache.size()).toBe(0);
    cache.set("a", 1, 60000);
    cache.set("b", 2, 60000);
    expect(cache.size()).toBe(2);
  });
});

/* ═══════════════════════════════════════════════════════════
   Section 4: CMS cache key helpers
   ═══════════════════════════════════════════════════════════ */

describe("CMS cache helpers", () => {
  it("should generate correct cache keys for visible-only", () => {
    expect(cmsCacheKey("home", false)).toBe("cms:page:home:visible");
  });

  it("should generate correct cache keys for all blocks", () => {
    expect(cmsCacheKey("home", true)).toBe("cms:page:home:all");
  });

  it("should use 5-minute TTL", () => {
    expect(CMS_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("should have correct prefix", () => {
    expect(CMS_CACHE_PREFIX).toBe("cms:page:");
  });
});

/* ═══════════════════════════════════════════════════════════
   Section 5: AnalyticsMonitor
   ═══════════════════════════════════════════════════════════ */

describe("AnalyticsMonitor", () => {
  beforeEach(() => {
    analyticsMonitor.reset();
  });

  afterEach(() => {
    analyticsMonitor.stopReporting();
  });

  it("should record successes", () => {
    analyticsMonitor.recordSuccess("trackVisit");
    analyticsMonitor.recordSuccess("trackVisit");
    analyticsMonitor.recordSuccess("trackEvent");

    const stats = analyticsMonitor.getStats();
    expect(stats.trackVisit.success).toBe(2);
    expect(stats.trackVisit.failure).toBe(0);
    expect(stats.trackVisit.successRate).toBe("100.0%");
    expect(stats.trackEvent.success).toBe(1);
  });

  it("should record failures with error messages", () => {
    analyticsMonitor.recordFailure("trackVisit", new Error("ECONNRESET"));
    analyticsMonitor.recordFailure("trackVisit", new Error("timeout"));

    const stats = analyticsMonitor.getStats();
    expect(stats.trackVisit.failure).toBe(2);
    expect(stats.trackVisit.lastError).toBe("timeout");
    expect(stats.trackVisit.lastFailureAt).toBeGreaterThan(0);
  });

  it("should calculate correct success rate", () => {
    analyticsMonitor.recordSuccess("trackVisit");
    analyticsMonitor.recordSuccess("trackVisit");
    analyticsMonitor.recordSuccess("trackVisit");
    analyticsMonitor.recordFailure("trackVisit", new Error("err"));

    const stats = analyticsMonitor.getStats();
    expect(stats.trackVisit.successRate).toBe("75.0%");
  });

  it("should return N/A for operations with no data", () => {
    const stats = analyticsMonitor.getStats();
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it("should reset all counters", () => {
    analyticsMonitor.recordSuccess("trackVisit");
    analyticsMonitor.recordFailure("trackEvent", new Error("err"));
    analyticsMonitor.reset();

    const stats = analyticsMonitor.getStats();
    expect(Object.keys(stats)).toHaveLength(0);
  });

  it("should handle non-Error failure values", () => {
    analyticsMonitor.recordFailure("trackVisit", "string error");
    analyticsMonitor.recordFailure("trackEvent", 42);
    analyticsMonitor.recordFailure("updateTime", null);

    const stats = analyticsMonitor.getStats();
    expect(stats.trackVisit.lastError).toBe("string error");
    expect(stats.trackEvent.lastError).toBe("42");
    expect(stats.updateTime.lastError).toBe("null");
  });

  it("should start and stop reporting without errors", () => {
    expect(() => analyticsMonitor.startReporting()).not.toThrow();
    expect(() => analyticsMonitor.startReporting()).not.toThrow(); // idempotent
    expect(() => analyticsMonitor.stopReporting()).not.toThrow();
  });
});
