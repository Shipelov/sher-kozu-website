import { describe, expect, it } from "vitest";
import {
  buildAnimalMutationPayload,
  createEmptyAnimalForm,
  filterAdminAnimals,
  getNextVisibilityMode,
  getStatusBadge,
  normalizeAnimalFormValues,
  slugifyAnimalName,
} from "../client/src/pages/AdminAnimals";

const animals = [
  {
    id: 1,
    slug: "marta",
    name: "Марта",
    species: "goat",
    breed: "Англо-нубийская",
    shortDescription: "Спокойная и очень контактная коза для семейного участия.",
    story: "Любит прогулки у яблоневого сада и легко идёт на контакт с детьми.",
    galleryIntro: "Фотографии из повседневной жизни Марты.",
    status: "public_available",
    totalOwnershipSlots: 3,
    activeOwnerships: 1,
    availableSlots: 2,
    baseMonthlyPriceMinor: 125000,
    healthScore: 92,
    happinessScore: 89,
    milkPotentialScore: 95,
    careLevelScore: 81,
    isFeatured: 1,
    sortOrder: 4,
    coverImageUrl: "https://cdn.example.com/marta.jpg",
    publishedAt: "2026-03-10T09:30:00.000Z",
  },
  {
    id: 2,
    slug: "luna",
    name: "Луна",
    species: "sheep",
    breed: "Романовская",
    shortDescription: "Молодая овца для тихого семейного формата участия.",
    story: null,
    galleryIntro: null,
    status: "hidden",
    totalOwnershipSlots: 3,
    activeOwnerships: 0,
    availableSlots: 3,
    baseMonthlyPriceMinor: 99000,
    healthScore: 88,
    happinessScore: 90,
    milkPotentialScore: 74,
    careLevelScore: 65,
    isFeatured: 0,
    sortOrder: 2,
    coverImageUrl: null,
    publishedAt: null,
  },
  {
    id: 3,
    slug: "zvezda",
    name: "Звезда",
    species: "goat",
    breed: "Зааненская",
    shortDescription: "Высокий молочный потенциал и стабильный режим ухода.",
    story: null,
    galleryIntro: null,
    status: "fully_booked",
    totalOwnershipSlots: 3,
    activeOwnerships: 3,
    availableSlots: 0,
    baseMonthlyPriceMinor: 135000,
    healthScore: 96,
    happinessScore: 94,
    milkPotentialScore: 97,
    careLevelScore: 79,
    isFeatured: 1,
    sortOrder: 1,
    coverImageUrl: null,
    publishedAt: null,
  },
] as const;

describe("Admin animals UI helpers", () => {
  it("creates default empty form values for new animals", () => {
    const form = createEmptyAnimalForm();

    expect(form.species).toBe("goat");
    expect(form.status).toBe("hidden");
    expect(form.totalOwnershipSlots).toBe(3);
    expect(form.name).toBe("");
  });

  it("normalizes existing animal data into editable form values", () => {
    const form = normalizeAnimalFormValues(animals[0]);

    expect(form.id).toBe(1);
    expect(form.name).toBe("Марта");
    expect(form.isFeatured).toBe(true);
    expect(form.publishedAt).toBe("2026-03-10T09:30");
    expect(form.careLevelScore).toBe(81);
  });

  it("builds mutation payload with trimmed nullable fields", () => {
    const payload = buildAnimalMutationPayload({
      ...createEmptyAnimalForm(),
      name: "  Марта  ",
      slug: "  marta  ",
      breed: "  ",
      shortDescription: "  Тёплая карточка для каталога.  ",
      story: "   ",
      galleryIntro: "  Галерея про жизнь на ферме. ",
      coverImageUrl: "   ",
      publishedAt: "2026-03-16T11:20",
      isFeatured: true,
    });

    expect(payload.name).toBe("Марта");
    expect(payload.slug).toBe("marta");
    expect(payload.breed).toBeNull();
    expect(payload.story).toBeNull();
    expect(payload.coverImageUrl).toBeNull();
    expect(payload.galleryIntro).toBe("Галерея про жизнь на ферме.");
    expect(payload.isFeatured).toBe(true);
    expect(typeof payload.publishedAt).toBe("number");
    expect(payload.media).toEqual([]);
  });

  it("slugifies animal names for quick form autofill", () => {
    expect(slugifyAnimalName("  Marta Deluxe  ")).toBe("marta-deluxe");
    expect(slugifyAnimalName("Луна ферма")).toBe("луна-ферма");
  });

  it("filters animals by search query across name, slug, and breed", () => {
    expect(filterAdminAnimals([...animals], "мар", "all", "all")).toHaveLength(1);
    expect(filterAdminAnimals([...animals], "luna", "all", "all")[0]?.slug).toBe("luna");
    expect(filterAdminAnimals([...animals], "заан", "all", "all")[0]?.slug).toBe("zvezda");
  });

  it("filters animals by status and species together", () => {
    const result = filterAdminAnimals([...animals], "", "hidden", "sheep");
    expect(result).toHaveLength(1);
    expect(result[0]?.slug).toBe("luna");
  });

  it("returns hidden to public and all other active states to hidden", () => {
    expect(getNextVisibilityMode("hidden")).toBe("public");
    expect(getNextVisibilityMode("public_available")).toBe("hidden");
    expect(getNextVisibilityMode("public_limited")).toBe("hidden");
    expect(getNextVisibilityMode("fully_booked")).toBe("hidden");
  });

  it("returns readable badges for public and hidden states", () => {
    expect(getStatusBadge("public_available").label).toBe("Доступно");
    expect(getStatusBadge("hidden").label).toBe("Скрыто");
    expect(getStatusBadge("archived").label).toBe("Архив");
  });
});
