import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ── Test helpers ── */

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-test",
    email: "admin@test.com",
    name: "Admin Test",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": "8.8.8.8" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": "8.8.8.8" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

/* ═══════════════════════════════════════════════════════════════
   GeoIP Module Tests
   ═══════════════════════════════════════════════════════════════ */

describe("GeoIP utility", () => {
  it("extractClientIp returns IP from x-forwarded-for", async () => {
    const { extractClientIp } = await import("./geoip");
    const ip = extractClientIp({
      headers: { "x-forwarded-for": "203.0.113.50, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    expect(ip).toBe("203.0.113.50");
  });

  it("extractClientIp returns null for private IPs only", async () => {
    const { extractClientIp } = await import("./geoip");
    const ip = extractClientIp({
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    });
    expect(ip).toBeNull();
  });

  it("extractClientIp returns x-real-ip when x-forwarded-for is absent", async () => {
    const { extractClientIp } = await import("./geoip");
    const ip = extractClientIp({
      headers: { "x-real-ip": "198.51.100.10" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    expect(ip).toBe("198.51.100.10");
  });

  it("lookupGeoIp returns empty for private IPs", async () => {
    const { lookupGeoIp } = await import("./geoip");
    const result = await lookupGeoIp("192.168.1.1");
    expect(result.country).toBeNull();
    expect(result.city).toBeNull();
    expect(result.latitude).toBeNull();
  });

  it("lookupGeoIp returns empty for empty string", async () => {
    const { lookupGeoIp } = await import("./geoip");
    const result = await lookupGeoIp("");
    expect(result.country).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Analytics Alerts Router Tests
   ═══════════════════════════════════════════════════════════════ */

describe("analyticsAlerts router", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);

  it("listRules returns an array", async () => {
    const rules = await adminCaller.analyticsAlerts.listRules();
    expect(Array.isArray(rules)).toBe(true);
  });

  it("createRule creates a new alert rule", async () => {
    const result = await adminCaller.analyticsAlerts.createRule({
      name: "Test Alert - High Traffic",
      metric: "page_views",
      operator: "gt",
      threshold: 1000,
      windowHours: 24,
      enabled: true,
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("updateRule toggles enabled status", async () => {
    // Create a rule first
    const { id } = await adminCaller.analyticsAlerts.createRule({
      name: "Test Alert - Toggle",
      metric: "sessions",
      operator: "lt",
      threshold: 10,
      windowHours: 12,
      enabled: true,
    });

    // Update it
    const result = await adminCaller.analyticsAlerts.updateRule({
      id,
      enabled: false,
    });
    expect(result.success).toBe(true);

    // Verify it's disabled
    const rules = await adminCaller.analyticsAlerts.listRules();
    const updated = rules.find((r: { id: number }) => r.id === id);
    expect(updated?.enabled).toBe(false);
  });

  it("deleteRule removes a rule", async () => {
    const { id } = await adminCaller.analyticsAlerts.createRule({
      name: "Test Alert - Delete",
      metric: "bounce_rate",
      operator: "change_pct_up",
      threshold: 50,
      windowHours: 24,
      enabled: true,
    });

    const result = await adminCaller.analyticsAlerts.deleteRule({ id });
    expect(result.success).toBe(true);

    const rules = await adminCaller.analyticsAlerts.listRules();
    const found = rules.find((r: { id: number }) => r.id === id);
    expect(found).toBeUndefined();
  });

  it("history returns an array", async () => {
    const history = await adminCaller.analyticsAlerts.history({ limit: 10 });
    expect(Array.isArray(history)).toBe(true);
  });

  it("checkNow runs anomaly check and returns results", async () => {
    const result = await adminCaller.analyticsAlerts.checkNow();
    expect(result).toHaveProperty("checked");
    expect(result).toHaveProperty("triggered");
    expect(typeof result.checked).toBe("number");
    expect(typeof result.triggered).toBe("number");
  });
});

/* ═══════════════════════════════════════════════════════════════
   A/B Experiments Router Tests
   ═══════════════════════════════════════════════════════════════ */

describe("abExperiments router", () => {
  const adminCtx = createAdminContext();
  const adminCaller = appRouter.createCaller(adminCtx);
  const publicCaller = appRouter.createCaller(createPublicContext());

  it("list returns an array", async () => {
    const experiments = await adminCaller.abExperiments.list();
    expect(Array.isArray(experiments)).toBe(true);
  });

  it("create creates a new experiment", async () => {
    const result = await adminCaller.abExperiments.create({
      name: "Test Experiment - CTA Button",
      description: "Testing different CTA button colors",
      targetPage: "/",
      goalEvent: "share_purchase",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("getById returns experiment with variants and results", async () => {
    const { id } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Detail",
      targetPage: "/animals",
      goalEvent: "registration",
    });

    const detail = await adminCaller.abExperiments.getById({ id });
    expect(detail).not.toBeNull();
    expect(detail!.name).toBe("Test Experiment - Detail");
    expect(detail).toHaveProperty("variants");
    expect(detail).toHaveProperty("results");
  });

  it("addVariant adds a variant to an experiment", async () => {
    const { id: experimentId } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Variants",
      targetPage: "/",
      goalEvent: "share_purchase",
    });

    const v1 = await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "control",
      label: "Контроль",
      weight: 50,
    });
    expect(v1).toHaveProperty("id");

    const v2 = await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "variant_a",
      label: "Зелёная кнопка",
      weight: 50,
      config: JSON.stringify({ buttonColor: "green" }),
    });
    expect(v2).toHaveProperty("id");

    // Verify variants are attached
    const detail = await adminCaller.abExperiments.getById({ id: experimentId });
    expect(detail!.variants.length).toBe(2);
  });

  it("update changes experiment status", async () => {
    const { id } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Status",
      targetPage: "/",
      goalEvent: "registration",
    });

    await adminCaller.abExperiments.update({ id, status: "running" });
    const detail = await adminCaller.abExperiments.getById({ id });
    expect(detail!.status).toBe("running");

    await adminCaller.abExperiments.update({ id, status: "completed" });
    const detail2 = await adminCaller.abExperiments.getById({ id });
    expect(detail2!.status).toBe("completed");
  });

  it("activeForPage assigns visitor to running experiment", async () => {
    const uniquePage = `/test-page-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { id: experimentId } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Active",
      targetPage: uniquePage,
      goalEvent: "share_purchase",
    });

    await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "control",
      label: "Контроль",
      weight: 50,
    });
    await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "variant_a",
      label: "Вариант A",
      weight: 50,
    });

    await adminCaller.abExperiments.update({ id: experimentId, status: "running" });

    const assignments = await publicCaller.abExperiments.activeForPage({
      pagePath: uniquePage,
      visitorId: "test-visitor-123",
      sessionId: "test-session-456",
    });

    expect(assignments.length).toBe(1);
    expect(assignments[0].experimentId).toBe(experimentId);
    expect(["control", "variant_a"]).toContain(assignments[0].variantKey);
  });

  it("same visitor gets same variant on repeated calls", async () => {
    const uniquePage = `/sticky-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { id: experimentId } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Sticky",
      targetPage: uniquePage,
      goalEvent: "registration",
    });

    await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "control",
      label: "Контроль",
      weight: 50,
    });
    await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "variant_b",
      label: "Вариант B",
      weight: 50,
    });

    await adminCaller.abExperiments.update({ id: experimentId, status: "running" });

    const first = await publicCaller.abExperiments.activeForPage({
      pagePath: uniquePage,
      visitorId: "sticky-visitor",
      sessionId: "sticky-session",
    });

    const second = await publicCaller.abExperiments.activeForPage({
      pagePath: uniquePage,
      visitorId: "sticky-visitor",
      sessionId: "sticky-session-2",
    });

    expect(first[0].variantKey).toBe(second[0].variantKey);
  });

  it("recordConversion marks visitor as converted", async () => {
    const uniquePage = `/conv-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const { id: experimentId } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Conversion",
      targetPage: uniquePage,
      goalEvent: "share_purchase",
    });

    await adminCaller.abExperiments.addVariant({
      experimentId,
      variantKey: "control",
      label: "Контроль",
      weight: 100,
    });

    await adminCaller.abExperiments.update({ id: experimentId, status: "running" });

    // Assign visitor
    await publicCaller.abExperiments.activeForPage({
      pagePath: uniquePage,
      visitorId: "conv-visitor",
      sessionId: "conv-session",
    });

    // Record conversion
    const result = await publicCaller.abExperiments.recordConversion({
      experimentId,
      visitorId: "conv-visitor",
    });
    expect(result.success).toBe(true);

    // Check results - may have multiple variants in results
    const results = await adminCaller.abExperiments.results({ experimentId });
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Find the variant that has the conversion
    const withConversion = results.find((r: { conversions: number }) => r.conversions > 0);
    expect(withConversion).toBeDefined();
    expect(withConversion!.conversions).toBe(1);
    expect(withConversion!.conversionRate).toBeGreaterThan(0);
  });

  it("delete removes experiment and all related data", async () => {
    const { id } = await adminCaller.abExperiments.create({
      name: "Test Experiment - Delete",
      targetPage: "/",
      goalEvent: "registration",
    });

    await adminCaller.abExperiments.addVariant({
      experimentId: id,
      variantKey: "control",
      label: "Контроль",
      weight: 100,
    });

    const result = await adminCaller.abExperiments.delete({ id });
    expect(result.success).toBe(true);

    const detail = await adminCaller.abExperiments.getById({ id });
    expect(detail).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════
   Analytics Geo Endpoints Tests
   ═══════════════════════════════════════════════════════════════ */

describe("analytics geo endpoints", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  const dateRange = {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  };

  it("geoBreakdown returns an array", async () => {
    const data = await adminCaller.analytics.geoBreakdown({ ...dateRange, limit: 10 });
    expect(Array.isArray(data)).toBe(true);
  });

  it("visitorLocations returns an array", async () => {
    const data = await adminCaller.analytics.visitorLocations({ ...dateRange, limit: 10 });
    expect(Array.isArray(data)).toBe(true);
  });
});
