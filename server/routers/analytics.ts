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
} from "../db";

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

  trackVisit: publicProcedure.input(trackVisitInput).mutation(async ({ input }) => {
    await recordSiteVisit(input);
    return { success: true };
  }),

  trackEvent: publicProcedure.input(trackEventInput).mutation(async ({ input }) => {
    await recordSiteEvent(input);
    return { success: true };
  }),

  updateTime: publicProcedure.input(updateTimeInput).mutation(async ({ input }) => {
    await updateVisitTimeOnPage(input.sessionId, input.pagePath, input.timeOnPage);
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
});
