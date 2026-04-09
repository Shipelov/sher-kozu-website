import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  recordSiteVisit,
  recordSiteEvent,
  updateVisitTimeOnPage,
  getAnalyticsOverview,
  getPageViewsByDay,
  getTopPages,
  getReferrerBreakdown,
  getDeviceBreakdown,
  getUtmBreakdown,
  getConversionFunnel,
  getEventsSummary,
  getHourlyTraffic,
  getGeoBreakdown,
  getVisitorLocations,
} from "../db";
import { extractClientIp, lookupGeoIp } from "../geoip";
import { withRetry, isTransientDbError } from "../retryUtils";
import { analyticsMonitor } from "../analyticsMonitor";

/* ── Zod schemas ── */

const trackVisitInput = z.object({
  visitorId: z.string().min(1).max(64),
  sessionId: z.string().min(1).max(64),
  userOpenId: z.string().max(64).optional().nullable(),
  pagePath: z.string().min(1).max(512),
  referrer: z.string().max(1024).optional().nullable(),
  utmSource: z.string().max(128).optional().nullable(),
  utmMedium: z.string().max(128).optional().nullable(),
  utmCampaign: z.string().max(256).optional().nullable(),
  deviceType: z.string().max(16).optional().nullable(),
  browser: z.string().max(64).optional().nullable(),
  os: z.string().max(64).optional().nullable(),
  screenWidth: z.number().int().optional().nullable(),
  country: z.string().max(8).optional().nullable(),
  isEntry: z.boolean().default(false),
  isExit: z.boolean().default(false),
});

const trackEventInput = z.object({
  visitorId: z.string().min(1).max(64),
  sessionId: z.string().min(1).max(64),
  userOpenId: z.string().max(64).optional().nullable(),
  category: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  label: z.string().max(256).optional().nullable(),
  value: z.number().int().optional().nullable(),
  pagePath: z.string().max(512).optional().nullable(),
  metadata: z.string().max(5000).optional().nullable(),
});

const updateTimeInput = z.object({
  sessionId: z.string().min(1).max(64),
  pagePath: z.string().min(1).max(512),
  timeOnPage: z.number().int().min(0).max(86400),
});

const dateRangeInput = z.object({
  from: z.string().min(1), // ISO date string
  to: z.string().min(1),   // ISO date string
});

/* ── Router ── */

export const analyticsRouter = router({
  /* ─── Public tracking endpoints (called from client) ─── */

  trackVisit: publicProcedure.input(trackVisitInput).mutation(({ input, ctx }) => {
    // Fire-and-forget: return immediately, process GeoIP + DB insert in background
    // This prevents trackVisit from blocking the tRPC batch (auth.me, animals, etc.)
    const ip = extractClientIp(ctx.req);
    const bgTask = async () => {
      try {
        let geoData: { country?: string | null; city?: string | null; region?: string | null; latitude?: number | null; longitude?: number | null } = {};
        try {
          if (ip) {
            const geo = await lookupGeoIp(ip);
            geoData = {
              country: geo.country || input.country,
              city: geo.city,
              region: geo.region,
              latitude: geo.latitude,
              longitude: geo.longitude,
            };
          }
        } catch {
          // GeoIP enrichment is best-effort
        }
        await withRetry(
          () => recordSiteVisit({ ...input, ...geoData }),
          {
            label: "Analytics/trackVisit",
            maxAttempts: 3,
            baseDelayMs: 500,
            isRetryable: isTransientDbError,
          }
        );
        analyticsMonitor.recordSuccess("trackVisit");
      } catch (err) {
        analyticsMonitor.recordFailure("trackVisit", err);
        console.error("[Analytics] trackVisit failed (silenced):", err instanceof Error ? err.message : err);
      }
    };
    bgTask(); // fire-and-forget — do NOT await
    return { success: true };
  }),

  trackEvent: publicProcedure.input(trackEventInput).mutation(async ({ input }) => {
    try {
      await withRetry(
        () => recordSiteEvent(input),
        {
          label: "Analytics/trackEvent",
          maxAttempts: 3,
          baseDelayMs: 500,
          isRetryable: isTransientDbError,
        }
      );
      analyticsMonitor.recordSuccess("trackEvent");
    } catch (err) {
      analyticsMonitor.recordFailure("trackEvent", err);
      console.error("[Analytics] trackEvent failed (silenced):", err instanceof Error ? err.message : err);
    }
    return { success: true };
  }),

  updateTime: publicProcedure.input(updateTimeInput).mutation(async ({ input }) => {
    try {
      await withRetry(
        () => updateVisitTimeOnPage(input.sessionId, input.pagePath, input.timeOnPage),
        {
          label: "Analytics/updateTime",
          maxAttempts: 3,
          baseDelayMs: 500,
          isRetryable: isTransientDbError,
        }
      );
      analyticsMonitor.recordSuccess("updateTime");
    } catch (err) {
      analyticsMonitor.recordFailure("updateTime", err);
      console.error("[Analytics] updateTime failed (silenced):", err instanceof Error ? err.message : err);
    }
    return { success: true };
  }),

  /* ─── Admin dashboard endpoints ─── */

  overview: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getAnalyticsOverview(from, to);
  }),

  pageViewsByDay: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getPageViewsByDay(from, to);
  }),

  topPages: adminProcedure.input(dateRangeInput.extend({
    limit: z.number().int().min(1).max(100).default(20),
  })).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getTopPages(from, to, input.limit);
  }),

  referrers: adminProcedure.input(dateRangeInput.extend({
    limit: z.number().int().min(1).max(100).default(15),
  })).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getReferrerBreakdown(from, to, input.limit);
  }),

  devices: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getDeviceBreakdown(from, to);
  }),

  utmCampaigns: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getUtmBreakdown(from, to);
  }),

  conversionFunnel: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getConversionFunnel(from, to);
  }),

  events: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getEventsSummary(from, to);
  }),

  hourlyTraffic: adminProcedure.input(dateRangeInput).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getHourlyTraffic(from, to);
  }),

  geoBreakdown: adminProcedure.input(dateRangeInput.extend({
    limit: z.number().int().min(1).max(100).default(30),
  })).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getGeoBreakdown(from, to, input.limit);
  }),

  visitorLocations: adminProcedure.input(dateRangeInput.extend({
    limit: z.number().int().min(1).max(500).default(200),
  })).query(async ({ input }) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    return getVisitorLocations(from, to, input.limit);
  }),

  /**
   * Get analytics pipeline health stats (admin only).
   * Shows success/failure rates for trackVisit, trackEvent, updateTime.
   */
  pipelineHealth: adminProcedure.query(async () => {
    return analyticsMonitor.getStats();
  }),
});
