import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { nutriProfiles } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function userContext(id = 42): TrpcContext {
  const user: AuthenticatedUser = {
    id,
    openId: `zoya-profile-test-${id}`,
    email: `zoya-profile-test-${id}@example.test`,
    name: "Тестовый пользователь",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("nutritionist.profiles", () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    const db = await getDb();
    if (!db || createdIds.length === 0) return;
    for (const id of createdIds.splice(0)) {
      await db.delete(nutriProfiles).where(eq(nutriProfiles.id, id));
    }
  });

  it("creates, completes, confirms and archives an additional profile", async () => {
    const caller = appRouter.createCaller(userContext());
    const before = await caller.nutritionist.profiles.list();
    const originalPrimary = before.find((profile) => profile.isPrimary);

    const created = await caller.nutritionist.profiles.create({
      profileName: "Спортивный профиль",
      relationship: "spouse",
    });
    createdIds.push(created.id);
    expect(created.isPrimary).toBe(false);
    expect(created.requirements.isComplete).toBe(false);
    expect(created.requirements.missingFields).toContain("gender");

    const updated = await caller.nutritionist.profiles.update({
      profileId: created.id,
      data: {
        gender: "female",
        birthDate: "1987-05-12",
        heightCm: 168,
        weightKg: 64.5,
        goals: ["поддержание формы"],
        activityLevel: "moderate",
        noAllergiesConfirmed: true,
        noRestrictionsConfirmed: true,
        preferredProducts: ["Рикотта"],
      },
    });
    expect(updated.requirements.isComplete).toBe(true);
    expect(updated.onboardingStatus).toBe("complete");

    const confirmed = await caller.nutritionist.profiles.confirm({ profileId: created.id });
    expect(confirmed.confirmedAt).toBeInstanceOf(Date);
    expect(confirmed.lastReviewedAt).toBeInstanceOf(Date);

    const primary = await caller.nutritionist.profiles.setPrimary({ profileId: created.id });
    expect(primary.isPrimary).toBe(true);
    await expect(caller.nutritionist.profiles.archive({ profileId: created.id })).rejects.toThrow(
      "Сначала назначьте другой профиль основным",
    );

    if (originalPrimary) {
      await caller.nutritionist.profiles.setPrimary({ profileId: originalPrimary.id });
    }
    await expect(caller.nutritionist.profiles.archive({ profileId: created.id })).resolves.toEqual({ success: true });
    const active = await caller.nutritionist.profiles.list();
    expect(active.some((profile) => profile.id === created.id)).toBe(false);
  });

  it("does not expose another user's profile by id", async () => {
    const ownerCaller = appRouter.createCaller(userContext());
    const strangerCaller = appRouter.createCaller(userContext(777_777));
    const created = await ownerCaller.nutritionist.profiles.create({
      profileName: "Закрытый профиль",
      relationship: "other",
    });
    createdIds.push(created.id);

    const result = await strangerCaller.nutritionist.profiles.getActive({ profileId: created.id });
    expect(result).toBeNull();
    await expect(strangerCaller.nutritionist.profiles.update({
      profileId: created.id,
      data: { profileName: "Чужое изменение" },
    })).rejects.toThrow("Профиль питания не найден");

    const db = await getDb();
    const [unchanged] = await db!
      .select({ profileName: nutriProfiles.profileName })
      .from(nutriProfiles)
      .where(and(eq(nutriProfiles.id, created.id), eq(nutriProfiles.userId, 42)))
      .limit(1);
    expect(unchanged?.profileName).toBe("Закрытый профиль");
  });
});
