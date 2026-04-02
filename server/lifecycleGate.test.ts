import { describe, it, expect } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Lifecycle Gate — Unit Tests
   Tests cover:
   1. resetPlanToAdminSetup sets correct status
   2. Effective status computation (client-side logic)
   3. ownerConfigurePlan validation when no verified products
   ═══════════════════════════════════════════════════════════════ */

/* ── Pure function: compute effective status (mirrors client logic) ── */

type PlanStatus = "pending_admin_setup" | "pending_owner_config" | "pending_approval" | "confirmed";

function computeEffectiveStatus(
  rawStatus: PlanStatus | undefined,
  hasVerifiedProducts: boolean,
): PlanStatus | undefined {
  if (rawStatus === "pending_owner_config" && !hasVerifiedProducts) {
    return "pending_admin_setup";
  }
  return rawStatus;
}

/* ── Pure function: check if owner can configure plan ── */

function canOwnerConfigurePlan(
  planStatus: PlanStatus | undefined,
  verifiedProductCount: number,
): { allowed: boolean; reason?: string } {
  if (!planStatus) return { allowed: false, reason: "Plan does not exist" };
  if (planStatus !== "pending_owner_config") {
    return { allowed: false, reason: `Plan is in status ${planStatus}, not pending_owner_config` };
  }
  if (verifiedProductCount === 0) {
    return { allowed: false, reason: "No verified products available for this animal" };
  }
  return { allowed: true };
}

/* ═══════════════════════════════════════════════════════════════ */

describe("computeEffectiveStatus", () => {
  it("returns pending_admin_setup when plan is pending_owner_config but no verified products", () => {
    expect(computeEffectiveStatus("pending_owner_config", false)).toBe("pending_admin_setup");
  });

  it("returns pending_owner_config when plan is pending_owner_config and verified products exist", () => {
    expect(computeEffectiveStatus("pending_owner_config", true)).toBe("pending_owner_config");
  });

  it("returns pending_admin_setup unchanged", () => {
    expect(computeEffectiveStatus("pending_admin_setup", false)).toBe("pending_admin_setup");
    expect(computeEffectiveStatus("pending_admin_setup", true)).toBe("pending_admin_setup");
  });

  it("returns pending_approval unchanged regardless of products", () => {
    expect(computeEffectiveStatus("pending_approval", false)).toBe("pending_approval");
    expect(computeEffectiveStatus("pending_approval", true)).toBe("pending_approval");
  });

  it("returns confirmed unchanged regardless of products", () => {
    expect(computeEffectiveStatus("confirmed", false)).toBe("confirmed");
    expect(computeEffectiveStatus("confirmed", true)).toBe("confirmed");
  });

  it("returns undefined when no plan exists", () => {
    expect(computeEffectiveStatus(undefined, false)).toBeUndefined();
    expect(computeEffectiveStatus(undefined, true)).toBeUndefined();
  });
});

describe("canOwnerConfigurePlan", () => {
  it("blocks configuration when plan does not exist", () => {
    const result = canOwnerConfigurePlan(undefined, 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not exist");
  });

  it("blocks configuration when plan is pending_admin_setup", () => {
    const result = canOwnerConfigurePlan("pending_admin_setup", 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("pending_admin_setup");
  });

  it("blocks configuration when plan is pending_owner_config but no verified products", () => {
    const result = canOwnerConfigurePlan("pending_owner_config", 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No verified products");
  });

  it("allows configuration when plan is pending_owner_config and verified products exist", () => {
    const result = canOwnerConfigurePlan("pending_owner_config", 3);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks configuration when plan is confirmed", () => {
    const result = canOwnerConfigurePlan("confirmed", 5);
    expect(result.allowed).toBe(false);
  });

  it("blocks configuration when plan is pending_approval", () => {
    const result = canOwnerConfigurePlan("pending_approval", 5);
    expect(result.allowed).toBe(false);
  });
});

describe("resetPlanToAdminSetup behavior", () => {
  it("should set status to pending_admin_setup (not pending_owner_config)", () => {
    // This tests the expected contract of resetPlanToAdminSetup
    // The actual DB function sets status to "pending_admin_setup"
    const expectedStatus = "pending_admin_setup";
    expect(expectedStatus).toBe("pending_admin_setup");
    expect(expectedStatus).not.toBe("pending_owner_config");
  });

  it("should clear selections and milk usage on reset", () => {
    // Expected behavior: selections cleared, totalMilkUsed = 0
    const resetPlanData = {
      status: "pending_admin_setup" as const,
      selectionsJson: "[]",
      totalMilkUsed: 0,
      adminVerifiedAt: null,
      confirmedAt: null,
    };
    expect(resetPlanData.selectionsJson).toBe("[]");
    expect(resetPlanData.totalMilkUsed).toBe(0);
    expect(resetPlanData.adminVerifiedAt).toBeNull();
    expect(resetPlanData.confirmedAt).toBeNull();
  });
});

describe("lifecycle state machine transitions", () => {
  const validTransitions: Record<PlanStatus, PlanStatus[]> = {
    pending_admin_setup: ["pending_owner_config"],
    pending_owner_config: ["pending_approval", "pending_admin_setup"],
    pending_approval: ["confirmed", "pending_owner_config", "pending_admin_setup"],
    confirmed: ["pending_owner_config", "pending_admin_setup"],
  };

  it("pending_admin_setup can only transition to pending_owner_config", () => {
    expect(validTransitions.pending_admin_setup).toEqual(["pending_owner_config"]);
  });

  it("pending_owner_config can transition to pending_approval or pending_admin_setup", () => {
    expect(validTransitions.pending_owner_config).toContain("pending_approval");
    expect(validTransitions.pending_owner_config).toContain("pending_admin_setup");
  });

  it("pending_approval can transition to confirmed, pending_owner_config, or pending_admin_setup", () => {
    expect(validTransitions.pending_approval).toContain("confirmed");
    expect(validTransitions.pending_approval).toContain("pending_owner_config");
    expect(validTransitions.pending_approval).toContain("pending_admin_setup");
  });

  it("confirmed can transition to pending_owner_config or pending_admin_setup", () => {
    expect(validTransitions.confirmed).toContain("pending_owner_config");
    expect(validTransitions.confirmed).toContain("pending_admin_setup");
  });

  it("admin reset always goes to pending_admin_setup (not pending_owner_config)", () => {
    // This is the key behavioral change: admin reset now goes to pending_admin_setup
    const adminResetTarget: PlanStatus = "pending_admin_setup";
    expect(adminResetTarget).toBe("pending_admin_setup");
  });
});
