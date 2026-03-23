import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for "Primary Animal Indicator in Navbar" feature.
 *
 * When authenticated, the Navbar shows the primary animal name
 * from ownerDashboard data in the live indicator area (desktop)
 * and in the mobile user info section.
 *
 * Covers:
 * 1. Navbar queries ownerDashboard for primary animal
 * 2. Desktop: shows primary animal name with link to profile
 * 3. Mobile: shows primary animal name in user info section
 * 4. Fallback: shows generic animal name for unauthenticated users
 * 5. Invalidation: Navbar updates when primary animal changes
 */

const NAVBAR_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/components/Navbar.tsx"),
  "utf-8",
);
const DASHBOARD_SRC = fs.readFileSync(
  path.resolve(__dirname, "../client/src/pages/Dashboard.tsx"),
  "utf-8",
);

describe("Navbar Primary Animal: data fetching", () => {
  it("queries ownerDashboard for primary animal data", () => {
    expect(NAVBAR_SRC).toContain("trpc.animals.ownerDashboard.useQuery");
  });

  it("only queries ownerDashboard when user is authenticated", () => {
    expect(NAVBAR_SRC).toContain("enabled: isAuthenticated");
  });

  it("extracts primaryAnimal from ownerDashboard data", () => {
    expect(NAVBAR_SRC).toContain("ownerDashboardQuery.data?.animal");
  });

  it("extracts primaryAnimalName from primaryAnimal", () => {
    expect(NAVBAR_SRC).toContain("primaryAnimal?.name");
  });

  it("uses primaryAnimalName as preferred name over generic featured animal", () => {
    expect(NAVBAR_SRC).toContain("primaryAnimalName ?? featuredAnimal?.name");
  });
});

describe("Navbar Primary Animal: desktop indicator", () => {
  it("has data-testid for the primary animal indicator", () => {
    expect(NAVBAR_SRC).toContain('data-testid="navbar-primary-animal"');
  });

  it("shows primary animal name with 'онлайн' suffix", () => {
    expect(NAVBAR_SRC).toContain("{primaryAnimalName} онлайн");
  });

  it("wraps primary animal name in a Link to the animal profile", () => {
    // The link should go to /animals/{slug}
    expect(NAVBAR_SRC).toContain("`/animals/${primaryAnimal?.slug");
  });

  it("has hover effect for the primary animal link", () => {
    expect(NAVBAR_SRC).toContain("hover:text-primary");
  });

  it("only shows linked version for authenticated users with primary animal", () => {
    expect(NAVBAR_SRC).toContain("isAuthenticated && primaryAnimalName");
  });

  it("shows generic fallback for unauthenticated users", () => {
    // The else branch shows featuredAnimalName without a link
    const fallbackSection = NAVBAR_SRC.substring(
      NAVBAR_SRC.indexOf('data-testid="navbar-primary-animal"'),
      NAVBAR_SRC.indexOf('data-testid="navbar-primary-animal"') + 500,
    );
    expect(fallbackSection).toContain("{featuredAnimalName} онлайн");
  });

  it("uses pulse-dot animation for live status", () => {
    expect(NAVBAR_SRC).toContain("pulse-dot");
  });
});

describe("Navbar Primary Animal: mobile indicator", () => {
  it("has data-testid for the mobile primary animal indicator", () => {
    expect(NAVBAR_SRC).toContain('data-testid="navbar-primary-animal-mobile"');
  });

  it("shows primary animal name in mobile user info section", () => {
    const mobileSection = NAVBAR_SRC.substring(
      NAVBAR_SRC.indexOf("navbar-primary-animal-mobile"),
      NAVBAR_SRC.indexOf("navbar-primary-animal-mobile") + 200,
    );
    expect(mobileSection).toContain("{primaryAnimalName} онлайн");
  });

  it("only shows mobile indicator when primaryAnimalName is available", () => {
    expect(NAVBAR_SRC).toContain("{primaryAnimalName && (");
  });

  it("uses pulse-dot in mobile indicator", () => {
    const mobileSection = NAVBAR_SRC.substring(
      NAVBAR_SRC.indexOf("navbar-primary-animal-mobile"),
      NAVBAR_SRC.indexOf("navbar-primary-animal-mobile") + 200,
    );
    expect(mobileSection).toContain("pulse-dot");
  });

  it("mobile indicator is styled with primary color", () => {
    const mobileSection = NAVBAR_SRC.substring(
      NAVBAR_SRC.indexOf("navbar-primary-animal-mobile") - 100,
      NAVBAR_SRC.indexOf("navbar-primary-animal-mobile") + 50,
    );
    expect(mobileSection).toContain("text-primary");
  });
});

describe("Navbar Primary Animal: invalidation integration", () => {
  it("Dashboard invalidates ownerDashboard on setPrimaryAnimal (Navbar will auto-update)", () => {
    expect(DASHBOARD_SRC).toContain("utils.animals.ownerDashboard.invalidate()");
  });

  it("Navbar uses the same ownerDashboard query key as Dashboard", () => {
    // Both use trpc.animals.ownerDashboard — React Query will share the cache
    expect(NAVBAR_SRC).toContain("trpc.animals.ownerDashboard.useQuery");
    expect(DASHBOARD_SRC).toContain("trpc.animals.ownerDashboard.useQuery");
  });
});
