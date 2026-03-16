import { describe, expect, it } from "vitest";
import fs from "node:fs";

const homeSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Home.tsx", "utf8");
const dashboardSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/Dashboard.tsx", "utf8");
const trackerSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/ProductTracker.tsx", "utf8");
const clubSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/pages/ClubFeed.tsx", "utf8");
const appSource = fs.readFileSync("/home/ubuntu/sher-kozu-website/client/src/App.tsx", "utf8");

describe("page visual integration source smoke", () => {
  it("keeps premium hero imagery and dashboard CTA on home", () => {
    expect(homeSource).toContain("sherkozu_family_farm_hero");
    expect(homeSource).toContain("Открыть дашборд владельца");
    expect(homeSource).toContain('href="/dashboard"');
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
    expect(appSource).toContain("component={AnimalProfile}");
  });
});
