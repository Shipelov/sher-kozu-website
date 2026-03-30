import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("NotFound page (404)", () => {
  const notFoundPage = readFileSync(
    resolve(__dirname, "../client/src/pages/NotFound.tsx"),
    "utf-8"
  );

  it("displays 404 heading", () => {
    expect(notFoundPage).toContain("404");
  });

  it("has Russian text for page not found", () => {
    expect(notFoundPage).toContain("Страница не найдена");
  });

  it("has Russian description text", () => {
    expect(notFoundPage).toContain("запрашиваемая страница не существует");
  });

  it("has a link to go home", () => {
    expect(notFoundPage).toContain("На главную");
    expect(notFoundPage).toContain('setLocation("/")');
  });

  it("has a back button", () => {
    expect(notFoundPage).toContain("Назад");
    expect(notFoundPage).toContain("window.history.back()");
  });

  it("has a link to animal catalog", () => {
    expect(notFoundPage).toContain("Каталог");
    expect(notFoundPage).toContain('setLocation("/animals")');
  });

  it("includes Navbar for consistent navigation", () => {
    expect(notFoundPage).toContain("<Navbar");
  });
});

describe("AnimalProfile handles non-existent animals gracefully", () => {
  const animalProfile = readFileSync(
    resolve(__dirname, "../client/src/pages/AnimalProfile.tsx"),
    "utf-8"
  );

  it("shows 'Животное не найдено' message when animal is null", () => {
    expect(animalProfile).toContain("Животное не найдено");
  });

  it("provides a link to the animal catalog from not-found state", () => {
    expect(animalProfile).toContain("Перейти в каталог");
    expect(animalProfile).toContain('href="/animals"');
  });

  it("checks for loading state before showing not-found", () => {
    // Ensures we don't flash not-found while data is still loading
    expect(animalProfile).toContain("animalQuery.isLoading");
  });
});
