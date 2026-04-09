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
    expect(NAVBAR_SRC).toContain("Каталог");
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

  it("has B2B partners link in navbar", () => {
    expect(NAVBAR_SRC).toContain('"/partners"');
    expect(NAVBAR_SRC).toContain('"B2B"');
    expect(NAVBAR_SRC).toContain("Briefcase");
  });

  it("has FAQ link in navbar", () => {
    expect(NAVBAR_SRC).toContain('"/faq"');
    expect(NAVBAR_SRC).toContain('"FAQ"');
  });

  it("has tracker link for authenticated users", () => {
    expect(NAVBAR_SRC).toContain('"/tracker"');
    expect(NAVBAR_SRC).toContain("Трекер");
  });
});

describe("Navbar: fixed button order", () => {
  it("uses a single allNavItems array with fixed order", () => {
    expect(NAVBAR_SRC).toContain("allNavItems");
    expect(NAVBAR_SRC).toContain("visibleNavItems");
    // Should NOT have separate navItems and authNavItems
    expect(NAVBAR_SRC).not.toMatch(/\bconst navItems\b/);
    expect(NAVBAR_SRC).not.toMatch(/\bconst authNavItems\b/);
  });

  it("defines items in correct order: Главная, Мой кабинет, Нутрициология, Цены, Каталог, Трекер, Клуб, О ферме, FAQ, B2B", () => {
    const expectedOrder = [
      "Главная",
      "Мой кабинет",
      "Нутрициология",
      "Цены",
      "Каталог",
      "Трекер",
      "Клуб",
      "О ферме",
      "FAQ",
      "B2B",
    ];
    let lastIndex = -1;
    for (const label of expectedOrder) {
      const idx = NAVBAR_SRC.indexOf(`"${label}"`);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("marks Мой кабинет as authOnly and Трекер as public (demo for guests)", () => {
    // Dashboard requires auth
    const dashboardLine = NAVBAR_SRC.split("\n").find((l: string) => l.includes('"\u041c\u043e\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442"') && l.includes("authOnly"));
    expect(dashboardLine).toContain("authOnly: true");
    // Tracker is now public — demo version shown for guests and users without animals
    const trackerLine = NAVBAR_SRC.split("\n").find((l: string) => l.includes('"\u0422\u0440\u0435\u043a\u0435\u0440"') && l.includes("authOnly"));
    expect(trackerLine).toContain("authOnly: false");
  });

  it("marks B2B as publicly visible (authOnly: false)", () => {
    const b2bLine = NAVBAR_SRC.split("\n").find((l: string) => l.includes('"B2B"'));
    expect(b2bLine).toContain("authOnly: false");
  });

  it("filters visibleNavItems based on authentication state", () => {
    expect(NAVBAR_SRC).toContain("allNavItems.filter");
    expect(NAVBAR_SRC).toContain("!item.authOnly || isAuthenticated");
  });

  it("uses visibleNavItems for mobile rendering", () => {
    const matches = NAVBAR_SRC.match(/visibleNavItems\.map/g);
    // At least 1 occurrence for mobile nav
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("splits items into primary (shown directly) and secondary (in Ещё dropdown)", () => {
    expect(NAVBAR_SRC).toContain("primaryNavItems");
    expect(NAVBAR_SRC).toContain("secondaryNavItems");
    expect(NAVBAR_SRC).toContain("primary: true");
    expect(NAVBAR_SRC).toContain("primary: false");
  });

  it("has Ещё dropdown for secondary items on desktop", () => {
    expect(NAVBAR_SRC).toContain("Ещё");
    expect(NAVBAR_SRC).toContain("moreMenuOpen");
    expect(NAVBAR_SRC).toContain("secondaryNavItems.length > 0");
  });

  it("desktop primary nav uses compact text-only buttons (no icons in primary items)", () => {
    // primaryNavItems.map section should NOT render Icon — only item.label
    // Extract just the primaryNavItems.map block up to the next map/dropdown
    const afterPrimaryMap = NAVBAR_SRC.split("primaryNavItems.map")[1] ?? "";
    const primarySection = afterPrimaryMap.split("secondaryNavItems")[0] ?? "";
    // Primary items render {item.label} without <Icon
    expect(primarySection).toContain("item.label");
    expect(primarySection).not.toContain("<Icon");
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
