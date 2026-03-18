import { describe, expect, it } from "vitest";

function resolveClubAnimal(args: {
  ownerAnimalSlug?: string | null;
  requestedAnimalSlug?: string | null;
  fallbackAnimalSlug?: string | null;
}) {
  return args.ownerAnimalSlug ?? args.requestedAnimalSlug ?? args.fallbackAnimalSlug ?? "marta";
}

function buildClubLinks(activeAnimalSlug: string) {
  return {
    profileHref: `/animals/${activeAnimalSlug}`,
    trackerHref: `/tracker?animal=${activeAnimalSlug}`,
    dashboardHref: `/dashboard?animal=${activeAnimalSlug}`,
    clubHref: `/club?animal=${activeAnimalSlug}`,
  };
}

function buildClubSignals(args: {
  animalName: string;
  sharePercent: number;
}) {
  if (args.sharePercent > 0) {
    return [
      `Клуб собирает личный ритм вокруг ${args.animalName} и вашего участия ${args.sharePercent}%.`,
      "Каждый пост возвращает владельца к животному, визитам и реальным семейным ритуалам на ферме.",
      "Все переходы синхронизированы с профилем животного, продуктовым трекером и кабинетом владельца.",
    ];
  }

  return [
    "Клуб возвращает пользователя через события, ритуалы и живой дневник фермы.",
    "Каждый пост связан с животным, продуктом или личным семейным визитом.",
    "Маршруты страницы сохраняют связность с Animal Profile, Product Tracker и кабинетом владельца.",
  ];
}

describe("ClubFeed ownership journey", () => {
  it("prefers current owner animal over requested and fallback animals", () => {
    expect(
      resolveClubAnimal({
        ownerAnimalSlug: "zlata",
        requestedAnimalSlug: "marta",
        fallbackAnimalSlug: "alma",
      })
    ).toBe("zlata");
  });

  it("falls back to requested animal when owner context is absent", () => {
    expect(
      resolveClubAnimal({
        ownerAnimalSlug: null,
        requestedAnimalSlug: "marta",
        fallbackAnimalSlug: "alma",
      })
    ).toBe("marta");
  });

  it("builds synchronized navigation links from the active club animal", () => {
    expect(buildClubLinks("zlata")).toEqual({
      profileHref: "/animals/zlata",
      trackerHref: "/tracker?animal=zlata",
      dashboardHref: "/dashboard?animal=zlata",
      clubHref: "/club?animal=zlata",
    });
  });

  it("switches club signals from generic community copy to personal ownership copy", () => {
    expect(buildClubSignals({ animalName: "Злата", sharePercent: 30 })[0]).toContain("30%");
    expect(buildClubSignals({ animalName: "Марта", sharePercent: 0 })[0]).toContain("Клуб возвращает пользователя");
  });
});
