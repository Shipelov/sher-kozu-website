import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../client/src/pages/AnimalProfile.tsx", import.meta.url), "utf-8");

describe("AnimalProfile visual integration", () => {
  it("contains premium hero storytelling and key route CTAs", () => {
    expect(source).toContain("— не карточка товара");
    expect(source).toContain("Открыть трекер продукции");
    expect(source).toContain("Перейти в клуб");
    expect(source).toContain("Вернуться в кабинет");
  });

  it("contains dynamic visual sections and image references", () => {
    expect(source).toContain("Профиль животного как эмоциональное ядро экосистемы");
    expect(source).toContain("точкой ежедневного контакта между семьёй, фермой и продуктовым маршрутом");
    expect(source).toContain("Продолжить эмоциональную связь через события, визиты и контент вокруг фермы");
    expect(source).toContain("sherkozu_anglonubian_portrait");
    expect(source).toContain("sherkozu_named_dairy_box");
    expect(source).toContain("sherkozu_club_visit");
  });

  it("contains limited guest preview markers and locked owner actions", () => {
    expect(source).toContain("animal-guest-preview-banner");
    expect(source).toContain("Ограниченный предпросмотр профиля питомца");
    expect(source).toContain("animal-guest-preview-open-access");
    expect(source).toContain("animal-guest-preview-diary-note");
    expect(source).toContain("animal-guest-preview-locked-gallery");
    expect(source).toContain("Как работает маршрут владельца");
  });
});
