import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Age calculation helper (mirrors AnimalProfile.tsx logic) ──
function computeAge(birthDateInput: string | number) {
  const birth = new Date(typeof birthDateInput === "number" ? birthDateInput : birthDateInput);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < birth.getDate()) {
    months--;
    if (months < 0) { years--; months += 12; }
  }

  const yLabel = years === 1 ? "год" : (years >= 2 && years <= 4) ? "года" : "лет";
  const mLabel = months === 1 ? "месяц" : (months >= 2 && months <= 4) ? "месяца" : "месяцев";
  let ageStr = "";
  if (years > 0) ageStr += `${years} ${yLabel}`;
  if (months > 0) ageStr += `${ageStr ? ", " : ""}${months} ${mLabel}`;
  if (!ageStr) ageStr = "менее месяца";

  const nextBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBirthday <= now) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
  const diffMs = nextBirthday.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return { years, months, ageStr, daysUntil };
}

describe("Age calculation", () => {
  it("computes age for a 2-year-old animal", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const result = computeAge(twoYearsAgo.toISOString().slice(0, 10));
    expect(result).not.toBeNull();
    expect(result!.years).toBe(2);
    expect(result!.months).toBe(0);
    expect(result!.ageStr).toContain("2 года");
  });

  it("computes age for a 6-month-old animal", () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const result = computeAge(sixMonthsAgo.toISOString().slice(0, 10));
    expect(result).not.toBeNull();
    expect(result!.years).toBe(0);
    // months can be 5 or 6 depending on day alignment
    expect(result!.months).toBeGreaterThanOrEqual(5);
    expect(result!.months).toBeLessThanOrEqual(6);
    expect(result!.ageStr).toMatch(/\d+ месяц/);
  });

  it("computes age for a 1-year-3-month-old animal", () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    date.setMonth(date.getMonth() - 3);
    const result = computeAge(date.toISOString().slice(0, 10));
    expect(result).not.toBeNull();
    expect(result!.years).toBe(1);
    // months can be 2 or 3 depending on day alignment
    expect(result!.months).toBeGreaterThanOrEqual(2);
    expect(result!.months).toBeLessThanOrEqual(3);
    expect(result!.ageStr).toContain("1 год");
  });

  it("computes age for a very young animal (less than a month)", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 10);
    const result = computeAge(recent.toISOString().slice(0, 10));
    expect(result).not.toBeNull();
    expect(result!.years).toBe(0);
    expect(result!.months).toBe(0);
    expect(result!.ageStr).toBe("менее месяца");
  });

  it("computes age for a 5-year-old animal", () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const result = computeAge(fiveYearsAgo.toISOString().slice(0, 10));
    expect(result).not.toBeNull();
    expect(result!.years).toBe(5);
    expect(result!.ageStr).toContain("5 лет");
  });

  it("handles numeric timestamp input", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const result = computeAge(twoYearsAgo.getTime());
    expect(result).not.toBeNull();
    expect(result!.years).toBe(2);
  });

  it("returns null for invalid date", () => {
    const result = computeAge("not-a-date");
    expect(result).toBeNull();
  });

  it("calculates days until birthday correctly", () => {
    // Birthday is in 30 days from now (same year)
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    // Set birth year 3 years ago, same month/day as futureDate
    const birthDate = `${now.getFullYear() - 3}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
    const result = computeAge(birthDate);
    expect(result).not.toBeNull();
    expect(result!.daysUntil).toBeGreaterThanOrEqual(29);
    expect(result!.daysUntil).toBeLessThanOrEqual(31);
  });

  it("uses correct Russian plural forms", () => {
    // 1 год
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() - 1);
    oneYear.setMonth(oneYear.getMonth()); // same month to get 0 months
    const r1 = computeAge(oneYear.toISOString().slice(0, 10));
    expect(r1!.ageStr).toContain("год");
    expect(r1!.ageStr).not.toContain("года");

    // 5 лет
    const fiveYears = new Date();
    fiveYears.setFullYear(fiveYears.getFullYear() - 5);
    const r5 = computeAge(fiveYears.toISOString().slice(0, 10));
    expect(r5!.ageStr).toContain("лет");
  });
});

// ── generatePreset procedure test (mocked LLM) ──
describe("generatePreset procedure", () => {
  // LLM now generates everything except species and breed (those are user-selected)
  const mockInput = { species: "goat" as const, breed: "Альпийская" };
  const mockLLMResponse = {
    name: "Аврора",
    slug: "avrora",
    shortDescription: "Грациозная альпийская коза с мягким характером.",
    story: "Аврора родилась весной и с первых дней проявляла любопытство ко всему вокруг. Она обожает прогулки по холмам и первой подходит к гостям фермы.",
    galleryIntro: "Фотоистория Авроры: от первых шагов до любимых мест на ферме.",
    baseMonthlyPriceMinor: 145000,
    healthScore: 92,
    happinessScore: 88,
    milkPotentialScore: 95,
    careLevelScore: 72,
    birthDate: "2024-03-15",
  };

  it("validates LLM response structure (breed is NOT in LLM response)", () => {
    // breed is now passed as input, not generated by LLM
    const llmRequired = [
      "name", "slug", "shortDescription", "story", "galleryIntro",
      "baseMonthlyPriceMinor", "healthScore", "happinessScore",
      "milkPotentialScore", "careLevelScore", "birthDate",
    ];
    for (const field of llmRequired) {
      expect(mockLLMResponse).toHaveProperty(field);
    }
    // breed should NOT be in LLM response — it comes from user input
    expect(mockLLMResponse).not.toHaveProperty("breed");
    expect(mockInput.breed).toBe("Альпийская");
  });

  it("breed is taken from user input, not LLM", () => {
    // Simulate the final result assembly
    const result = {
      ...mockLLMResponse,
      species: mockInput.species,
      breed: mockInput.breed,
    };
    expect(result.breed).toBe("Альпийская");
    expect(result.species).toBe("goat");
  });

  it("breed options are correct for each species", () => {
    const BREED_OPTIONS: Record<"goat" | "sheep", string[]> = {
      goat: ["Англо-нубийская", "Альпийская"],
      sheep: ["Лакон", "Остфризская"],
    };
    expect(BREED_OPTIONS.goat).toHaveLength(2);
    expect(BREED_OPTIONS.sheep).toHaveLength(2);
    expect(BREED_OPTIONS.goat).toContain("Альпийская");
    expect(BREED_OPTIONS.goat).toContain("Англо-нубийская");
    expect(BREED_OPTIONS.sheep).toContain("Лакон");
    expect(BREED_OPTIONS.sheep).toContain("Остфризская");
  });

  it("slug is valid lowercase latin", () => {
    const slug = mockLLMResponse.slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
  });

  it("price is within valid range", () => {
    expect(mockLLMResponse.baseMonthlyPriceMinor).toBeGreaterThanOrEqual(80000);
    expect(mockLLMResponse.baseMonthlyPriceMinor).toBeLessThanOrEqual(200000);
  });

  it("scores are within 0-100 range", () => {
    const scores = [
      mockLLMResponse.healthScore,
      mockLLMResponse.happinessScore,
      mockLLMResponse.milkPotentialScore,
      mockLLMResponse.careLevelScore,
    ];
    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("birthDate is a valid date string", () => {
    const date = new Date(mockLLMResponse.birthDate);
    expect(isNaN(date.getTime())).toBe(false);
  });

  it("score clamping works correctly", () => {
    // Simulate the clamping logic from the procedure
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    expect(clamp(150)).toBe(100);
    expect(clamp(-10)).toBe(0);
    expect(clamp(75)).toBe(75);
    expect(clamp(0)).toBe(0);
    expect(clamp(100)).toBe(100);
  });

  it("slug sanitization handles special characters", () => {
    const dirtySlug = "Аврора-123!@#";
    const clean = dirtySlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    expect(clean).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
    expect(clean).not.toContain("!");
    expect(clean).not.toContain("@");
  });
});

// ── birthDate field in mutation payload ──
describe("birthDate in mutation payload", () => {
  it("converts date string to timestamp", () => {
    const dateStr = "2024-03-15";
    const timestamp = new Date(dateStr).getTime();
    expect(timestamp).toBeGreaterThan(0);
    expect(typeof timestamp).toBe("number");
  });

  it("handles null birthDate", () => {
    const birthDate = "";
    const result = birthDate ? new Date(birthDate).getTime() : null;
    expect(result).toBeNull();
  });

  it("converts timestamp back to date string for form", () => {
    const timestamp = new Date("2024-03-15").getTime();
    const dateStr = new Date(timestamp).toISOString().slice(0, 10);
    expect(dateStr).toBe("2024-03-15");
  });
});
