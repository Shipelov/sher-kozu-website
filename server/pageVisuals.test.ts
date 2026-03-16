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

describe("page visual integration source smoke", () => {
  it("keeps premium hero imagery and dynamic animal CTA on home", () => {
    expect(homeSource).toContain("sherkozu_family_farm_hero");
    expect(homeSource).toContain("Открыть дашборд владельца");
    expect(homeSource).toContain("featuredAnimalProfileHref");
    expect(homeSource).toContain("Животное недели");
    expect(homeSource).toContain("Галерея животных");
    expect(homeSource).toContain("/animals#goats");
    expect(homeSource).toContain("/animals#sheep");
  });

  it("keeps premium farm and dairy box imagery on dashboard", () => {
    expect(dashboardSource).toContain("sherkozu_family_farm_hero");
    expect(dashboardSource).toContain("sherkozu_named_dairy_box");
    expect(dashboardSource).toContain("Цифровое сердце Sher Kozu");
    expect(dashboardSource).toContain("featuredAnimalProfileHref");
  });

  it("keeps named dairy storytelling and dynamic animal route in product tracker", () => {
    expect(trackerSource).toContain("sherkozu_named_dairy_box");
    expect(trackerSource).toContain("featuredAnimalProfileHref");
    expect(trackerSource).toContain("Трекер показывает, как");
  });

  it("keeps club hero imagery and dynamic animal CTA in club feed", () => {
    expect(clubSource).toContain("sherkozu_club_visit");
    expect(clubSource).toContain("/tracker");
    expect(clubSource).toContain("featuredAnimalProfileHref");
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

  it("shows explicit auth, role diagnostics and admin fallbacks on admin animals page", () => {
    expect(adminAnimalsSource).toContain("Маршрут `/admin/animals` доступен только после авторизации.");
    expect(adminAnimalsSource).toContain("NOT_ADMIN_ERR_MSG");
    expect(adminAnimalsSource).toContain("Войти и открыть админку животных");
    expect(adminAnimalsSource).toContain("Роль:");
    expect(adminAnimalsSource).toContain("new URLSearchParams(window.location.search)");
    expect(adminAnimalsSource).toContain('params.get("status")');
  });

  it("renders animal gallery with separate goats and sheep sections, status filters and links to full profiles", () => {
    expect(animalsCatalogSource).toContain("Галерея животных");
    expect(animalsCatalogSource).toContain("Козы");
    expect(animalsCatalogSource).toContain("Овцы");
    expect(animalsCatalogSource).toContain('id="goats"');
    expect(animalsCatalogSource).toContain('id="sheep"');
    expect(animalsCatalogSource).toContain("В наличии");
    expect(animalsCatalogSource).toContain("Продано");
    expect(animalsCatalogSource).toContain("goatFilter");
    expect(animalsCatalogSource).toContain("sheepFilter");
    expect(animalsCatalogSource).toContain("Открыть полный профиль");
    expect(animalsCatalogSource).toContain('href={`/animals/${animal.slug}`}');
  });
});
