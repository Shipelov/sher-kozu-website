import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const profilesSource = readFileSync(
  path.resolve(__dirname, "../client/src/components/ZoyaNutritionProfiles.tsx"),
  "utf8",
);
const webChatSource = readFileSync(
  path.resolve(__dirname, "../client/src/components/ZoyaChat.tsx"),
  "utf8",
);
const telegramSource = readFileSync(
  path.resolve(__dirname, "../client/src/pages/TgAppZoya.tsx"),
  "utf8",
);
const routerSource = readFileSync(path.resolve(__dirname, "routers/nutritionist.ts"), "utf8");

describe("Zoya nutrition profile UI wiring", () => {
  it("supports one primary profile and adding/selecting/editing family profiles", () => {
    expect(profilesSource).toContain("Добавить профиль");
    expect(profilesSource).toContain("setPrimary.mutateAsync");
    expect(profilesSource).toContain("archiveProfile.mutateAsync");
    expect(profilesSource).toContain("relationship");
  });

  it("includes every mandatory questionnaire field and explicit no-restriction controls", () => {
    for (const field of [
      "profileName",
      "gender",
      "birthDate",
      "heightCm",
      "weightKg",
      "goals",
      "activityLevel",
      "allergies",
      "restrictions",
    ]) {
      expect(profilesSource).toContain(field);
    }
    expect(profilesSource).toContain("Подтверждаю, что известных пищевых аллергий нет");
    expect(profilesSource).toContain("Подтверждаю, что специальных ограничений нет");
  });

  it("passes the selected confirmed profile through both web SSE and Telegram tRPC", () => {
    expect(webChatSource).toContain("profileId: activeProfileId ?? undefined");
    expect(webChatSource).toContain("profileConfirmed");
    expect(telegramSource).toContain("profileId: activeProfileId ?? undefined");
    expect(telegramSource).toContain("profileConfirmed");
  });

  it("persists sessionId for multi-step follow-ups in both clients", () => {
    expect(webChatSource).toContain('parsed.type === "session"');
    expect(webChatSource).toContain("setSessionId(parsed.sessionId)");
    expect(telegramSource).toContain("sessionId: sessionId ?? undefined");
    expect(telegramSource).toContain("setSessionId((result as any).sessionId)");
  });

  it("exposes protected CRUD, confirmation and primary-profile operations", () => {
    expect(routerSource).toContain("profiles: router({");
    expect(routerSource).toContain("setPrimary: protectedProcedure");
    expect(routerSource).toContain("confirm: protectedProcedure");
    expect(routerSource).toContain("archive: protectedProcedure");
  });
});
