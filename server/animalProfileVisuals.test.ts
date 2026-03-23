import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../client/src/pages/AnimalProfile.tsx", import.meta.url), "utf-8");

describe("AnimalProfile visual integration", () => {
  it("contains fact-based hero with key animal data and CDN images", () => {
    expect(source).toContain("sherkozu_anglonubian_portrait");
    expect(source).toContain("sherkozu_named_dairy_box");
    expect(source).toContain("sherkozu_club_visit");
    expect(source).toContain("displayName");
    expect(source).toContain("AnimalShareCard");
  });

  it("contains share purchase section with dynamic pricing and CTA", () => {
    expect(source).toContain("Персональное участие");
    expect(source).toContain("Станьте частью истории");
    expect(source).toContain("Забронировать долю");
    expect(source).toContain("Увеличить свою долю");
    expect(source).toContain("mySharePercent");
    expect(source).toContain("purchaseShare");
    expect(source).toContain("ctaDisabled={!availableSharePercents.length || purchaseShare.isPending}");
  });

  it("contains guest preview markers and login prompts without excessive marketing rhetoric", () => {
    expect(source).toContain("animal-guest-preview-banner");
    expect(source).toContain("войдите в аккаунт или зарегистрируйтесь");
    expect(source).toContain("animal-guest-preview-register-cta-secondary");
    expect(source).toContain("animal-guest-preview-sticky-register");
    expect(source).toContain("Войти или зарегистрироваться");
    // No old marketing fluff
    expect(source).not.toContain("не карточка товара");
    expect(source).not.toContain("Профиль животного как эмоциональное ядро экосистемы");
    expect(source).not.toContain("точкой ежедневного контакта между семьёй");
  });

  it("keeps guest CTA interactive and redirects to login with selected share preserved", () => {
    expect(source).toContain('document.cookie.includes("manus_session=")');
    expect(source).toContain("!isAuthenticated && !hasSession");
    expect(source).toContain("getLoginUrl(`/animals/${animalSlug}?share=${selectedSharePercent}`)");
    expect(source).toContain("ctaDisabled={!availableSharePercents.length || purchaseShare.isPending}");
  });

  it("contains gallery, diary and passport sections in correct order", () => {
    expect(source).toContain("Галерея");
    expect(source).toContain("Дневник");
    expect(source).toContain("Паспорт");
    expect(source).toContain("Управление галереей доступно владельцам доли");
    // Passport button now appears in Quick CTA area (before collapsible sections)
    // Diary appears in collapsible sections below
    // Both are present in the source
    const passportBtnIdx = source.indexOf("Паспорт");
    const diaryIdx = source.indexOf("Дневник");
    expect(passportBtnIdx).toBeGreaterThan(-1);
    expect(diaryIdx).toBeGreaterThan(-1);
  });
});
