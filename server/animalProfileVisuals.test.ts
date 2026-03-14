import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../client/src/pages/AnimalProfile.tsx", import.meta.url), "utf-8");

describe("AnimalProfile visual integration", () => {
  it("contains premium hero storytelling and key route CTAs", () => {
    expect(source).toContain("Марта — не карточка товара");
    expect(source).toContain("Открыть трекер продукта");
    expect(source).toContain("Перейти в клуб Марты");
    expect(source).toContain("Вернуться в кабинет");
  });

  it("contains new visual sections and image references", () => {
    expect(source).toContain("Визуальная история Марты");
    expect(source).toContain("Живое присутствие делает профиль убедительным");
    expect(source).toContain("Профиль Марты не должен заканчиваться тупиком");
    expect(source).toContain("sherkozu_anglonubian_portrait");
    expect(source).toContain("sherkozu_named_dairy_box");
    expect(source).toContain("sherkozu_club_visit");
  });
});
