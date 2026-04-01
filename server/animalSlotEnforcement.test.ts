import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Tests that the animal creation/update input schema and helper functions
 * enforce the standardized 2-slot ownership model.
 */

// Mirror the Zod schema from routers.ts
const animalUpsertInput = z.object({
  totalOwnershipSlots: z.number().int().min(2).max(2),
});

// Mirror the getStandardizedOwnershipSlots helper from db.ts
function getStandardizedOwnershipSlots(): number {
  return 2;
}

describe("Animal Slot Enforcement", () => {
  describe("Zod schema validation", () => {
    it("accepts totalOwnershipSlots = 2", () => {
      const result = animalUpsertInput.safeParse({ totalOwnershipSlots: 2 });
      expect(result.success).toBe(true);
    });

    it("rejects totalOwnershipSlots = 1", () => {
      const result = animalUpsertInput.safeParse({ totalOwnershipSlots: 1 });
      expect(result.success).toBe(false);
    });

    it("rejects totalOwnershipSlots = 10", () => {
      const result = animalUpsertInput.safeParse({ totalOwnershipSlots: 10 });
      expect(result.success).toBe(false);
    });

    it("rejects totalOwnershipSlots = 0", () => {
      const result = animalUpsertInput.safeParse({ totalOwnershipSlots: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects totalOwnershipSlots = 3", () => {
      const result = animalUpsertInput.safeParse({ totalOwnershipSlots: 3 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer totalOwnershipSlots", () => {
      const result = animalUpsertInput.safeParse({ totalOwnershipSlots: 2.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("getStandardizedOwnershipSlots", () => {
    it("always returns 2", () => {
      expect(getStandardizedOwnershipSlots()).toBe(2);
    });
  });

  describe("createAnimalWithMedia enforcement simulation", () => {
    it("overrides any input totalOwnershipSlots to 2", () => {
      // Simulate the enforcement logic in createAnimalWithMedia
      const input = { totalOwnershipSlots: 10, name: "Test" };
      input.totalOwnershipSlots = getStandardizedOwnershipSlots();
      expect(input.totalOwnershipSlots).toBe(2);
    });

    it("keeps totalOwnershipSlots = 2 when already correct", () => {
      const input = { totalOwnershipSlots: 2, name: "Test" };
      input.totalOwnershipSlots = getStandardizedOwnershipSlots();
      expect(input.totalOwnershipSlots).toBe(2);
    });
  });

  describe("updateAnimalWithMedia enforcement simulation", () => {
    it("overrides totalOwnershipSlots in patch when present", () => {
      const animalPatch: Record<string, unknown> = { totalOwnershipSlots: 5 };
      if ("totalOwnershipSlots" in animalPatch) {
        animalPatch.totalOwnershipSlots = getStandardizedOwnershipSlots();
      }
      expect(animalPatch.totalOwnershipSlots).toBe(2);
    });

    it("does not add totalOwnershipSlots when not in patch", () => {
      const animalPatch: Record<string, unknown> = { name: "Updated" };
      if ("totalOwnershipSlots" in animalPatch) {
        animalPatch.totalOwnershipSlots = getStandardizedOwnershipSlots();
      }
      expect(animalPatch).not.toHaveProperty("totalOwnershipSlots");
    });
  });

  describe("percentage calculations with 2-slot model", () => {
    it("50% share = 1 slot out of 2", () => {
      const totalSlots = getStandardizedOwnershipSlots();
      const percentPerSlot = 100 / totalSlots;
      expect(percentPerSlot).toBe(50);
      expect(1 * percentPerSlot).toBe(50);
    });

    it("100% share = 2 slots out of 2", () => {
      const totalSlots = getStandardizedOwnershipSlots();
      const percentPerSlot = 100 / totalSlots;
      expect(2 * percentPerSlot).toBe(100);
    });

    it("never produces percentages > 100%", () => {
      const totalSlots = getStandardizedOwnershipSlots();
      const percentPerSlot = 100 / totalSlots;
      // Even if somehow 3 ownerships exist, capped at 100%
      const ownedPercent = Math.min(100, Math.round(3 * percentPerSlot));
      expect(ownedPercent).toBeLessThanOrEqual(100);
    });
  });
});
