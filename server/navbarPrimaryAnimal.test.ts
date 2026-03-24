import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests for Navbar features:
 *
 * 1. Navbar still queries ownerDashboard for primary animal data
 *    (used for authenticated nav items, dashboard link, etc.)
 * 2. The "онлайн" live indicator was intentionally removed from both
 *    desktop and mobile views as a non-functional element.
 * 3. Navbar retains core navigation, auth, and admin features.
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

describe("Navbar: online indicator removed (intentional)", () => {
  it("does NOT contain the desktop online indicator data-testid", () => {
    expect(NAVBAR_SRC).not.toContain('data-testid="navbar-primary-animal"');
  });

  it("does NOT contain the mobile online indicator data-testid", () => {
    expect(NAVBAR_SRC).not.toContain('data-testid="navbar-primary-animal-mobile"');
  });

  it("does NOT contain pulse-dot animation (removed with online indicator)", () => {
    expect(NAVBAR_SRC).not.toContain("pulse-dot");
  });

  it("does NOT show 'онлайн' text anywhere in Navbar", () => {
    expect(NAVBAR_SRC).not.toContain("онлайн");
  });
});

describe("Navbar: core navigation preserved", () => {
  it("has link to animals catalog", () => {
    expect(NAVBAR_SRC).toContain('"/animals"');
    expect(NAVBAR_SRC).toContain("Каталог животных");
  });

  it("has link to about page", () => {
    expect(NAVBAR_SRC).toContain('"/about"');
    expect(NAVBAR_SRC).toContain("О ферме");
  });

  it("has link to club page", () => {
    expect(NAVBAR_SRC).toContain('"/club"');
    expect(NAVBAR_SRC).toContain("Клуб");
  });

  it("has authenticated-only dashboard link", () => {
    expect(NAVBAR_SRC).toContain('"/dashboard"');
    expect(NAVBAR_SRC).toContain("Мой кабинет");
  });

  it("has admin panel link for admin users", () => {
    expect(NAVBAR_SRC).toContain('"/admin"');
    expect(NAVBAR_SRC).toContain("Админ-панель");
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
