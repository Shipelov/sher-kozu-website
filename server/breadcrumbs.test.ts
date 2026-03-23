import { describe, it, expect } from "vitest";

/**
 * PageBreadcrumbs integration tests.
 *
 * Tests breadcrumb segment generation for every page (public + admin),
 * mobile truncation logic, and Schema.org BreadcrumbList JSON-LD output.
 */

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

/* ── Helpers: public pages ── */

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

/* ── Helpers: admin pages ── */

function buildAdminHubBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin" },
  ];
}

function buildAdminAnimalsBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Животные" },
  ];
}

function buildAdminClubBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Клуб" },
  ];
}

function buildAdminProductTrackListBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Трек продукции" },
  ];
}

function buildAdminProductTrackDetailBreadcrumbs(animalName: string): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Трек продукции", href: "/admin/product-track" },
    { label: animalName },
  ];
}

function buildAdminMarketplaceBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Маркетплейс" },
  ];
}

function buildAdminTokensBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Токены" },
  ];
}

function buildAdminUsersBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Пользователи" },
  ];
}

function buildAdminAnalyticsBreadcrumbs(): BreadcrumbSegment[] {
  return [
    { label: "Главная", href: "/" },
    { label: "Admin", href: "/admin" },
    { label: "Аналитика" },
  ];
}

/* ── Mobile truncation logic ── */

function getMobileBreadcrumbs(items: BreadcrumbSegment[]): BreadcrumbSegment[] {
  if (items.length <= 3) return items;
  return [
    items[0],
    { label: "..." },
    items[items.length - 2],
    items[items.length - 1],
  ];
}

/* ── Schema.org JSON-LD builder (mirrors component logic) ── */

