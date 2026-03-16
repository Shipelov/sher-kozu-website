import { describe, expect, it } from "vitest";

type OwnershipStatus = "active" | "pending_payment" | "cancelled" | "expired";
type AnimalStatus = "public_available" | "public_limited" | "fully_booked" | "hidden" | "archived";
type UserRole = "admin" | "user";

type OwnershipRecord = {
  animalId: number;
  slotIndex: number;
  status: OwnershipStatus;
};

type AnimalRecord = {
  id: number;
  slug: string;
  status: AnimalStatus;
  totalOwnershipSlots: number;
};

function countActiveOwnerships(records: OwnershipRecord[], animalId: number) {
  return records.filter((record) => {
    return record.animalId === animalId && (record.status === "active" || record.status === "pending_payment");
  }).length;
}

function getAvailableSlotIndex(animal: AnimalRecord, records: OwnershipRecord[]) {
  const usedSlots = new Set(
    records
      .filter((record) => record.animalId === animal.id)
      .filter((record) => record.status === "active" || record.status === "pending_payment")
      .map((record) => record.slotIndex)
  );

  for (let slotIndex = 1; slotIndex <= animal.totalOwnershipSlots; slotIndex += 1) {
    if (!usedSlots.has(slotIndex)) {
      return slotIndex;
    }
  }

  return null;
}

function recalculateAnimalStatus(animal: AnimalRecord, activeCount: number): AnimalStatus {
  if (animal.status === "hidden" || animal.status === "archived") {
    return animal.status;
  }

  if (activeCount >= animal.totalOwnershipSlots) {
    return "fully_booked";
  }

  if (activeCount >= Math.max(1, animal.totalOwnershipSlots - 1)) {
    return "public_limited";
  }

  return "public_available";
}

function getAvailableSlots(animal: AnimalRecord, records: OwnershipRecord[]) {
  return Math.max(0, animal.totalOwnershipSlots - countActiveOwnerships(records, animal.id));
}

function getAnimalBySlug(animals: AnimalRecord[], slug: string) {
  return animals.find((animal) => animal.slug === slug) ?? null;
}

function assertAdminRole(role: UserRole) {
  if (role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return true;
}

describe("Sprint 1 ownership flow domain rules", () => {
  it("counts only active and pending_payment ownerships as occupied slots", () => {
    const ownerships: OwnershipRecord[] = [
      { animalId: 1, slotIndex: 1, status: "active" },
      { animalId: 1, slotIndex: 2, status: "pending_payment" },
      { animalId: 1, slotIndex: 3, status: "expired" },
      { animalId: 2, slotIndex: 1, status: "active" },
    ];

    expect(countActiveOwnerships(ownerships, 1)).toBe(2);
    expect(countActiveOwnerships(ownerships, 2)).toBe(1);
  });

  it("returns the first free slot index in ascending order", () => {
    const animal: AnimalRecord = {
      id: 10,
      slug: "marta",
      status: "public_available",
      totalOwnershipSlots: 3,
    };
    const ownerships: OwnershipRecord[] = [
      { animalId: 10, slotIndex: 1, status: "active" },
      { animalId: 10, slotIndex: 3, status: "pending_payment" },
    ];

    expect(getAvailableSlotIndex(animal, ownerships)).toBe(2);
  });

  it("returns null when all ownership slots are occupied", () => {
    const animal: AnimalRecord = {
      id: 11,
      slug: "zlata",
      status: "public_limited",
      totalOwnershipSlots: 2,
    };
    const ownerships: OwnershipRecord[] = [
      { animalId: 11, slotIndex: 1, status: "active" },
      { animalId: 11, slotIndex: 2, status: "pending_payment" },
    ];

    expect(getAvailableSlotIndex(animal, ownerships)).toBeNull();
    expect(getAvailableSlots(animal, ownerships)).toBe(0);
  });

  it("keeps animal public_available while more than one slot is still open", () => {
    const animal: AnimalRecord = {
      id: 21,
      slug: "sakura",
      status: "public_available",
      totalOwnershipSlots: 3,
    };

    expect(recalculateAnimalStatus(animal, 0)).toBe("public_available");
    expect(recalculateAnimalStatus(animal, 1)).toBe("public_available");
  });

  it("switches animal to public_limited when the last slot is approaching", () => {
    const animal: AnimalRecord = {
      id: 22,
      slug: "luna",
      status: "public_available",
      totalOwnershipSlots: 3,
    };

    expect(recalculateAnimalStatus(animal, 2)).toBe("public_limited");
  });

  it("switches animal to fully_booked when active ownerships reach slot limit", () => {
    const animal: AnimalRecord = {
      id: 23,
      slug: "alma",
      status: "public_limited",
      totalOwnershipSlots: 2,
    };

    expect(recalculateAnimalStatus(animal, 2)).toBe("fully_booked");
  });

  it("preserves hidden and archived statuses during recalculation", () => {
    const hiddenAnimal: AnimalRecord = {
      id: 24,
      slug: "beta",
      status: "hidden",
      totalOwnershipSlots: 3,
    };
    const archivedAnimal: AnimalRecord = {
      id: 25,
      slug: "gamma",
      status: "archived",
      totalOwnershipSlots: 3,
    };

    expect(recalculateAnimalStatus(hiddenAnimal, 3)).toBe("hidden");
    expect(recalculateAnimalStatus(archivedAnimal, 3)).toBe("archived");
  });

  it("returns animal by slug for public details page and null for unknown slug", () => {
    const animals: AnimalRecord[] = [
      { id: 31, slug: "marta", status: "public_available", totalOwnershipSlots: 3 },
      { id: 32, slug: "zlata", status: "fully_booked", totalOwnershipSlots: 2 },
    ];

    expect(getAnimalBySlug(animals, "marta")?.id).toBe(31);
    expect(getAnimalBySlug(animals, "unknown")).toBeNull();
  });

  it("blocks non-admin users from admin animal CRUD flow", () => {
    expect(() => assertAdminRole("user")).toThrowError("FORBIDDEN");
    expect(assertAdminRole("admin")).toBe(true);
  });
});
