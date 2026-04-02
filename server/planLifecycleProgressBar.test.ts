/**
 * Tests for Phase K features:
 * 1. getMyPlanBySlug tRPC endpoint
 * 2. Per-product verification notification in batchVerifyProducts
 * 3. PlanLifecycleProgress component integration in ProductTracker
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// ─── Mock DB layer ───
const mockGetDb = vi.fn();
const mockGetAnimalIdBySlug = vi.fn<(slug: string) => Promise<number | null>>();
const mockGetOwnerProductPlan = vi.fn();
const mockGetVerifiedProductOptions = vi.fn();
const mockAdminBatchVerifyProducts = vi.fn();
const mockGetActiveOwnerOpenIdsByAnimalId = vi.fn();
const mockCreateUserNotification = vi.fn();
const mockGetAnimalNameById = vi.fn();
const mockGetAnimalSlugById = vi.fn();
const mockAreAllProductsVerified = vi.fn();
const mockGetAnimalIdFromOptionIds = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getAnimalIdBySlug: (...args: any[]) => mockGetAnimalIdBySlug(args[0]),
    getOwnerProductPlan: (...args: any[]) => mockGetOwnerProductPlan(args[0], args[1]),
    getVerifiedProductOptions: (...args: any[]) => mockGetVerifiedProductOptions(args[0]),
    adminBatchVerifyProducts: (...args: any[]) => mockAdminBatchVerifyProducts(args[0]),
    getActiveOwnerOpenIdsByAnimalId: (...args: any[]) => mockGetActiveOwnerOpenIdsByAnimalId(args[0]),
    createUserNotification: (...args: any[]) => mockCreateUserNotification(args[0]),
    getAnimalNameById: (...args: any[]) => mockGetAnimalNameById(args[0]),
    getAnimalSlugById: (...args: any[]) => mockGetAnimalSlugById(args[0]),
    areAllProductsVerified: (...args: any[]) => mockAreAllProductsVerified(args[0]),
    getAnimalIdFromOptionIds: (...args: any[]) => mockGetAnimalIdFromOptionIds(args[0]),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.test/file.png", key: "file.png" }),
}));

import { appRouter } from "./routers";

const adminCtx = {
  user: { openId: "admin-001", name: "Admin", role: "admin" as const },
} as any;
const ownerCtx = {
  user: { openId: "owner-001", name: "Owner", role: "user" as const },
} as any;

const adminCaller = appRouter.createCaller(adminCtx);
const ownerCaller = appRouter.createCaller(ownerCtx);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 1. getMyPlanBySlug endpoint ───
describe("productTrack.getMyPlanBySlug", () => {
  it("returns null plan when animal slug does not exist", async () => {
    mockGetAnimalIdBySlug.mockResolvedValue(null);

    const result = await ownerCaller.productTrack.getMyPlanBySlug({ animalSlug: "nonexistent" });

    expect(result.plan).toBeNull();
    expect(result.hasVerifiedProducts).toBe(false);
    expect(mockGetAnimalIdBySlug).toHaveBeenCalledWith("nonexistent");
  });

  it("returns plan and verified products flag when animal exists", async () => {
    mockGetAnimalIdBySlug.mockResolvedValue(100);
    mockGetOwnerProductPlan.mockResolvedValue({
      id: 1,
      status: "pending_owner_config",
      tierSlug: "basic",
    });
    mockGetVerifiedProductOptions.mockResolvedValue([
      { id: 10, productName: "Молоко" },
      { id: 11, productName: "Кефир" },
    ]);

    const result = await ownerCaller.productTrack.getMyPlanBySlug({ animalSlug: "mira" });

    expect(result.plan).toBeTruthy();
    expect(result.plan?.status).toBe("pending_owner_config");
    expect(result.hasVerifiedProducts).toBe(true);
    expect(mockGetAnimalIdBySlug).toHaveBeenCalledWith("mira");
    expect(mockGetOwnerProductPlan).toHaveBeenCalledWith("owner-001", 100);
    expect(mockGetVerifiedProductOptions).toHaveBeenCalledWith(100);
  });

  it("returns hasVerifiedProducts=false when no verified options", async () => {
    mockGetAnimalIdBySlug.mockResolvedValue(100);
    mockGetOwnerProductPlan.mockResolvedValue({
      id: 1,
      status: "pending_admin_setup",
      tierSlug: "basic",
    });
    mockGetVerifiedProductOptions.mockResolvedValue([]);

    const result = await ownerCaller.productTrack.getMyPlanBySlug({ animalSlug: "zlata" });

    expect(result.plan).toBeTruthy();
    expect(result.hasVerifiedProducts).toBe(false);
  });
});

// ─── 2. batchVerifyProducts sends per-product notification ───
describe("batchVerifyProducts per-product notification", () => {
  it("sends notification to owners when products are verified (not all verified yet)", async () => {
    mockAdminBatchVerifyProducts.mockResolvedValue([
      { id: 10, productName: "Молоко", isAdminVerified: true },
      { id: 11, productName: "Кефир", isAdminVerified: true },
    ]);
    mockGetAnimalIdFromOptionIds.mockResolvedValue(200);
    mockGetAnimalNameById.mockResolvedValue("Мира");
    mockGetAnimalSlugById.mockResolvedValue("mira");
    mockGetActiveOwnerOpenIdsByAnimalId.mockResolvedValue(["owner-001", "owner-002"]);
    mockAreAllProductsVerified.mockResolvedValue(false);

    await adminCaller.productTrack.batchVerifyProducts({ optionIds: [10, 11], animalId: 200 });

    // Should create notifications for each owner
    expect(mockCreateUserNotification).toHaveBeenCalled();
    const calls = mockCreateUserNotification.mock.calls;
    // At least 2 calls (one per owner)
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // Check notification content includes product count
    const firstCall = calls[0][0];
    expect(firstCall.title).toContain("2");
    expect(firstCall.type).toBe("productPlanUpdate");
  });

  it("sends both per-product and full-verification notifications when all verified", async () => {
    mockAdminBatchVerifyProducts.mockResolvedValue([
      { id: 10, productName: "Молоко", isAdminVerified: true },
    ]);
    mockGetAnimalIdFromOptionIds.mockResolvedValue(200);
    mockGetAnimalNameById.mockResolvedValue("Мира");
    mockGetAnimalSlugById.mockResolvedValue("mira");
    mockGetActiveOwnerOpenIdsByAnimalId.mockResolvedValue(["owner-001"]);
    mockAreAllProductsVerified.mockResolvedValue(true);

    await adminCaller.productTrack.batchVerifyProducts({ optionIds: [10], animalId: 200 });

    // Should have per-product notification (1 per owner)
    const calls = mockCreateUserNotification.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Per-product notification should mention verification
    const titles = calls.map((c: any) => c[0].title);
    expect(titles.some((t: string) => t.includes("верифицирован"))).toBe(true);
    // All notifications should have correct type
    calls.forEach((c: any) => {
      expect(c[0].type).toBe("productPlanUpdate");
    });
  });
});

// ─── 3. PlanLifecycleProgress component integration ───
describe("PlanLifecycleProgress component", () => {
  const COMPONENT_SRC = fs.readFileSync(
    path.resolve(__dirname, "../client/src/components/PlanLifecycleProgress.tsx"),
    "utf-8"
  );
  const TRACKER_SRC = fs.readFileSync(
    path.resolve(__dirname, "../client/src/pages/ProductTracker.tsx"),
    "utf-8"
  );

  it("component file exists and exports default", () => {
    expect(COMPONENT_SRC).toContain("export default function PlanLifecycleProgress");
  });

  it("uses getMyPlanBySlug tRPC query", () => {
    expect(COMPONENT_SRC).toContain("trpc.productTrack.getMyPlanBySlug.useQuery");
  });

  it("defines all 4 lifecycle stages", () => {
    expect(COMPONENT_SRC).toContain("admin_setup");
    expect(COMPONENT_SRC).toContain("owner_config");
    expect(COMPONENT_SRC).toContain("pending_approval");
    expect(COMPONENT_SRC).toContain("confirmed");
  });

  it("handles effective status when pending_owner_config but no verified products", () => {
    expect(COMPONENT_SRC).toContain('status === "pending_owner_config" && !hasVerifiedProducts');
    expect(COMPONENT_SRC).toContain('"pending_admin_setup"');
  });

  it("shows progress bar with animated width", () => {
    expect(COMPONENT_SRC).toContain("progressPercent");
    expect(COMPONENT_SRC).toContain("width:");
  });

  it("shows stage states: completed, current, upcoming", () => {
    expect(COMPONENT_SRC).toContain('"completed"');
    expect(COMPONENT_SRC).toContain('"current"');
    expect(COMPONENT_SRC).toContain('"upcoming"');
  });

  it("returns null when no plan exists", () => {
    expect(COMPONENT_SRC).toContain("if (!plan) return null");
  });

  it("is imported in ProductTracker", () => {
    expect(TRACKER_SRC).toContain('import PlanLifecycleProgress from "@/components/PlanLifecycleProgress"');
  });

  it("is rendered in ProductTracker for authenticated owners", () => {
    expect(TRACKER_SRC).toContain("<PlanLifecycleProgress animalSlug={currentAnimalSlug} />");
    expect(TRACKER_SRC).toContain("isAuthenticated && currentAnimalSlug && !isGuestJourney");
  });
});

// ─── 4. getMyPlanBySlug endpoint in router file ───
describe("productTrack router has getMyPlanBySlug", () => {
  const ROUTER_SRC = fs.readFileSync(
    path.resolve(__dirname, "routers/productTrack.ts"),
    "utf-8"
  );

  it("defines getMyPlanBySlug procedure", () => {
    expect(ROUTER_SRC).toContain("getMyPlanBySlug:");
  });

  it("accepts animalSlug input", () => {
    expect(ROUTER_SRC).toContain("animalSlug: z.string()");
  });

  it("calls getAnimalIdBySlug", () => {
    expect(ROUTER_SRC).toContain("getAnimalIdBySlug(input.animalSlug)");
  });

  it("returns plan and hasVerifiedProducts", () => {
    expect(ROUTER_SRC).toContain("hasVerifiedProducts:");
  });
});
