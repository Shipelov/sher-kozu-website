import { describe, expect, it } from "vitest";

type OwnerDashboardAnimal = {
  slug: string;
  name: string;
};

type OwnerDashboardOwnership = {
  animalSlug: string;
  sharePercent: number;
  statusLabel: string;
};

function resolveTrackerAnimalSlug(args: {
  ownerAnimalSlug?: string | null;
  ownershipAnimalSlug?: string | null;
  requestedAnimalSlug?: string | null;
}) {
  return args.ownerAnimalSlug ?? args.ownershipAnimalSlug ?? args.requestedAnimalSlug ?? "marta";
}

function getProductTrackerLinks(args: {
  currentAnimalSlug?: string | null;
  ownerAnimalSlug?: string | null;
  requestedAnimalSlug?: string | null;
}) {
  const slug = args.currentAnimalSlug ?? args.requestedAnimalSlug ?? args.ownerAnimalSlug ?? "marta";

  return {
    profileHref: `/animals/${slug}`,
    dashboardHref: `/dashboard?animal=${slug}`,
    clubHref: `/club?animal=${slug}`,
  };
}

function getOwnershipNarrative(args: {
  ownership?: OwnerDashboardOwnership | null;
}) {
  if (!args.ownership || !args.ownership.sharePercent) {
    return "Сертификат качества подтверждает партию и делает прозрачность наблюдаемой и эмоционально убедительной.";
  }

  return `В вашем маршруте закреплено ${args.ownership.sharePercent}% участия. Поэтому продуктовый трекер показывает не абстрактный пример, а персональный слой происхождения и доставки.`;
}

describe("ProductTracker ownership journey", () => {
  it("prefers current owner animal over requested query animal", () => {
    expect(
      resolveTrackerAnimalSlug({
        ownerAnimalSlug: "zlata",
        ownershipAnimalSlug: "zlata",
        requestedAnimalSlug: "marta",
      })
    ).toBe("zlata");
  });

  it("falls back to requested animal when owner data is absent", () => {
    expect(
      resolveTrackerAnimalSlug({
        ownerAnimalSlug: null,
        ownershipAnimalSlug: null,
        requestedAnimalSlug: "marta",
      })
    ).toBe("marta");
  });

  it("builds all related navigation links from the active tracker animal", () => {
    expect(
      getProductTrackerLinks({
        currentAnimalSlug: "zlata",
        ownerAnimalSlug: "marta",
        requestedAnimalSlug: "marta",
      })
    ).toEqual({
      profileHref: "/animals/zlata",
      dashboardHref: "/dashboard?animal=zlata",
      clubHref: "/club?animal=zlata",
    });
  });

  it("uses owner share percent to switch explanatory copy from generic to personal narrative", () => {
    expect(
      getOwnershipNarrative({
        ownership: {
          animalSlug: "marta",
          sharePercent: 30,
          statusLabel: "Активное участие",
        },
      })
    ).toContain("30% участия");

    expect(getOwnershipNarrative({ ownership: null })).toContain("Сертификат качества");
  });
});
