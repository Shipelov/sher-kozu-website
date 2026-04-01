import { describe, expect, it } from "vitest";

type OwnershipStatus = "active" | "pending_payment" | "cancelled" | "expired";
type AnimalStatus = "public_available" | "public_limited" | "fully_booked" | "hidden" | "archived";
type UserRole = "admin" | "user";
type PlanRecord = { id: number; ownerOpenId: string; status: "active" | "archived" };

type OwnershipRecord = {
  animalId: number;
  slotIndex: number;
  status: OwnershipStatus;
  priceMinor?: number;
};

type AnimalRecord = {
  id: number;
  slug: string;
  status: AnimalStatus;
  totalOwnershipSlots: number;
  baseMonthlyPriceMinor: number;
};

function normalizeOwnershipSlots(totalOwnershipSlots: number | null | undefined) {
  if (!Number.isFinite(totalOwnershipSlots) || !totalOwnershipSlots || totalOwnershipSlots < 1) {
    return 2;
  }

  return Math.round(totalOwnershipSlots);
}

function isOccupiedOwnershipStatus(status: OwnershipStatus) {
  return status === "active" || status === "pending_payment";
}

function countActiveOwnerships(records: OwnershipRecord[], animalId: number) {
  return records.filter((record) => record.animalId === animalId && isOccupiedOwnershipStatus(record.status)).length;
}

function getPercentPerSlot(totalOwnershipSlots: number | null | undefined) {
  return 100 / normalizeOwnershipSlots(totalOwnershipSlots);
}

function getOwnedPercentFromCount(activeOwnerships: number, totalOwnershipSlots: number | null | undefined) {
  return Math.min(100, Math.round(activeOwnerships * getPercentPerSlot(totalOwnershipSlots)));
}

function getSharePriceMinor(basePriceMinor: number, sharePercent: number) {
  return Math.round((Math.max(0, basePriceMinor) * sharePercent) / 100);
}

function getAvailableSharePercents(animal: AnimalRecord, records: OwnershipRecord[]) {
  const totalSlots = normalizeOwnershipSlots(animal.totalOwnershipSlots);
  const activeOwnerships = countActiveOwnerships(records, animal.id);
  const availablePercent = Math.max(0, 100 - getOwnedPercentFromCount(activeOwnerships, totalSlots));
  const shareUnitPercent = Math.round(getPercentPerSlot(totalSlots));
  const values: number[] = [];

  for (let sharePercent = shareUnitPercent; sharePercent <= availablePercent; sharePercent += shareUnitPercent) {
    values.push(sharePercent);
  }

  return values;
}

function getFirstFreeSlotIndexes(animal: AnimalRecord, records: OwnershipRecord[], requestedSlots: number) {
  const totalSlots = normalizeOwnershipSlots(animal.totalOwnershipSlots);
  const usedSlots = new Set(
    records
      .filter((record) => record.animalId === animal.id)
      .filter((record) => isOccupiedOwnershipStatus(record.status))
      .map((record) => record.slotIndex)
  );

  const freeSlotIndexes: number[] = [];
  for (let slotIndex = 1; slotIndex <= totalSlots; slotIndex += 1) {
    if (!usedSlots.has(slotIndex)) {
      freeSlotIndexes.push(slotIndex);
    }

    if (freeSlotIndexes.length === requestedSlots) {
      break;
    }
  }

  return freeSlotIndexes;
}

function isValidSharePercent(animal: AnimalRecord, sharePercent: number) {
  const shareUnitPercent = Math.round(getPercentPerSlot(animal.totalOwnershipSlots));
  return Number.isInteger(sharePercent) && sharePercent >= shareUnitPercent && sharePercent <= 100 && sharePercent % shareUnitPercent === 0;
}