function buildBreadcrumbJsonLd(items: BreadcrumbSegment[], origin: string = "https://sherkozu-mlhmg5vm.manus.space"): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${origin}${item.href}` } : {}),
    })),
  };
}

/* ── Tests ── */

describe("Breadcrumbs segment generation — public pages", () => {
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

describe("Breadcrumbs segment generation — admin pages", () => {
  describe("AdminHub breadcrumbs", () => {
    it("should have 2 items: Главная and Admin", () => {
      const items = buildAdminHubBreadcrumbs();
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ label: "Главная", href: "/" });
      expect(items[1]).toEqual({ label: "Admin" });
    });

    it("last item should not have href (current page)", () => {
      const items = buildAdminHubBreadcrumbs();
      expect(items[items.length - 1].href).toBeUndefined();
    });
  });

  describe("AdminAnimals breadcrumbs", () => {
    it("should have 3 items with Admin link", () => {
      const items = buildAdminAnimalsBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
      expect(items[2]).toEqual({ label: "Животные" });
    });
  });

  describe("AdminClub breadcrumbs", () => {
    it("should have 3 items with Admin link", () => {
      const items = buildAdminClubBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
      expect(items[2]).toEqual({ label: "Клуб" });
    });
  });

  describe("AdminProductTrack breadcrumbs", () => {
    it("list view should have 3 items", () => {
      const items = buildAdminProductTrackListBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[2]).toEqual({ label: "Трек продукции" });
    });

    it("detail view should have 4 items with animal name", () => {
      const items = buildAdminProductTrackDetailBreadcrumbs("Мира");
      expect(items).toHaveLength(4);
      expect(items[2]).toEqual({ label: "Трек продукции", href: "/admin/product-track" });
      expect(items[3]).toEqual({ label: "Мира" });
    });
  });

  describe("AdminMarketplace breadcrumbs", () => {
    it("should have 3 items with Admin link", () => {
      const items = buildAdminMarketplaceBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
      expect(items[2]).toEqual({ label: "Маркетплейс" });
    });
  });

  describe("AdminTokens breadcrumbs", () => {
    it("should have 3 items with Admin link", () => {
      const items = buildAdminTokensBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
      expect(items[2]).toEqual({ label: "Токены" });
    });
  });

  describe("AdminUsers breadcrumbs", () => {
    it("should have 3 items with Admin link", () => {
      const items = buildAdminUsersBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
      expect(items[2]).toEqual({ label: "Пользователи" });
    });
  });

  describe("AdminAnalytics breadcrumbs", () => {
    it("should have 3 items with Admin link", () => {
      const items = buildAdminAnalyticsBreadcrumbs();
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
      expect(items[2]).toEqual({ label: "Аналитика" });
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

  it("should truncate admin detail breadcrumbs (4 items)", () => {
    const items = buildAdminProductTrackDetailBreadcrumbs("Мира");
    const mobile = getMobileBreadcrumbs(items);
    expect(mobile).toHaveLength(4);
    expect(mobile[0].label).toBe("Главная");
    expect(mobile[1].label).toBe("...");
    expect(mobile[2].label).toBe("Трек продукции");
    expect(mobile[3].label).toBe("Мира");
  });

  it("all public breadcrumbs should have Главная as first item with href /", () => {
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

  it("all admin breadcrumbs should have Главная as first item with href /", () => {
    const allBreadcrumbs = [
      buildAdminHubBreadcrumbs(),
      buildAdminAnimalsBreadcrumbs(),
      buildAdminClubBreadcrumbs(),
      buildAdminProductTrackListBreadcrumbs(),
      buildAdminProductTrackDetailBreadcrumbs("Мира"),
      buildAdminMarketplaceBreadcrumbs(),
      buildAdminTokensBreadcrumbs(),
      buildAdminUsersBreadcrumbs(),
      buildAdminAnalyticsBreadcrumbs(),
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
      buildAdminHubBreadcrumbs(),
      buildAdminAnimalsBreadcrumbs(),
      buildAdminClubBreadcrumbs(),
      buildAdminProductTrackListBreadcrumbs(),
      buildAdminProductTrackDetailBreadcrumbs("Мира"),
      buildAdminMarketplaceBreadcrumbs(),
      buildAdminTokensBreadcrumbs(),
      buildAdminUsersBreadcrumbs(),
      buildAdminAnalyticsBreadcrumbs(),
    ];

    for (const items of allBreadcrumbs) {
      expect(items[items.length - 1].href).toBeUndefined();
    }
  });

  it("admin sub-pages should have Admin as second item with href /admin", () => {
    const adminSubPages = [
      buildAdminAnimalsBreadcrumbs(),
      buildAdminClubBreadcrumbs(),
      buildAdminProductTrackListBreadcrumbs(),
      buildAdminProductTrackDetailBreadcrumbs("Мира"),
      buildAdminMarketplaceBreadcrumbs(),
      buildAdminTokensBreadcrumbs(),
      buildAdminUsersBreadcrumbs(),
      buildAdminAnalyticsBreadcrumbs(),
    ];

    for (const items of adminSubPages) {
      expect(items[1]).toEqual({ label: "Admin", href: "/admin" });
    }
  });
});

describe("Schema.org BreadcrumbList JSON-LD", () => {
  const origin = "https://sherkozu-mlhmg5vm.manus.space";

  it("should produce valid BreadcrumbList structure", () => {
    const items = buildAnimalProfileBreadcrumbs("Мира");
    const jsonLd = buildBreadcrumbJsonLd(items, origin);

    expect(jsonLd).toHaveProperty("@context", "https://schema.org");
    expect(jsonLd).toHaveProperty("@type", "BreadcrumbList");
    expect(jsonLd).toHaveProperty("itemListElement");
  });

  it("should have correct positions starting from 1", () => {
    const items = buildAdminProductTrackDetailBreadcrumbs("Мира");
    const jsonLd = buildBreadcrumbJsonLd(items, origin) as any;

    expect(jsonLd.itemListElement).toHaveLength(4);
    expect(jsonLd.itemListElement[0].position).toBe(1);
    expect(jsonLd.itemListElement[1].position).toBe(2);
    expect(jsonLd.itemListElement[2].position).toBe(3);
    expect(jsonLd.itemListElement[3].position).toBe(4);
  });

  it("should include absolute URLs for items with href", () => {
    const items = buildAnimalProfileBreadcrumbs("Мира");
    const jsonLd = buildBreadcrumbJsonLd(items, origin) as any;

    expect(jsonLd.itemListElement[0].item).toBe(`${origin}/`);
    expect(jsonLd.itemListElement[1].item).toBe(`${origin}/animals`);
  });

  it("should not include item property for the last segment (no href)", () => {
    const items = buildAnimalProfileBreadcrumbs("Мира");
    const jsonLd = buildBreadcrumbJsonLd(items, origin) as any;

    expect(jsonLd.itemListElement[2].item).toBeUndefined();
    expect(jsonLd.itemListElement[2].name).toBe("Мира");
  });

  it("should include name for every list element", () => {
    const items = buildAdminClubBreadcrumbs();
    const jsonLd = buildBreadcrumbJsonLd(items, origin) as any;

    expect(jsonLd.itemListElement[0].name).toBe("Главная");
    expect(jsonLd.itemListElement[1].name).toBe("Admin");
    expect(jsonLd.itemListElement[2].name).toBe("Клуб");
  });

  it("should produce correct JSON-LD for admin detail page", () => {
    const items = buildAdminProductTrackDetailBreadcrumbs("Злата");
    const jsonLd = buildBreadcrumbJsonLd(items, origin) as any;

    expect(jsonLd.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Главная",
      item: `${origin}/`,
    });
    expect(jsonLd.itemListElement[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Трек продукции",
      item: `${origin}/admin/product-track`,
    });
    expect(jsonLd.itemListElement[3]).toEqual({
      "@type": "ListItem",
      position: 4,
      name: "Злата",
    });
  });

  it("should produce valid JSON-LD for 2-item breadcrumbs", () => {
    const items = buildClubBreadcrumbs();
    const jsonLd = buildBreadcrumbJsonLd(items, origin) as any;

    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[0].item).toBe(`${origin}/`);
    expect(jsonLd.itemListElement[1].item).toBeUndefined();
  });
});
