/**
 * Tests for analytics error silencing.
 *
 * Verifies that analytics tracking procedures (trackVisit, trackEvent, updateTime)
 * always return { success: true } even when the underlying DB operation fails,
 * so errors never surface in the user's browser console.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const analyticsRouterSrc = readFileSync(
  resolve(__dirname, "routers/analytics.ts"),
  "utf-8",
);

const useAnalyticsSrc = readFileSync(
  resolve(__dirname, "../client/src/hooks/useAnalytics.ts"),
  "utf-8",
);

const mainTsxSrc = readFileSync(
  resolve(__dirname, "../client/src/main.tsx"),
  "utf-8",
);

describe("Analytics error silencing", () => {
  describe("Server-side: analytics router procedures", () => {
    it("trackVisit wraps DB insert in try/catch and always returns success", () => {
      // The outer try/catch should wrap the recordSiteVisit call
      expect(analyticsRouterSrc).toContain("try {");
      expect(analyticsRouterSrc).toContain(
        '[Analytics] trackVisit failed (silenced):',
      );
      // Verify it still returns success after the catch
      const trackVisitBlock = analyticsRouterSrc.slice(
        analyticsRouterSrc.indexOf("trackVisit:"),
        analyticsRouterSrc.indexOf("trackEvent:"),
      );
      expect(trackVisitBlock).toContain("return { success: true }");
      expect(trackVisitBlock).toContain("catch (err)");
    });

    it("trackEvent wraps DB insert in try/catch and always returns success", () => {
      expect(analyticsRouterSrc).toContain(
        '[Analytics] trackEvent failed (silenced):',
      );
      const trackEventBlock = analyticsRouterSrc.slice(
        analyticsRouterSrc.indexOf("trackEvent:"),
        analyticsRouterSrc.indexOf("updateTime:"),
      );
      expect(trackEventBlock).toContain("return { success: true }");
      expect(trackEventBlock).toContain("catch (err)");
    });

    it("updateTime wraps DB update in try/catch and always returns success", () => {
      expect(analyticsRouterSrc).toContain(
        '[Analytics] updateTime failed (silenced):',
      );
      const updateTimeBlock = analyticsRouterSrc.slice(
        analyticsRouterSrc.indexOf("updateTime:"),
        analyticsRouterSrc.indexOf("/* ─── Admin"),
      );
      expect(updateTimeBlock).toContain("return { success: true }");
      expect(updateTimeBlock).toContain("catch (err)");
    });

    it("logs errors server-side with console.error for debugging", () => {
      expect(analyticsRouterSrc).toContain("console.error");
      // All four procedures should have server-side logging (trackVisit, trackEvent, updateTime, trackPerformance)
      const errorLogs = analyticsRouterSrc.match(
        /console\.error\("\[Analytics\]/g,
      );
      expect(errorLogs).not.toBeNull();
      expect(errorLogs!.length).toBe(4);
    });
  });

  describe("Client-side: useAnalytics hook", () => {
    it("all three mutations have onError handlers to suppress errors", () => {
      // trackVisit mutation
      expect(useAnalyticsSrc).toContain(
        "trpc.analytics.trackVisit.useMutation({",
      );
      expect(useAnalyticsSrc).toContain(
        "trpc.analytics.trackEvent.useMutation({",
      );
      expect(useAnalyticsSrc).toContain(
        "trpc.analytics.updateTime.useMutation({",
      );

      // All should have onError handlers
      const onErrorCount = (useAnalyticsSrc.match(/onError:/g) || []).length;
      expect(onErrorCount).toBeGreaterThanOrEqual(3);
    });

    it("onError handlers are empty (silent suppression)", () => {
      // The onError should be a no-op function, not re-throwing
      expect(useAnalyticsSrc).toContain(
        "Analytics is best-effort, suppress errors silently",
      );
    });
  });

  describe("Client-side: global mutation error handler in main.tsx", () => {
    it("filters out analytics mutations from global error logging", () => {
      expect(mainTsxSrc).toContain("analytics.");
      expect(mainTsxSrc).toContain("isAnalytics");
      expect(mainTsxSrc).toContain("if (isAnalytics) return");
    });

    it("still logs non-analytics mutation errors", () => {
      // The console.error for non-analytics mutations should still be present
      expect(mainTsxSrc).toContain('[API Mutation Error]');
    });
  });
});
