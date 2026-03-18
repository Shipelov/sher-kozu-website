import { describe, expect, it } from "vitest";
import fs from "node:fs";

const homeSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Home.tsx", "utf8");
const dashboardSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Dashboard.tsx", "utf8");
const trackerSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/ProductTracker.tsx", "utf8");
const clubSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/ClubFeed.tsx", "utf8");
const appSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/App.tsx", "utf8");
const navbarSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/components/Navbar.tsx", "utf8");
const dashboardLayoutSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/components/DashboardLayout.tsx", "utf8");
const adminHubSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AdminHub.tsx", "utf8");
const adminAnimalsSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AdminAnimals.tsx", "utf8");
const animalsCatalogSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AnimalsCatalog.tsx", "utf8");
const animalProfileSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AnimalProfile.tsx", "utf8");
const animalShareCardSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/components/AnimalShareCard.tsx", "utf8");
const shareSelectionPreviewCardSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/components/ShareSelectionPreviewCard.tsx", "utf8");

describe("page visual integration source smoke", () => {
  it("keeps consumer-first hero narrative, gallery CTA and the in-page animal gallery on home", () => {
    expect(homeSource).toContain("sherkozu_family_farm_hero");
    expect(homeSource).toContain("Выберите животное,");
    expect(homeSource).toContain("Открыть галерею животных");
    expect(homeSource).toContain("Главная теперь объясняет не «всё обо всём», а один ясный сценарий: понять продукт, выбрать животное, увидеть долю, войти во владение.");
    expect(homeSource).toContain("featuredAnimalProfileHref");
    expect(homeSource).toContain("Животное недели");
    expect(homeSource).toContain("AnimalShareCard");
    expect(homeSource).toContain('ctaHref={`${featuredAnimalProfileHref}?share=${featuredAnimalPrimarySharePercent}`}');
    expect(homeSource).toContain('id="animal-gallery"');
    expect(homeSource).toContain("Галерея животных");
    expect(homeSource).toContain("Открыть всю галерею животных");
    expect(homeSource).toContain("Перейти к галерее на странице");
    expect(homeSource).toContain("Открыть весь каталог животных");
    expect(homeSource).toContain("/animals#goats");
    expect(homeSource).toContain("/animals#sheep");
    expect(homeSource).toContain("B2B и партнёрства");
    expect(homeSource).toContain("Открыть партнёрскую форму");
    expect(homeSource).toContain("Короткая партнёрская заявка");
    expect(homeSource).toContain("вторичн");
  });

  it("keeps premium farm and dairy box imagery on dashboard", () => {
    expect(dashboardSource).toContain("sherkozu_family_farm_hero");
    expect(dashboardSource).toContain("sherkozu_named_dairy_box");
    expect(dashboardSource).toContain("Цифровое сердце Sher Kozu");
    expect(dashboardSource).toContain("featuredAnimalProfileHref");
    expect(dashboardSource).toContain("один ownership journey");
    expect(dashboardSource).toContain("Профиль {featuredAnimalName}");
    expect(dashboardSource).toContain("Dashboard → Profile → Tracker → Club");
  });

  it("keeps named dairy storytelling and dynamic animal route in product tracker", () => {
    expect(trackerSource).toContain("sherkozu_named_dairy_box");
    expect(trackerSource).toContain("featuredAnimalProfileHref");
    expect(trackerSource).toContain("Трекер показывает, как");
  });

  it("keeps club hero imagery and dynamic animal CTA in club feed", () => {
    expect(clubSource).toContain("sherkozu_club_visit");
    expect(clubSource).toContain("/tracker");
    expect(clubSource).toContain("const profileHref = `/animals/${activeAnimalSlug}`;");
    expect(clubSource).toContain("Клуб Шерь Козу удерживает связь");
  });

  it("registers universal animal profile routes in app", () => {
    expect(appSource).toContain('path="/animal/:slug"');
    expect(appSource).toContain('path="/animals/:slug"');
    expect(appSource).toContain('path="/admin"');
    expect(appSource).toContain("component={AnimalProfile}");
    expect(appSource).toContain("component={AdminHub}");
    expect(appSource).toContain("function normalizeRoutePath");
    expect(appSource).toContain("pathname\n    .split(\"/\")");
    expect(appSource).toContain("segment.replace(/%20+$/g");
    expect(appSource).toContain("<RouteNormalizer />");
  });

  it("keeps navbar entry dynamic for the current featured animal", () => {
    expect(navbarSource).toContain("trpc.animals.listPublic.useQuery");
    expect(navbarSource).toContain("featuredAnimalHref");
    expect(navbarSource).toContain("онлайн");
  });

  it("shows admin-only entries and current role in the shared dashboard layout", () => {
    expect(dashboardLayoutSource).toContain('label: "Admin Overview"');
    expect(dashboardLayoutSource).toContain('label: "Admin Animals"');
    expect(dashboardLayoutSource).toContain('label: "Admin Club"');
    expect(dashboardLayoutSource).toContain('user?.role === "admin"');
    expect(dashboardLayoutSource).toContain('{roleLabel}');
  });

  it("shows admin overview cards, live counters and quick actions on the admin page", () => {
    expect(adminHubSource).toContain("Служебный центр управления Sher Kozu");
    expect(adminHubSource).toContain("Страница `/admin`");
    expect(adminHubSource).toContain("Admin Animals");
    expect(adminHubSource).toContain("Admin Club");
    expect(adminHubSource).toContain("Роль:");
    expect(adminHubSource).toContain("Доступ открыт");
    expect(adminHubSource).toContain("Живой счётчик карточек из adminAnimals.list");
    expect(adminHubSource).toContain("Опубликовано:");
    expect(adminHubSource).toContain("Скрыто:");
    expect(adminHubSource).toContain("В архиве:");
    expect(adminHubSource).toContain("/admin/animals?status=published");
    expect(adminHubSource).toContain("/admin/animals?status=hidden");
    expect(adminHubSource).toContain("/admin/animals?status=archived");
    expect(adminHubSource).toContain("Посты, события и участники из adminClub.dashboard");
    expect(adminHubSource).toContain("Открыть каталог животных");
    expect(adminHubSource).toContain("Открыть управление клубом");
  });

  it("shows explicit auth, role diagnostics, share metrics and admin fallbacks on admin animals page", () => {
    expect(adminAnimalsSource).toContain("Маршрут `/admin/animals` доступен только после авторизации.");
    expect(adminAnimalsSource).toContain("NOT_ADMIN_ERR_MSG");
    expect(adminAnimalsSource).toContain("Войти и открыть админку животных");
    expect(adminAnimalsSource).toContain("Роль:");
    expect(adminAnimalsSource).toContain("Распределение долей");
    expect(adminAnimalsSource).toContain("Слоты 10%");
    expect(adminAnimalsSource).toContain("Шаг продажи:");
    expect(adminAnimalsSource).toContain("фактическое распределение 10%-долей");
  });

  it("renders animal gallery with separate goats and sheep sections, relationship statuses and links to full profiles", () => {
    expect(animalsCatalogSource).toContain("Галерея животных");
    expect(animalsCatalogSource).toContain("Козы");
    expect(animalsCatalogSource).toContain("Овцы");
    expect(animalsCatalogSource).toContain('id="goats"');
    expect(animalsCatalogSource).toContain('id="sheep"');
    expect(animalsCatalogSource).toContain("В отношениях");
    expect(animalsCatalogSource).toContain("На выданье");
    expect(animalsCatalogSource).toContain("Доступно для участия");
    expect(animalsCatalogSource).toContain("occupiedUntilLabel={availability.occupiedUntilLabel}");
    expect(animalsCatalogSource).toContain("occupiedUntil");
    expect(animalsCatalogSource).toContain("goatFilter");
    expect(animalsCatalogSource).toContain("sheepFilter");
    expect(animalsCatalogSource).toContain("getRelationshipStatus");
    expect(animalsCatalogSource).toContain("Открыть профиль и продолжить с выбранной долей");
    expect(animalsCatalogSource).toContain("AnimalShareCard");
    expect(animalsCatalogSource).toContain("occupiedUntilLabel={availability.occupiedUntilLabel}");
    expect(animalsCatalogSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalsCatalogSource).toContain('const matchesSelectedShare = hasSelectedShare && shareSummary.availableSharePercents.includes(selectedSharePercent)');
    expect(animalsCatalogSource).toContain('Выбрано {selectedSharePercent}%');
    expect(animalsCatalogSource).toContain('ctaHref={`/animals/${animal.slug}?share=${shareSummary.primarySharePercent}`}');
    expect(animalsCatalogSource).toContain('ctaAsButton');
    expect(shareSelectionPreviewCardSource).toContain('ctaHref && !ctaAsButton');
  });

  it("keeps animal profile focused on one share-selection flow without plan and duration branching", () => {
    expect(animalProfileSource).toContain("AnimalShareCard");
    expect(animalProfileSource).toContain("Статус, доля и цена");
    expect(animalProfileSource).toContain("Пока вы знакомитесь с профилем и выбираете долю. Действия владельца откроются сразу после оформления участия.");
    expect(animalProfileSource).toContain("У вас уже есть ${mySharePercent}% участия");
    expect(animalProfileSource).toContain("Продолжить с выбранной долей");
    expect(animalProfileSource).toContain("Увеличить свою долю");
    expect(animalProfileSource).toContain("Выбрать долю участия");
    expect(animalProfileSource).toContain("Посмотреть дневник и уход");
    expect(animalProfileSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalProfileSource).toContain('params.set("share", String(selectedSharePercent))');
    expect(animalProfileSource).not.toContain("План участия");
    expect(animalProfileSource).not.toContain("Срок участия");
    expect(animalProfileSource).not.toContain("setSelectedPlanId");
    expect(animalProfileSource).not.toContain("setSelectedPlanDurationId");
  });

  it("keeps a shared animal share card and share-selection preview component as the single source of UI for home, catalog and animal profile", () => {
    expect(animalShareCardSource).toContain("Статус, доля и цена");
    expect(animalShareCardSource).toContain("occupiedUntilLabel");
    expect(animalShareCardSource).toContain("Стартовая доля");
    expect(shareSelectionPreviewCardSource).toContain("Выбор доли участия");
    expect(shareSelectionPreviewCardSource).toContain("Передвигайте ползунок шагом");
    expect(shareSelectionPreviewCardSource).toContain("Стартовая доля");
    expect(shareSelectionPreviewCardSource).toContain("Формат по умолчанию");
    expect(shareSelectionPreviewCardSource).toContain("Выбор доли участия");
    expect(shareSelectionPreviewCardSource).toContain("Свободных долей сейчас нет");
  });

  it("preserves the full consumer path from home to gallery, animal profile and share selection", () => {
    expect(homeSource).toContain('id="animal-gallery"');
    expect(homeSource).toContain("Открыть всю галерею животных");
    expect(homeSource).toContain("AnimalShareCard");
    expect(homeSource).toContain('ctaHref={`${featuredAnimalProfileHref}?share=${featuredAnimalPrimarySharePercent}`}');

    expect(animalsCatalogSource).toContain("Галерея животных");
    expect(animalsCatalogSource).toContain("Открыть профиль и продолжить с выбранной долей");
    expect(animalsCatalogSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalsCatalogSource).toContain('ctaHref={`/animals/${animal.slug}?share=${shareSummary.primarySharePercent}`}');

    expect(animalProfileSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalProfileSource).toContain('params.set("share", String(selectedSharePercent))');
    expect(animalProfileSource).toContain("Продолжить с выбранной долей");
    expect(animalProfileSource).toContain("Выбрать долю участия");
    expect(animalProfileSource).toContain("Управление галереей откроется после оформления доли");

    expect(shareSelectionPreviewCardSource).toContain("Выбор доли участия");
    expect(shareSelectionPreviewCardSource).toContain("Передвигайте ползунок шагом");
    expect(shareSelectionPreviewCardSource).toContain("Свободных долей сейчас нет");
  });
});
