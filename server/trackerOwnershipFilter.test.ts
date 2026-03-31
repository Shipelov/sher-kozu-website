import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Tests that the ProductTracker animal switcher only shows animals
 * the user actually owns (has active/pending_payment shares),
 * NOT all public animals from the catalog.
 *
 * Bug: Previously, the switcher used trpc.animals.listPublic.useQuery()
 * which returned ALL farm animals (including Лола without ownership).
 * Fix: Use ownerDashboardQuery.data.allOwnerships instead.
 */

const TRACKER_SRC = readFileSync(
  resolve(__dirname, "../client/src/pages/ProductTracker.tsx"),
  "utf-8",
);

describe("ProductTracker: Animal switcher only shows owned animals", () => {
  it("does NOT use trpc.animals.listPublic for the switcher", () => {
    // The tracker should not fetch all public animals — that would show
    // animals without ownership (e.g. Лола) in the dropdown
    expect(TRACKER_SRC).not.toContain("trpc.animals.listPublic.useQuery()");
  });

  it("derives owned animals list from ownerDashboard allOwnerships", () => {
    expect(TRACKER_SRC).toContain("ownerDashboardQuery.data?.allOwnerships");
  });

  it("uses ownedAnimals variable for the switcher dropdown", () => {
    expect(TRACKER_SRC).toContain("ownedAnimals");
    // The switcher should iterate over ownedAnimals, not allAnimalsQuery.data
    expect(TRACKER_SRC).toContain("ownedAnimals.map((animal)");
  });

  it("switcher visibility depends on ownedAnimals.length > 1", () => {
    expect(TRACKER_SRC).toContain("ownedAnimals.length > 1");
  });

  it("uses animalSlug field from allOwnerships shape (not slug)", () => {
    // allOwnerships items have { animalSlug, animalName, species, breed, coverImageUrl }
    expect(TRACKER_SRC).toContain("animal.animalSlug");
    expect(TRACKER_SRC).toContain("animal.animalName");
  });

  it("navigates to /tracker?animal=<slug> on switcher item click", () => {
    expect(TRACKER_SRC).toContain("`/tracker?animal=${animal.animalSlug}`");
  });

  it("compares active state using animalSlug field", () => {
    expect(TRACKER_SRC).toContain("animal.animalSlug === currentAnimalSlug");
  });
});
