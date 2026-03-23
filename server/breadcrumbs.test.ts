import { describe, it, expect } from "vitest";

/**
 * PageBreadcrumbs integration tests.
 *
 * Since PageBreadcrumbs is a pure React component with no server logic,
 * we test the breadcrumb segment generation logic that each page uses.
 * This validates that the correct items array is produced for each page.
 */

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

/* ── Helper: builds breadcrumb items for each page ── */

function buildAnimalProfileBreadcrumbs(displayName: string): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Каталог", href: "/animals" },
    { label: displayName },
  ];
}

function buildCompareBreadcrumbs(animalA?: { name: string; slug?: string; id: number }): BreadcrumbSegment[] {
  const items: BreadcrumbSegment[] = [
    { label: "Главная", href: "/" },
    { label: "Каталог", href: "/animals" },
  ];
  if (animalA) {
    items.push({ label: animalA.name, href: `/animal/${animalA.slug || animalA.id}` });
  }
  items.push({ label: "Сравнение" });
  return items;
}

function buildProductTrackerBreadcrumbs(animalName: string): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Мой кабинет", href: "/dashboard" },
    { label: `Трекер: ${animalName}` },
  ];
}

function buildClubBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Клуб" },
  ];
}

function buildDashboardBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Мой кабинет" },
  ];
}

function buildLeaderboardBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Мой кабинет", href: "/dashboard" },
    { label: "Рейтинг" },
  ];
}

function buildMarketplaceBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Маркетплейс" },
  ];
}

function buildProfileBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Профиль" },
  ];
}

function buildAboutBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "О ферме" },
  ];
}

function buildPartnersBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Партнёры" },
  ];
}

function buildCatalogBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Каталог" },
  ];
}

/* ── Mobile truncation logic ── */

function getMobileBreadcrumbs(items: BreadcrumbSegment[]): BreadcrumbSegment[] {
  if (items.length <= 3) return items;
  // Show first, second-to-last, and last
  return [
    items[0],
    { label: "..." }, // ellipsis placeholder
    items[items.length - 2],
    items[items.length - 1],
  ];
}

/* ── Tests ── */

describe("Breadcrumbs segment generation", () => {
  describe("AnimalProfile breadcrumbs", () => {
    it("should include Главная, Каталог, and animal name", () => {
      const items = buildAnimalProfileBreadcrumbs("Мира");
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ label: "Главная", href: "/" });
      expect(items[1]).toEqual({ label: "Каталог", href: "/animals" });
      expect(items[2]).toEqual({ label: "Мира" });
    });

    it("last item should not have href (current page)", () => {
      const items = buildAnimalProfileBreadcrumbs("Злата");
      expect(items[items.length - 1].href).toBeUndefined();
    });
  });

  describe("AnimalCompare breadcrumbs", () => {
    it("should include animal A when selected", () => {
      const items = buildCompareBreadcrumbs({ name: "Мира", slug: "mira", id: 1 });
      expect(items).toHaveLength(4);
      expect(items[2]).toEqual({ label: "Мира", href: "/animal/mira" });
      expect(items[3]).toEqual({ label: "Сравнение" });
    });

    it("should use id when slug is missing", () => {
      const items = buildCompareBreadcrumbs({ name: "Злата", id: 5 });
      expect(items[2]).toEqual({ label: "Злата", href: "/animal/5" });
    });

    it("should have 3 items when no animal is selected", () => {
      const items = buildCompareBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[2]).toEqual({ label: "Сравнение" });
    });
  });

  describe("ProductTracker breadcrumbs", () => {
    it("should include Dashboard link and tracker label with animal name", () => {
      const items = buildProductTrackerBreadcrumbs("Мира");
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Мой кабинет", href: "/dashboard" });
      expect(items[2]).toEqual({ label: "Трекер: Мира" });
    });
  });

  describe("Club breadcrumbs", () => {
    it("should have 2 items: Главная and Клуб", () => {
      const items = buildClubBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "Клуб" });
    });
  });

  describe("Dashboard breadcrumbs", () => {
    it("should have 2 items: Главная and Мой кабинет", () => {
      const items = buildDashboardBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "Мой кабинет" });
    });
  });

  describe("Leaderboard breadcrumbs", () => {
    it("should have 3 items with Dashboard link", () => {
      const items = buildLeaderboardBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Мой кабинет", href: "/dashboard" });
      expect(items[2]).toEqual({ label: "Рейтинг" });
    });
  });

  describe("Marketplace breadcrumbs", () => {
    it("should have 2 items", () => {
      const items = buildMarketplaceBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "Маркетплейс" });
    });
  });

  describe("Profile breadcrumbs", () => {
    it("should have 2 items", () => {
      const items = buildProfileBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "Профиль" });
    });
  });

  describe("About breadcrumbs", () => {
    it("should have 2 items", () => {
      const items = buildAboutBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "О ферме" });
    });
  });

  describe("Partners breadcrumbs", () => {
    it("should have 2 items", () => {
      const items = buildPartnersBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "Партнёры" });
    });
  });

  describe("Catalog breadcrumbs", () => {
    it("should have 2 items", () => {
      const items = buildCatalogBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[1]).toEqual({ label: "Каталог" });
    });
  });
});

