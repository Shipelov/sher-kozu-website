import { describe, expect, it } from "vitest";
import { filterAdminAnimals, getNextVisibilityMode, getStatusBadge } from "../client/src/pages/AdminAnimals";

const animals = [
  {
    id: 1,
    slug: "marta",
    name: "Марта",
    species: "goat",
    breed: "Англо-нубийская",
    status: "public_available",
    totalOwnershipSlots: 10,
    activeOwnerships: 4,
    availableSlots: 6,
    baseMonthlyPriceMinor: 125000,
    healthScore: 92,
    happinessScore: 89,
    milkPotentialScore: 95,
    isFeatured: 1,
    coverImageUrl: null,
  },
  {
    id: 2,
    slug: "luna",
    name: "Луна",
    species: "sheep",
    breed: "Романовская",
    status: "hidden",
    totalOwnershipSlots: 8,
    activeOwnerships: 0,
    availableSlots: 8,
    baseMonthlyPriceMinor: 99000,
    healthScore: 88,
    happinessScore: 90,
    milkPotentialScore: 74,
    isFeatured: 0,
    coverImageUrl: null,
  },
  {
    id: 3,
    slug: "zvezda",
    name: "Звезда",
    species: "goat",
    breed: "Зааненская",
    status: "fully_booked",
    totalOwnershipSlots: 10,
    activeOwnerships: 10,
    availableSlots: 0,
    baseMonthlyPriceMinor: 135000,
    healthScore: 96,
    happinessScore: 94,
    milkPotentialScore: 97,
    isFeatured: 1,
    coverImageUrl: null,
  },
] as const;

describe("Admin animals UI helpers", () => {
  it("filters animals by search query across name, slug, and breed", () => {
    expect(filterAdminAnimals([...animals], "мар", "all", "all")).toHaveLength(1);
    expect(filterAdminAnimals([...animals], "luna", "all", "all")[0]?.slug).toBe("luna");
    expect(filterAdminAnimals([...animals], "заан", "all", "all")[0]?.slug).toBe("zvezda");
  });

  it("filters animals by status and species together", () => {
    const result = filterAdminAnimals([...animals], "", "hidden", "sheep");
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("luna");
  });

  it("returns hidden to public and all other active states to hidden", () => {
    expect(getNextVisibilityMode("hidden")).toBe("public");
    expect(getNextVisibilityMode("public_available")).toBe("hidden");
    expect(getNextVisibilityMode("public_limited")).toBe("hidden");
    expect(getNextVisibilityMode("fully_booked")).toBe("hidden");
  });

  it("returns readable badges for public and hidden states", () => {
    expect(getStatusBadge("public_available").label).toBe("Доступно");
    expect(getStatusBadge("hidden").label).toBe("Скрыто");
    expect(getStatusBadge("archived").label).toBe("Архив");
  });
});