function recalculateAnimalStatus(animal: AnimalRecord, activeCount: number): AnimalStatus {
  if (animal.status === "hidden" || animal.status === "archived") {
    return animal.status;
  }

  const totalSlots = normalizeOwnershipSlots(animal.totalOwnershipSlots);

  if (activeCount >= totalSlots) {
    return "fully_booked";
  }

  if (activeCount >= Math.max(1, totalSlots - 1)) {
    return "public_limited";
  }

  return "public_available";
}

function getAvailableSlots(animal: AnimalRecord, records: OwnershipRecord[]) {
  return Math.max(0, normalizeOwnershipSlots(animal.totalOwnershipSlots) - countActiveOwnerships(records, animal.id));
}

function getAnimalBySlug(animals: AnimalRecord[], slug: string) {
  return animals.find((animal) => animal.slug === slug && animal.status !== "archived") ?? null;
}

function archiveAnimal(animal: AnimalRecord): AnimalRecord {
  return {
    ...animal,
    status: "archived",
  };
}

function restoreAnimal(animal: AnimalRecord): AnimalRecord {
  return {
    ...animal,
    status: "hidden",
  };
}

function pickDefaultPlanForAnimal(ownerOpenId: string, plans: PlanRecord[]) {
  const ownerActivePlans = plans.filter((plan) => plan.ownerOpenId === ownerOpenId && plan.status === "active");
  if (ownerActivePlans.length) {
    return ownerActivePlans[0];
  }

  return plans.find((plan) => plan.status === "active") ?? null;
}