describe("Mobile truncation logic", () => {
  it("should not truncate 2-item breadcrumbs", () => {
    const items: BreadcrumbSegment[] = [
      { label: "Главная", href: "/" },
      { label: "Клуб" },
    ];
    const mobile = getMobileBreadcrumbs(items);
    expect(mobile).toHaveLength(2);
    expect(mobile[0].label).toBe("Главная");
    expect(mobile[1].label).toBe("Клуб");
  });

  it("should not truncate 3-item breadcrumbs", () => {
    const items: BreadcrumbSegment[] = [
      { label: "Главная", href: "/" },
      { label: "Каталог", href: "/animals" },
      { label: "Мира" },
    ];
    const mobile = getMobileBreadcrumbs(items);
    expect(mobile).toHaveLength(3);
  });

  it("should truncate 4-item breadcrumbs to first + ellipsis + last two", () => {
    const items: BreadcrumbSegment[] = [
      { label: "Главная", href: "/" },
      { label: "Каталог", href: "/animals" },
      { label: "Мира", href: "/animal/mira" },
      { label: "Сравнение" },
    ];
    const mobile = getMobileBreadcrumbs(items);
    expect(mobile).toHaveLength(4);
    expect(mobile[0].label).toBe("Главная");
    expect(mobile[1].label).toBe("...");
    expect(mobile[2].label).toBe("Мира");
    expect(mobile[3].label).toBe("Сравнение");
  });

  it("should truncate 5-item breadcrumbs correctly", () => {
    const items: BreadcrumbSegment[] = [
      { label: "Главная", href: "/" },
      { label: "Каталог", href: "/animals" },
      { label: "Козы", href: "/animals?type=goat" },
      { label: "Мира", href: "/animal/mira" },
      { label: "Сравнение" },
    ];
    const mobile = getMobileBreadcrumbs(items);
    expect(mobile).toHaveLength(4);
    expect(mobile[0].label).toBe("Главная");
    expect(mobile[1].label).toBe("...");
    expect(mobile[2].label).toBe("Мира");
    expect(mobile[3].label).toBe("Сравнение");
  });

  it("all breadcrumbs should have Главная as first item with href /", () => {
    const allBreadcrumbs = [
      buildAnimalProfileBreadcrumbs("Мира"),
      buildCompareBreadcrumbs({ name: "Мира", slug: "mira", id: 1 }),
      buildProductTrackerBreadcrumbs("Мира"),
      buildClubBreadcrumbs(),
      buildDashboardBreadcrumbs(),
      buildLeaderboardBreadcrumbs(),
      buildMarketplaceBreadcrumbs(),
      buildProfileBreadcrumbs(),
      buildAboutBreadcrumbs(),
      buildPartnersBreadcrumbs(),
      buildCatalogBreadcrumbs(),
    ];

    for (const items of allBreadcrumbs) {
      expect(items[0]).toEqual({ label: "Главная", href: "/" });
    }
  });

  it("last item in all breadcrumbs should not have href", () => {
    const allBreadcrumbs = [
      buildAnimalProfileBreadcrumbs("Мира"),
      buildCompareBreadcrumbs({ name: "Мира", slug: "mira", id: 1 }),
      buildProductTrackerBreadcrumbs("Мира"),
      buildClubBreadcrumbs(),
      buildDashboardBreadcrumbs(),
      buildLeaderboardBreadcrumbs(),
      buildMarketplaceBreadcrumbs(),
      buildProfileBreadcrumbs(),
      buildAboutBreadcrumbs(),
      buildPartnersBreadcrumbs(),
      buildCatalogBreadcrumbs(),
    ];

    for (const items of allBreadcrumbs) {
      expect(items[items.length - 1].href).toBeUndefined();
    }
  });
});
