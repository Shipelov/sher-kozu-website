import { describe, expect, it } from "vitest";
import fs from "node:fs";

const homeSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Home.tsx", "utf8");
const partnersSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Partners.tsx", "utf8");
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
const aboutFarmSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/AboutFarm.tsx", "utf8");
const shareSelectionPreviewCardSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/components/ShareSelectionPreviewCard.tsx", "utf8");

describe("page visual integration source smoke", () => {
  /* ─── Home.tsx — Redesigned marketing landing ─── */
  it("keeps consumer-first hero with concept explanation and gallery CTA on home", () => {
    // Hero section with concept explanation
    expect(homeSource).toContain("Персональное фермерство");
    expect(homeSource).toContain("Ваша ферма.");
    expect(homeSource).toContain("Ваше молоко.");
    expect(homeSource).toContain("Ваша история.");
    expect(homeSource).toContain("Выбрать животное");
    expect(homeSource).toContain("Как это устроено");

    // Trust signals
    expect(homeSource).toContain("здоровое питание");
    expect(homeSource).toContain("основатель фермы");
    expect(homeSource).toContain("прозрачность");
    expect(homeSource).toContain("сервис");
    expect(homeSource).toContain("семей");

    // How it works section
    expect(homeSource).toContain('id="how-it-works"');
    expect(homeSource).toContain("Выберите своё животное");
    expect(homeSource).toContain("Наблюдайте за жизнью на ферме");
    expect(homeSource).toContain("Получайте именные продукты");

    // Audience segments
    expect(homeSource).toContain("Семьи с детьми");
    expect(homeSource).toContain("Ценители качества");
    expect(homeSource).toContain("Дарители уникальных подарков");
    expect(homeSource).toContain("Участники закрытого клуба");

    // Values section with social proof
    expect(homeSource).toContain("Эмоциональная связь");
    expect(homeSource).toContain("Радикальная прозрачность");
    expect(homeSource).toContain("Элитные породы");
    expect(homeSource).toContain("Доставка до двери");
    expect(homeSource).toContain("Отзывы участников");

    // Product preview
    expect(homeSource).toContain("Что внутри именной коробки");
    expect(homeSource).toContain("Свежее молоко");
    expect(homeSource).toContain("Именные сыры");
    expect(homeSource).toContain("Сезонные наборы");

    // Final CTA
    expect(homeSource).toContain("Начните сейчас");
    expect(homeSource).toContain("Станьте частью первого в России клуба персонального фермерства");
  });

  it("does NOT contain old home elements (animal of the week, inline partner form, ecosystem routes)", () => {
    // Old animal of the week section removed
    expect(homeSource).not.toContain("Животное недели");
    expect(homeSource).not.toContain("AnimalShareCard");
    expect(homeSource).not.toContain("featuredAnimalProfileHref");
    expect(homeSource).not.toContain("featuredAnimalPrimarySharePercent");

    // Old inline partner form removed
    expect(homeSource).not.toContain("partner-lead-form");
    expect(homeSource).not.toContain("Короткая партнёрская заявка");
    expect(homeSource).not.toContain("createPartnerLead");

    // Old ecosystem routes removed
    expect(homeSource).not.toContain("Dashboard владельца");
    expect(homeSource).not.toContain("AI-куратор");
    expect(homeSource).not.toContain("ecosystemRoutes");

    // Internal language removed
    expect(homeSource).not.toContain("community layer");
    expect(homeSource).not.toContain("Биоморфный");
  });

  it("links to /partners from home footer", () => {
    expect(homeSource).toContain('href="/partners"');
    expect(homeSource).toContain("Для партнёров");
  });

  /* ─── AboutFarm.tsx — О ферме page ─── */
  it("renders the About Farm page with family story, philosophy, breeds and gallery", () => {
    // Hero
    expect(aboutFarmSource).toContain("О ферме");
    expect(aboutFarmSource).toContain("Семейная ферма,");
    expect(aboutFarmSource).toContain("где каждое животное — член семьи");

    // Timeline / History
    expect(aboutFarmSource).toContain("Наша история");
    expect(aboutFarmSource).toContain("2019");
    expect(aboutFarmSource).toContain("2024");
    expect(aboutFarmSource).toContain("Клуб «Шерь Козу»");
    expect(aboutFarmSource).toContain("Цифровая ферма");

    // Philosophy
    expect(aboutFarmSource).toContain("Наша философия");
    expect(aboutFarmSource).toContain("Радикальная прозрачность");
    expect(aboutFarmSource).toContain("Эмоциональная связь");
    expect(aboutFarmSource).toContain("Элитная генетика");

    // Breeds
    expect(aboutFarmSource).toContain("Англо-нубийская коза");
    expect(aboutFarmSource).toContain("Альпийская коза");
    expect(aboutFarmSource).toContain("Остфризская овца");
    expect(aboutFarmSource).toContain("Лаконская овца");

    // Gallery
    expect(aboutFarmSource).toContain("Жизнь на ферме");
    expect(aboutFarmSource).toContain("galleryImages");

    // Values / stats
    expect(aboutFarmSource).toContain("Не масштаб, а глубина");
    expect(aboutFarmSource).toContain("50");
    expect(aboutFarmSource).toContain("семей в клубе");

    // CTA
    expect(aboutFarmSource).toContain("Приезжайте к нам на ферму");
    expect(aboutFarmSource).toContain("Выбрать животное");
  });

  it("registers /about route in App.tsx and adds nav link", () => {
    expect(appSource).toContain('path="/about"');
    expect(appSource).toContain("AboutFarm");
    expect(navbarSource).toContain('"/about"');
    expect(navbarSource).toContain("О ферме");
  });

  /* ─── Partners.tsx — Dedicated partner page ─── */
  it("renders the partner page with CRM form, FAQ, and sync status", () => {
    // Navigation — breadcrumbs replaced the old back link
    expect(partnersSource).toContain("PageBreadcrumbs");
    expect(partnersSource).toContain('href="/"');

    // Hero
    expect(partnersSource).toContain("Партнёрская программа");
    expect(partnersSource).toContain("B2B и партнёрства");
    expect(partnersSource).toContain("Шерь Козу");

    // Form fields
    expect(partnersSource).toContain("partner-full-name");
    expect(partnersSource).toContain("partner-company");
    expect(partnersSource).toContain("partner-email");
    expect(partnersSource).toContain("partner-phone");
    expect(partnersSource).toContain("partner-region");
    expect(partnersSource).toContain("partner-telegram");
    expect(partnersSource).toContain("interestType");
    expect(partnersSource).toContain("preferredContactMethod");

    // Attachment system
    expect(partnersSource).toContain("partner-attachments");
    expect(partnersSource).toContain("appendPartnerAttachments");
    expect(partnersSource).toContain("handlePartnerAttachmentDrop");
    expect(partnersSource).toContain("removePartnerAttachment");
    expect(partnersSource).toContain("MAX_PARTNER_FILES");
    expect(partnersSource).toContain("MAX_PARTNER_FILE_SIZE_BYTES");
    expect(partnersSource).toContain("getPartnerAttachmentKind");
    expect(partnersSource).toContain("getPartnerAttachmentBadge");

    // Consent + submit
    expect(partnersSource).toContain("hasPartnerConsent");
    expect(partnersSource).toContain("Подтверждаю согласие на обработку контактных данных");
    expect(partnersSource).toContain("Отправить заявку");
    expect(partnersSource).toContain("partnerLeads.create");

    // Progress indicator
    expect(partnersSource).toContain("Готовность заявки");
    expect(partnersSource).toContain("partnerFormProgressPercent");

    // FAQ
    expect(partnersSource).toContain("FAQ для партнёров");
    expect(partnersSource).toContain("Какие материалы лучше приложить?");
    expect(partnersSource).toContain("Обязательно ли прикладывать файлы?");
    expect(partnersSource).toContain("Когда ждать ответ?");
    expect(partnersSource).toContain("Какие продукты доступны для партнёров?");
    expect(partnersSource).toContain("В каких регионах работает доставка?");

    // Sync status
    expect(partnersSource).toContain("Статус заявки");
    expect(partnersSource).toContain("latestSubmission");
    expect(partnersSource).toContain("syncStatus");
    expect(partnersSource).toContain("bitrixDealId");
    expect(partnersSource).toContain("assignedManagerName");

    // Attachment recommendations per interest type
    expect(partnersSource).toContain("partnerAttachmentRecommendations");
    expect(partnersSource).toContain("Для retail-заявки");
    expect(partnersSource).toContain("Для HoReCa-партнёрства");
    expect(partnersSource).toContain("Для дистрибуции");
    expect(partnersSource).toContain("Для коллаборации");
  });

  /* ─── App.tsx — Route registration ─── */
  it("registers /partners route in App.tsx", () => {
    expect(appSource).toContain('path="/partners"');
    expect(appSource).toContain("component={Partners}");
    expect(appSource).toContain("import Partners");
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

  /* ─── Dashboard ─── */
  it("keeps premium farm and dairy box imagery on dashboard", () => {
    expect(dashboardSource).toContain("sherkozu_family_farm_hero");
    expect(dashboardSource).toContain("sherkozu_named_dairy_box");
    expect(dashboardSource).toContain("sherkozu_family_farm_hero");
    expect(dashboardSource).toContain("featuredAnimalProfileHref");
    expect(dashboardSource).toContain("Профиль {featuredAnimalName}");
    expect(dashboardSource).toContain("dashboardGuestPreview");
    expect(dashboardSource).toContain("dashboardGuestPreview");
    expect(dashboardSource).toContain("dashboardGuestLockedParticipation");
    expect(dashboardSource).toContain("dashboardGuestLockedQuickLinks");
    expect(dashboardSource).toContain("dashboardGuestStickyRegister");
    expect(dashboardSource).toContain('setAuthModalOpen(true)');
  });

  /* ─── Tracker ─── */
  it("keeps named dairy storytelling and dynamic animal route in product tracker", () => {
    expect(trackerSource).toContain("sherkozu_named_dairy_box");
    expect(trackerSource).toContain("featuredAnimalProfileHref");
    expect(trackerSource).toContain("Путь продукта: от");
    expect(trackerSource).toContain("Как начать");
    expect(trackerSource).toContain("Трекер → Профиль животного → Вход → Личный кабинет");
  });

  /* ─── Club ─── */
  it("keeps club hero imagery and dynamic animal CTA in club feed", () => {
    expect(clubSource).toContain("sherkozu_club_visit");
    expect(clubSource).toContain("/tracker");
    expect(clubSource).toContain("const profileHref = `/animals/${activeAnimalSlug}`;");
    expect(clubSource).toContain("Клуб Шерь Козу — сообщество семей");
    expect(clubSource).toContain("Как присоединиться");
    expect(clubSource).toContain("Клуб → Профиль животного → Выбор доли → Вход");
  });

  /* ─── Navbar ─── */
  it("uses static catalog link and shows featured animal status", () => {
    expect(navbarSource).toContain("trpc.animals.listPublic.useQuery");
    expect(navbarSource).toContain('"/animals"');
    expect(navbarSource).toContain("Каталог животных");
    expect(navbarSource).toContain("онлайн");
  });

  /* ─── Admin layout ─── */
  it("shows admin-only entries and current role in the shared dashboard layout", () => {
    expect(dashboardLayoutSource).toContain('label: "Admin Overview"');
    expect(dashboardLayoutSource).toContain('label: "Admin Animals"');
    expect(dashboardLayoutSource).toContain('label: "Admin Club"');
    expect(dashboardLayoutSource).toContain('user?.role === "admin"');
    expect(dashboardLayoutSource).toContain('{roleLabel}');
  });

  /* ─── Admin hub ─── */
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

  /* ─── Admin animals ─── */
  it("shows explicit auth, role diagnostics, share metrics and admin fallbacks on admin animals page", () => {
    expect(adminAnimalsSource).toContain("Маршрут `/admin/animals` доступен только после авторизации.");
    expect(adminAnimalsSource).toContain("NOT_ADMIN_ERR_MSG");
    expect(adminAnimalsSource).toContain("Войти и открыть админку животных");
    expect(adminAnimalsSource).toContain("Роль:");
    expect(adminAnimalsSource).toContain("Распределение долей");
    expect(adminAnimalsSource).toContain("bg-emerald-500");
    expect(adminAnimalsSource).toContain("bg-stone-200");
    expect(adminAnimalsSource).toContain("фактическое распределение 10%-долей");
  });

  /* ─── Animals catalog ─── */
  it("renders animal gallery with separate goats and sheep sections, relationship statuses and links to full profiles", () => {
    expect(animalsCatalogSource).toContain("Каталог животных");
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
    expect(animalsCatalogSource).toContain("Познакомиться и выбрать долю");
    expect(animalsCatalogSource).toContain("AnimalShareCard");
    expect(animalsCatalogSource).toContain("occupiedUntilLabel={availability.occupiedUntilLabel}");
    expect(animalsCatalogSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalsCatalogSource).toContain('const matchesSelectedShare = hasSelectedShare && shareSummary.availableSharePercents.includes(selectedSharePercent)');
    expect(animalsCatalogSource).toContain('Выбрано {selectedSharePercent}%');
    expect(animalsCatalogSource).toContain('ctaHref={`/animals/${animal.slug}?share=${shareSummary.primarySharePercent}`}');
    expect(animalsCatalogSource).toContain('ctaAsButton');
    expect(shareSelectionPreviewCardSource).toContain('ctaHref && !ctaAsButton');
  });

  /* ─── Animal profile ─── */
  it("keeps animal profile focused on one share-selection flow without plan and duration branching", () => {
    expect(animalProfileSource).toContain("AnimalShareCard");
    expect(animalProfileSource).toContain("Персональное участие");
    expect(animalProfileSource).toContain("Станьте частью истории");
    expect(animalProfileSource).toContain("mySharePercent");
    expect(animalProfileSource).toContain("Увеличить свою долю");
    expect(animalProfileSource).toContain("Забронировать долю");
    expect(animalProfileSource).toContain("Дневник");
    expect(animalProfileSource).toContain("Паспорт");
    expect(animalProfileSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalProfileSource).toContain('params.set("share", String(selectedSharePercent))');
    expect(animalProfileSource).not.toContain("План участия");
    expect(animalProfileSource).not.toContain("Срок участия");
    expect(animalProfileSource).not.toContain("setSelectedPlanId");
    expect(animalProfileSource).not.toContain("setSelectedPlanDurationId");
  });

  /* ─── Shared components ─── */
  it("keeps a shared animal share card and share-selection preview component as the single source of UI for catalog and animal profile", () => {
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

  /* ─── Full consumer path: catalog → profile → share selection ─── */
  it("preserves the full consumer path from catalog to animal profile and share selection", () => {
    // Home links to /animals
    expect(homeSource).toContain('href="/animals"');
    expect(homeSource).toContain("Выбрать животное");

    // Catalog has full gallery with share selection
    expect(animalsCatalogSource).toContain("Каталог животных");
    expect(animalsCatalogSource).toContain("Познакомиться и выбрать долю");
    expect(animalsCatalogSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalsCatalogSource).toContain('ctaHref={`/animals/${animal.slug}?share=${shareSummary.primarySharePercent}`}');

    // Profile has share selection and booking
    expect(animalProfileSource).toContain('new URLSearchParams(window.location.search).get("share")');
    expect(animalProfileSource).toContain('params.set("share", String(selectedSharePercent))');
    expect(animalProfileSource).toContain("Забронировать долю");
    expect(animalProfileSource).toContain("Персональное участие");
    expect(animalProfileSource).toContain("Управление галереей доступно владельцам доли");

    // Shared components
    expect(shareSelectionPreviewCardSource).toContain("Выбор доли участия");
    expect(shareSelectionPreviewCardSource).toContain("Передвигайте ползунок шагом");
    expect(shareSelectionPreviewCardSource).toContain("Свободных долей сейчас нет");
  });
});
