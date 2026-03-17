import { describe, expect, it } from "vitest";
import {
  buildAnimalGalleryMedia,
  buildAnimalMutationPayload,
  buildShareSlots,
  createAdminShareSummary,
  createDemoAnimalPreset,
  createEmptyAnimalForm,
  createPhotoDraft,
  filterAdminAnimals,
  formatSharePercentLabel,
  formatShareRevenue,
  getNextVisibilityMode,
  getShareOccupancyTone,
  getStatusBadge,
  hasPhotoDraftChanges,
  mergeCoverIntoForm,
  normalizeAnimalFormValues,
  slugifyAnimalName,
  validateGalleryUpload,
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
    status: "public_limited",
    totalOwnershipSlots: 10,
    activeOwnerships: 4,
    availableSlots: 6,
    ownedPercent: 40,
    availablePercent: 60,
    totalPriceMinor: 850000,
    occupiedValueMinor: 340000,
    sharePriceMinor: 85000,
    ownersCount: 2,
    activeShareReservations: 4,
    shareDistribution: [
      { familyName: "Семья Алимовых", percent: 20, slots: [1, 2], planLabel: "6 месяцев" },
      { familyName: "Семья Орловых", percent: 20, slots: [3, 4], planLabel: "12 месяцев" },
    ],
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
    totalOwnershipSlots: 10,
    activeOwnerships: 0,
    availableSlots: 10,
    ownedPercent: 0,
    availablePercent: 100,
    totalPriceMinor: 990000,
    occupiedValueMinor: 0,
    sharePriceMinor: 99000,
    ownersCount: 0,
    activeShareReservations: 0,
    shareDistribution: [],
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
    totalOwnershipSlots: 10,
    activeOwnerships: 10,
    availableSlots: 0,
    ownedPercent: 100,
    availablePercent: 0,
    totalPriceMinor: 1350000,
    occupiedValueMinor: 1350000,
    sharePriceMinor: 135000,
    ownersCount: 3,
    activeShareReservations: 10,
    shareDistribution: [
      { familyName: "Семья Карповых", percent: 50, slots: [1, 2, 3, 4, 5], planLabel: "12 месяцев" },
      { familyName: "Семья Мироновых", percent: 30, slots: [6, 7, 8], planLabel: "3 месяца" },
      { familyName: "Семья Беловых", percent: 20, slots: [9, 10], planLabel: "1 месяц" },
    ],
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

const uploadedPhotos = [
  {
    id: "user-101",
    photoId: 101,
    src: "https://cdn.example.com/marta-1.jpg",
    title: "Марта у сада",
    meta: "Загружено владельцем · 240 KB",
    alt: "Марта у сада на прогулке",
    isUploaded: true as const,
    ownerOpenId: "owner-1",
    createdAt: "2026-03-16T10:00:00.000Z",
    isCover: true,
    sortOrder: 0,
  },
  {
    id: "user-102",
    photoId: 102,
    src: "https://cdn.example.com/marta-2.jpg",
    title: "Утренний портрет",
    meta: "Загружено владельцем · 198 KB",
    isUploaded: true as const,
    ownerOpenId: "owner-1",
    createdAt: "2026-03-16T10:05:00.000Z",
    isCover: false,
    sortOrder: 1,
  },
] as const;

describe("Admin animals UI helpers", () => {
  it("creates default empty form values for new animals", () => {
    const form = createEmptyAnimalForm();

    expect(form.species).toBe("goat");
    expect(form.status).toBe("hidden");
    expect(form.totalOwnershipSlots).toBe(10);
    expect(form.name).toBe("");
  });

  it("keeps the standard 10-slot sharing model with 10% increments", () => {
    const slots = buildShareSlots(animals[0] as any);

    expect(slots).toHaveLength(10);
    expect(slots[0]?.percentLabel).toBe("10%");
    expect(slots[4]?.percentLabel).toBe("50%");
    expect(slots[9]?.percentLabel).toBe("100%");
  });

  it("formats animal prices in Russian rubles for admin surfaces", () => {
    expect(formatShareRevenue(135000)).toBe("1 350 ₽");
    expect(formatShareRevenue(118000)).toBe("1 180 ₽");
  });

  it("creates a complete demo preset for a goat profile", () => {
    const preset = createDemoAnimalPreset("goat");

    expect(preset.label).toBe("Демо-профиль козы");
    expect(preset.values.species).toBe("goat");
    expect(preset.values.status).toBe("public_available");
    expect(preset.values.name).toBe("Мира");
    expect(preset.values.coverImageUrl).toContain("cloudfront.net");
    expect(preset.media).toHaveLength(3);
    expect(preset.media[0]?.isCover).toBe(true);
    expect(preset.media.every((item) => item.mimeType === "image/jpeg")).toBe(true);
  });

  it("creates a complete demo preset for a sheep profile", () => {
    const preset = createDemoAnimalPreset("sheep");

    expect(preset.label).toBe("Демо-профиль овцы");
    expect(preset.values.species).toBe("sheep");
    expect(preset.values.status).toBe("public_available");
    expect(preset.values.name).toBe("Лана");
    expect(preset.values.publishedAt).toBeTruthy();
    expect(preset.media).toHaveLength(3);
    expect(preset.media[0]?.isCover).toBe(true);
    expect(preset.media.map((item) => item.title)).toContain("Клубный день с Ланой");
  });

  it("builds a published payload from a demo preset with complete media", () => {
    const preset = createDemoAnimalPreset("goat");
    const payload = buildAnimalMutationPayload(preset.values, preset.media);

    expect(payload.species).toBe("goat");
    expect(payload.status).toBe("public_available");
    expect(typeof payload.publishedAt).toBe("number");
    expect(payload.media).toHaveLength(3);
    expect(payload.media[0]?.isCover).toBe(true);
    expect(payload.media[1]?.sortOrder).toBe(1);
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

  it("builds media payload from uploaded gallery photos", () => {
    const media = buildAnimalGalleryMedia([...uploadedPhotos]);

    expect(media).toEqual([
      {
        kind: "image",
        title: "Марта у сада",
        alt: "Марта у сада на прогулке",
        fileKey: "user-101",
        url: "https://cdn.example.com/marta-1.jpg",
        mimeType: "image/jpeg",
        sortOrder: 0,
        isCover: true,
      },
      {
        kind: "image",
        title: "Утренний портрет",
        alt: "Загружено владельцем · 198 KB",
        fileKey: "user-102",
        url: "https://cdn.example.com/marta-2.jpg",
        mimeType: "image/jpeg",
        sortOrder: 1,
        isCover: false,
      },
    ]);
  });

  it("builds mutation payload with gallery media", () => {
    const payload = buildAnimalMutationPayload(
      {
        ...createEmptyAnimalForm(),
        name: "Марта",
        slug: "marta",
        shortDescription: "Достаточно длинное описание для витрины.",
        coverImageUrl: "https://cdn.example.com/marta-1.jpg",
      },
      buildAnimalGalleryMedia([...uploadedPhotos])
    );

    expect(payload.media).toHaveLength(2);
    expect(payload.media[0]?.isCover).toBe(true);
    expect(payload.media[1]?.sortOrder).toBe(1);
  });

  it("validates upload file type and size", () => {
    expect(validateGalleryUpload("image/jpeg", 200_000)).toEqual({ hasAllowedType: true, hasAllowedSize: true });
    expect(validateGalleryUpload("application/pdf", 200_000)).toEqual({ hasAllowedType: false, hasAllowedSize: true });
    expect(validateGalleryUpload("image/png", 9_000_000)).toEqual({ hasAllowedType: true, hasAllowedSize: false });
  });

  it("creates draft metadata from explicit alt or falls back to meta", () => {
    expect(createPhotoDraft(uploadedPhotos[0])).toEqual({
      title: "Марта у сада",
      alt: "Марта у сада на прогулке",
    });

    expect(createPhotoDraft(uploadedPhotos[1])).toEqual({
      title: "Утренний портрет",
      alt: "Загружено владельцем · 198 KB",
    });
  });

  it("detects whether photo draft values changed after trimming", () => {
    expect(hasPhotoDraftChanges(uploadedPhotos[0], undefined)).toBe(false);
    expect(hasPhotoDraftChanges(uploadedPhotos[0], { title: "  Марта у сада  ", alt: "Марта у сада на прогулке" })).toBe(false);
    expect(hasPhotoDraftChanges(uploadedPhotos[0], { title: "Марта у сада", alt: "Новый alt" })).toBe(true);
    expect(hasPhotoDraftChanges(uploadedPhotos[1], { title: "Утренний портрет 2", alt: "Загружено владельцем · 198 KB" })).toBe(true);
  });

  it("syncs cover image url from uploaded gallery", () => {
    const merged = mergeCoverIntoForm(createEmptyAnimalForm(), [...uploadedPhotos]);
    expect(merged.coverImageUrl).toBe("https://cdn.example.com/marta-1.jpg");
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

  it("builds 10%-share slots for admin visualization", () => {
    const slots = buildShareSlots(animals[0]);

    expect(slots).toHaveLength(10);
    expect(slots.filter((slot) => slot.state === "occupied")).toHaveLength(4);
    expect(slots.filter((slot) => slot.state === "available")).toHaveLength(6);
    expect(slots[0]).toMatchObject({ index: 1, percentLabel: "10%", state: "occupied" });
    expect(slots[9]).toMatchObject({ index: 10, percentLabel: "100%", state: "available" });
  });

  it("creates aggregate share summary for admin dashboard", () => {
    const summary = createAdminShareSummary([...animals]);

    expect(summary.totalAnimals).toBe(3);
    expect(summary.totalOwnedPercent).toBe(140);
    expect(summary.totalAvailablePercent).toBe(160);
    expect(summary.totalOwnersCount).toBe(5);
    expect(summary.totalOccupiedValueMinor).toBe(1_690_000);
  });

  it("formats share percent labels and occupied revenue for admin cards", () => {
    expect(formatSharePercentLabel(30)).toBe("30%");
    expect(formatShareRevenue(340000)).toContain("3");
    expect(formatShareRevenue(340000)).toContain("₽");
  });

  it("normalizes incomplete share data without NaN or crashes", () => {
    const sparseAnimal = {
      ...animals[0],
      totalOwnershipSlots: undefined,
      activeOwnerships: undefined,
      availableSlots: undefined,
      ownedPercent: undefined,
      availablePercent: undefined,
      shareUnitPercent: undefined,
      shareUnitPriceMinor: undefined,
      fullPriceMinor: undefined,
      availableSharePercents: undefined,
      baseMonthlyPriceMinor: 120000,
    } as unknown as typeof animals[number];

    const slots = buildShareSlots(sparseAnimal);
    const summary = createAdminShareSummary([sparseAnimal]);

    expect(slots).toHaveLength(10);
    expect(slots[0]?.percentLabel).toBe("10%");
    expect(summary.totalAnimals).toBe(1);
    expect(summary.totalOwnedPercent).toBe(0);
    expect(summary.totalAvailablePercent).toBe(100);
    expect(Number.isNaN(summary.totalOccupiedValueMinor)).toBe(false);
    expect(summary.totalOccupiedValueMinor).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(summary.averageOccupancy)).toBe(false);
    expect(summary.averageOccupancy).toBeGreaterThanOrEqual(0);
  });

  it("returns tone markers for share occupancy progress", () => {
    expect(getShareOccupancyTone(0)).toBe("available");
    expect(getShareOccupancyTone(40)).toBe("partial");
    expect(getShareOccupancyTone(100)).toBe("full");
  });
});
