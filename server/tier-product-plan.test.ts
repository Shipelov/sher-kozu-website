import { describe, expect, it } from "vitest";
import {
  computeTierSlug,
  getTierChangeFrequencyDays,
  getTierHierarchy,
  isTierAtLeast,
} from "./db";

/* ═══════════════════════════════════════════════════════════
   Unit tests for tier-based product plan system
   ═══════════════════════════════════════════════════════════ */

describe("computeTierSlug", () => {
  it("returns 'basic' when no ownerships exist", () => {
    expect(computeTierSlug([])).toBe("basic");
  });

  it("returns 'basic' when all ownerships are inactive", () => {
    const ownerships = [
      { animalId: 1, status: "cancelled", slotIndex: 0 },
      { animalId: 2, status: "pending", slotIndex: 0 },
    ];
    expect(computeTierSlug(ownerships)).toBe("basic");
  });

  it("returns 'basic' for a single 50% share (1 slot)", () => {
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
    ];
    expect(computeTierSlug(ownerships)).toBe("basic");
  });

  it("returns 'standard' for a single 100% ownership (2 slots)", () => {
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
      { animalId: 1, status: "active", slotIndex: 1 },
    ];
    expect(computeTierSlug(ownerships)).toBe("standard");
  });

  it("returns 'standard' for two 50% shares on different animals", () => {
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
      { animalId: 2, status: "active", slotIndex: 0 },
    ];
    expect(computeTierSlug(ownerships)).toBe("standard");
  });

  it("returns 'professional' for 100% ownership + additional animals", () => {
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
      { animalId: 1, status: "active", slotIndex: 1 },
      { animalId: 2, status: "active", slotIndex: 0 },
    ];
    expect(computeTierSlug(ownerships)).toBe("professional");
  });

  it("returns 'standard' for 3 different animals with 50% shares (no 100% ownership)", () => {
    // Professional requires at least one 100% ownership + additional animals
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
      { animalId: 2, status: "active", slotIndex: 0 },
      { animalId: 3, status: "active", slotIndex: 0 },
    ];
    expect(computeTierSlug(ownerships)).toBe("standard");
  });

  it("returns 'professional' for 100% on one animal + 50% on another", () => {
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
      { animalId: 1, status: "active", slotIndex: 1 },
      { animalId: 2, status: "active", slotIndex: 0 },
    ];
    expect(computeTierSlug(ownerships)).toBe("professional");
  });

  it("ignores inactive ownerships in tier calculation", () => {
    const ownerships = [
      { animalId: 1, status: "active", slotIndex: 0 },
      { animalId: 2, status: "cancelled", slotIndex: 0 },
      { animalId: 3, status: "pending", slotIndex: 0 },
    ];
    // Only 1 active ownership on 1 animal = basic
    expect(computeTierSlug(ownerships)).toBe("basic");
  });
});

describe("getTierChangeFrequencyDays", () => {
  it("returns 90 days for basic tier (quarterly)", () => {
    expect(getTierChangeFrequencyDays("basic")).toBe(90);
  });

  it("returns 30 days for standard tier (monthly)", () => {
    expect(getTierChangeFrequencyDays("standard")).toBe(30);
  });

  it("returns 7 days for professional tier (weekly)", () => {
    expect(getTierChangeFrequencyDays("professional")).toBe(7);
  });

  it("returns 90 days for unknown tier (fallback)", () => {
    expect(getTierChangeFrequencyDays("unknown")).toBe(90);
  });
});

describe("getTierHierarchy", () => {
  it("returns the correct tier hierarchy order", () => {
    const hierarchy = getTierHierarchy();
    expect(hierarchy).toEqual(["basic", "standard", "professional"]);
  });

  it("has basic as the lowest tier", () => {
    const hierarchy = getTierHierarchy();
    expect(hierarchy[0]).toBe("basic");
  });

  it("has professional as the highest tier", () => {
    const hierarchy = getTierHierarchy();
    expect(hierarchy[hierarchy.length - 1]).toBe("professional");
  });
});

describe("isTierAtLeast", () => {
  it("basic is at least basic", () => {
    expect(isTierAtLeast("basic", "basic")).toBe(true);
  });

  it("standard is at least basic", () => {
    expect(isTierAtLeast("standard", "basic")).toBe(true);
  });

  it("professional is at least basic", () => {
    expect(isTierAtLeast("professional", "basic")).toBe(true);
  });

  it("professional is at least standard", () => {
    expect(isTierAtLeast("professional", "standard")).toBe(true);
  });

  it("basic is NOT at least standard", () => {
    expect(isTierAtLeast("basic", "standard")).toBe(false);
  });

  it("standard is NOT at least professional", () => {
    expect(isTierAtLeast("standard", "professional")).toBe(false);
  });

  it("returns false for unknown tiers", () => {
    expect(isTierAtLeast("unknown", "basic")).toBe(false);
    expect(isTierAtLeast("basic", "unknown")).toBe(false);
  });
});
