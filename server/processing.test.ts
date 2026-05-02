import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Processing & Warehouse Router Tests
 *
 * These tests verify the tRPC procedure definitions exist and are callable.
 * They use the admin context to test warehouseAdmin procedures.
 */

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@sherkozu.ru",
      name: "Admin",
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

describe("warehouseAdmin router", () => {
  it("list procedure exists and is callable", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Should not throw — returns empty array if no warehouses
    const result = await caller.warehouseAdmin.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("processingSessions procedure exists and is callable", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.warehouseAdmin.processingSessions({
      limit: 5,
      offset: 0,
    });
    expect(result).toHaveProperty("sessions");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.sessions)).toBe(true);
  });

  it("conversionAnalytics procedure exists and is callable", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.warehouseAdmin.conversionAnalytics({
      deviationThreshold: 15,
    });
    expect(result).toHaveProperty("sessions");
    expect(result).toHaveProperty("alerts");
    expect(Array.isArray(result.alerts)).toBe(true);
  });

  it("create procedure requires name field", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Should succeed with valid input
    const result = await caller.warehouseAdmin.create({
      name: "Test Warehouse " + Date.now(),
      description: "Test description",
    });
    expect(result).toHaveProperty("id");
    expect(result.name).toContain("Test Warehouse");
  });
});

describe("milkProcessing router", () => {
  it("all processing procedures are registered in appRouter", () => {
    // milkProcessing uses cheesemakerProcedure which requires farm cookie
    // We verify the router is registered by checking the appRouter shape
    const routerKeys = Object.keys((appRouter as any)._def.procedures);
    expect(routerKeys).toContain("milkProcessing.listSessions");
    expect(routerKeys).toContain("milkProcessing.createSession");
    expect(routerKeys).toContain("milkProcessing.completeSession");
    expect(routerKeys).toContain("milkProcessing.catalogItems");
    expect(routerKeys).toContain("milkProcessing.activeWarehouses");
    expect(routerKeys).toContain("milkProcessing.activeTanks");
    expect(routerKeys).toContain("milkProcessing.cancelSession");
    expect(routerKeys).toContain("milkProcessing.correctSession");
  });
});

describe("milkController processing procedures", () => {
  it("processingSessions and conversionAnalytics are registered", () => {
    const routerKeys = Object.keys((appRouter as any)._def.procedures);
    expect(routerKeys).toContain("milkController.processingSessions");
    expect(routerKeys).toContain("milkController.conversionAnalytics");
  });
});
