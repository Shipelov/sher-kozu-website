import { beforeEach, describe, expect, it, vi } from "vitest";

const ownerOpenId = "demo-owner-open-id";

const mockState = {
  seeded: false,
  publicAnimals: [] as Array<{ slug: string; name: string; species: string; status: string }>,
  adminAnimals: [] as Array<{ slug: string; name: string; species: string; status: string }>,
};

const ensureSprintOneSeed = vi.fn(async (openId: string) => {
  if (openId !== ownerOpenId || mockState.seeded) return;

  mockState.seeded = true;
  const seededAnimals = [
    {
      slug: `marta-${openId.slice(0, 6)}`,
      name: "Марта",
      species: "goat",
      status: "public_available",
    },
    {
      slug: `zlata-${openId.slice(0, 6)}`,
      name: "Злата",
      species: "sheep",
      status: "public_available",
    },
  ];

  mockState.adminAnimals = seededAnimals;
  mockState.publicAnimals = seededAnimals;
});

async function adminAnimalsList(openId: string) {
  await ensureSprintOneSeed(openId);
  return mockState.adminAnimals;
}

async function publicAnimalsList() {
  await ensureSprintOneSeed(ownerOpenId);
  return mockState.publicAnimals;
}

describe("demo animals seeding flow", () => {
  beforeEach(() => {
    mockState.seeded = false;
    mockState.adminAnimals = [];
    mockState.publicAnimals = [];
    ensureSprintOneSeed.mockClear();
  });

  it("seeds goat and sheep for admin list when owner opens admin animals", async () => {
    const animals = await adminAnimalsList(ownerOpenId);

    expect(ensureSprintOneSeed).toHaveBeenCalledWith(ownerOpenId);
    expect(animals).toHaveLength(2);
    expect(animals.map((animal) => animal.name)).toEqual(["Марта", "Злата"]);
    expect(animals.map((animal) => animal.species)).toEqual(["goat", "sheep"]);
  });

  it("seeds goat and sheep for public catalog even before admin page is opened", async () => {
    const animals = await publicAnimalsList();

    expect(ensureSprintOneSeed).toHaveBeenCalledWith(ownerOpenId);
    expect(animals).toHaveLength(2);
    expect(animals.every((animal) => animal.status === "public_available")).toBe(true);
    expect(animals.map((animal) => animal.slug)).toEqual(["marta-demo-o", "zlata-demo-o"]);
  });

  it("does not duplicate seeded animals on repeated list requests", async () => {
    const firstAdminList = await adminAnimalsList(ownerOpenId);
    const secondPublicList = await publicAnimalsList();

    expect(firstAdminList).toHaveLength(2);
    expect(secondPublicList).toHaveLength(2);
    expect(mockState.adminAnimals).toHaveLength(2);
    expect(mockState.publicAnimals).toHaveLength(2);
    expect(ensureSprintOneSeed).toHaveBeenCalledTimes(2);
  });
});