function assertAdminRole(role: UserRole) {
  if (role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return true;
}

describe("Sprint 1 ownership flow domain rules (50/100 model)", () => {
  it("counts only active and pending_payment ownerships as occupied slots", () => {
    const ownerships: OwnershipRecord[] = [
      { animalId: 1, slotIndex: 1, status: "active" },
      { animalId: 1, slotIndex: 2, status: "pending_payment" },
      { animalId: 2, slotIndex: 1, status: "active" },
    ];

    expect(countActiveOwnerships(ownerships, 1)).toBe(2);
    expect(countActiveOwnerships(ownerships, 2)).toBe(1);
  });

  it("returns ascending free slots for requested share size (2-slot model)", () => {
    const animal: AnimalRecord = {
      id: 10,
      slug: "marta",
      status: "public_available",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 150000,
    };
    const ownerships: OwnershipRecord[] = [
      { animalId: 10, slotIndex: 1, status: "active" },
    ];

    expect(getFirstFreeSlotIndexes(animal, ownerships, 1)).toEqual([2]);
  });

  it("returns empty when all slots are occupied", () => {
    const animal: AnimalRecord = {
      id: 11,
      slug: "zlata",
      status: "fully_booked",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 100000,
    };
    const ownerships: OwnershipRecord[] = [
      { animalId: 11, slotIndex: 1, status: "active" },
      { animalId: 11, slotIndex: 2, status: "active" },
    ];

    expect(getFirstFreeSlotIndexes(animal, ownerships, 1)).toEqual([]);
    expect(getAvailableSlots(animal, ownerships)).toBe(0);
  });

  it("computes owned and available percent from active slot count (2-slot model)", () => {
    const animal: AnimalRecord = {
      id: 12,
      slug: "luna",
      status: "public_available",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 200000,
    };
    const ownerships: OwnershipRecord[] = [
      { animalId: 12, slotIndex: 1, status: "active" },
    ];

    expect(getOwnedPercentFromCount(countActiveOwnerships(ownerships, animal.id), animal.totalOwnershipSlots)).toBe(50);
    expect(100 - getOwnedPercentFromCount(countActiveOwnerships(ownerships, animal.id), animal.totalOwnershipSlots)).toBe(50);
  });

  it("calculates share price from the full animal price and selected percent", () => {
    expect(getSharePriceMinor(135000, 50)).toBe(67500);
    expect(getSharePriceMinor(135000, 100)).toBe(135000);
  });

  it("accepts only 50% and 100% share percentages (2-slot model)", () => {
    const animal: AnimalRecord = {
      id: 13,
      slug: "alma",
      status: "public_available",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 135000,
    };

    expect(isValidSharePercent(animal, 50)).toBe(true);
    expect(isValidSharePercent(animal, 100)).toBe(true);
    expect(isValidSharePercent(animal, 0)).toBe(false);
    expect(isValidSharePercent(animal, 10)).toBe(false);
    expect(isValidSharePercent(animal, 30)).toBe(false);
    expect(isValidSharePercent(animal, 75)).toBe(false);
  });

  it("returns the animal owner's active default plan and falls back to any active plan if owner-specific one is missing", () => {
    const plans: PlanRecord[] = [
      { id: 1, ownerOpenId: "owner-demo", status: "active" },
      { id: 2, ownerOpenId: "owner-marta", status: "active" },
      { id: 3, ownerOpenId: "owner-zlata", status: "archived" },
    ];

    expect(pickDefaultPlanForAnimal("owner-marta", plans)?.id).toBe(2);
    expect(pickDefaultPlanForAnimal("owner-zlata", plans)?.id).toBe(1);
    expect(pickDefaultPlanForAnimal("owner-unknown", plans)?.id).toBe(1);
    expect(pickDefaultPlanForAnimal("owner-unknown", [{ id: 9, ownerOpenId: "x", status: "archived" }])).toBeNull();
  });

  it("returns only share percent options up to remaining available capacity (2-slot model)", () => {
    const animal: AnimalRecord = {
      id: 14,
      slug: "sakura",
      status: "public_available",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 180000,
    };

    // No ownerships — both 50% and 100% available
    expect(getAvailableSharePercents(animal, [])).toEqual([50, 100]);

    // One slot taken — only 50% available
    const ownerships: OwnershipRecord[] = [
      { animalId: 14, slotIndex: 1, status: "active" },
    ];
    expect(getAvailableSharePercents(animal, ownerships)).toEqual([50]);

    // Both slots taken — nothing available
    const fullOwnerships: OwnershipRecord[] = [
      { animalId: 14, slotIndex: 1, status: "active" },
      { animalId: 14, slotIndex: 2, status: "active" },
    ];
    expect(getAvailableSharePercents(animal, fullOwnerships)).toEqual([]);
  });

  it("keeps animal public_available when no slots are occupied", () => {
    const animal: AnimalRecord = {
      id: 21,
      slug: "sakura",
      status: "public_available",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 170000,
    };

    expect(recalculateAnimalStatus(animal, 0)).toBe("public_available");
  });

  it("switches animal to public_limited when 1 of 2 slots is occupied", () => {
    const animal: AnimalRecord = {
      id: 22,
      slug: "luna",
      status: "public_available",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 160000,
    };

    expect(recalculateAnimalStatus(animal, 1)).toBe("public_limited");
  });

  it("switches animal to fully_booked when both slots are occupied", () => {
    const animal: AnimalRecord = {
      id: 23,
      slug: "alma",
      status: "public_limited",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 160000,
    };

    expect(recalculateAnimalStatus(animal, 2)).toBe("fully_booked");
  });

  it("preserves hidden and archived statuses during recalculation", () => {
    const hiddenAnimal: AnimalRecord = {
      id: 24,
      slug: "beta",
      status: "hidden",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 150000,
    };
    const archivedAnimal: AnimalRecord = {
      id: 25,
      slug: "gamma",
      status: "archived",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 150000,
    };

    expect(recalculateAnimalStatus(hiddenAnimal, 2)).toBe("hidden");
    expect(recalculateAnimalStatus(archivedAnimal, 2)).toBe("archived");
  });

  it("returns animal by slug for public details page and null for unknown slug", () => {
    const animals: AnimalRecord[] = [
      { id: 31, slug: "marta", status: "public_available", totalOwnershipSlots: 2, baseMonthlyPriceMinor: 135000 },
      { id: 32, slug: "zlata", status: "fully_booked", totalOwnershipSlots: 2, baseMonthlyPriceMinor: 118000 },
    ];

    expect(getAnimalBySlug(animals, "marta")?.id).toBe(31);
    expect(getAnimalBySlug(animals, "unknown")).toBeNull();
  });

  it("hides archived animals from the public slug lookup", () => {
    const animals: AnimalRecord[] = [
      { id: 33, slug: "mira", status: "archived", totalOwnershipSlots: 2, baseMonthlyPriceMinor: 142000 },
      { id: 34, slug: "lana", status: "hidden", totalOwnershipSlots: 2, baseMonthlyPriceMinor: 121000 },
    ];

    expect(getAnimalBySlug(animals, "mira")).toBeNull();
    expect(getAnimalBySlug(animals, "lana")?.id).toBe(34);
  });

  it("archives animal without touching slot model and allows restore to hidden status", () => {
    const animal: AnimalRecord = {
      id: 35,
      slug: "vesna",
      status: "public_limited",
      totalOwnershipSlots: 2,
      baseMonthlyPriceMinor: 150000,
    };
    const ownerships: OwnershipRecord[] = [
      { animalId: 35, slotIndex: 1, status: "active" },
    ];

    const archived = archiveAnimal(animal);
    const restored = restoreAnimal(archived);

    expect(archived.status).toBe("archived");
    expect(countActiveOwnerships(ownerships, animal.id)).toBe(1);
    expect(getAvailableSharePercents(archived, ownerships)).toEqual([50]);
    expect(restored.status).toBe("hidden");
    expect(recalculateAnimalStatus(restored, countActiveOwnerships(ownerships, animal.id))).toBe("hidden");
  });

  it("blocks non-admin users from admin animal CRUD flow", () => {
    expect(() => assertAdminRole("user")).toThrowError("FORBIDDEN");
    expect(assertAdminRole("admin")).toBe(true);
  });

  it("server-side fallback: purchaseShare input allows omitting planId and planDurationId", () => {
    type PurchaseInput = {
      animalId: number;
      sharePercent: number;
      planId?: number;
      planDurationId?: number;
      notes?: string;
    };

    type PlanWithDurations = {
      id: number;
      durations: { id: number; months: number }[];
    };

    function resolvePlanIds(
      input: PurchaseInput,
      activePlans: PlanWithDurations[]
    ): { planId: number; planDurationId: number } | null {
      let planId = input.planId;
      let planDurationId = input.planDurationId;

      if (!planId || !planDurationId) {
        const fallbackPlan = activePlans[0];
        if (!fallbackPlan || !fallbackPlan.durations?.[0]) return null;
        planId = planId ?? fallbackPlan.id;
        planDurationId = planDurationId ?? fallbackPlan.durations[0].id;
      }

      return { planId, planDurationId };
    }

    // Case 1: client provides both — no fallback needed
    const withBoth = resolvePlanIds(
      { animalId: 1, sharePercent: 50, planId: 5, planDurationId: 12 },
      [{ id: 99, durations: [{ id: 100, months: 1 }] }]
    );
    expect(withBoth).toEqual({ planId: 5, planDurationId: 12 });

    // Case 2: client omits both — server picks first active plan
    const withNeither = resolvePlanIds(
      { animalId: 1, sharePercent: 50 },
      [{ id: 99, durations: [{ id: 100, months: 1 }, { id: 101, months: 3 }] }]
    );
    expect(withNeither).toEqual({ planId: 99, planDurationId: 100 });

    // Case 3: no active plans at all — returns null (server will throw NO_ACTIVE_PLAN)
    const noPlans = resolvePlanIds(
      { animalId: 1, sharePercent: 50 },
      []
    );
    expect(noPlans).toBeNull();

    // Case 4: active plan exists but has no durations — returns null
    const noDurations = resolvePlanIds(
      { animalId: 1, sharePercent: 100 },
      [{ id: 50, durations: [] }]
    );
    expect(noDurations).toBeNull();
  });
});
