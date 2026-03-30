import { describe, it, expect } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Metrics (Seasonal Rhythm) Update Notifications — Unit Tests
   Tests cover:
   1. Notification message generation for create/update/delete
   2. Notification type mapping to preferences
   3. Notification link generation
   4. Edge cases
   ═══════════════════════════════════════════════════════════════ */

/* ── Types (mirroring the notification system) ── */
type MetricsNotificationInput = {
  animalId: number;
  animalName: string;
  animalSlug: string;
  action: "created" | "updated" | "deleted";
  detail?: string;
};

/* ── Pure functions for testing (mirroring db.ts logic) ── */

const ACTION_LABELS: Record<string, string> = {
  created: "добавлены новые данные",
  updated: "обновлены данные",
  deleted: "удалены данные",
};

function buildMetricsTitle(animalName: string, action: string): string {
  return `Сезонный ритм ${animalName}: ${ACTION_LABELS[action] ?? "изменение"}`;
}

function buildMetricsBody(animalName: string, action: string, detail?: string): string {
  const actionLabel = ACTION_LABELS[action] ?? "Изменение";
  return detail
    ? `${actionLabel} сезонного ритма для ${animalName}: ${detail}`
    : `${actionLabel} сезонного ритма для ${animalName}.`;
}

function buildMetricsLink(animalSlug: string): string {
  return `/tracker?animal=${animalSlug}`;
}

/** Map notification type to preference key */
const TYPE_TO_PREF_KEY: Record<string, string> = {
  photo_approved: "photoApproved",
  photo_rejected: "photoRejected",
  club_post: "clubPost",
  club_event: "clubEvent",
  composition_update: "compositionUpdate",
  metrics_update: "metricsUpdate",
};

function shouldNotifyByPreference(
  type: string,
  prefs: Record<string, boolean>,
): boolean {
  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return true;
  return prefs[prefKey] ?? true;
}

/* ═══════════════════════════════════════════════════════════════ */

describe("Metrics Update Notifications", () => {
  describe("Notification title generation", () => {
    it("generates correct title for created action", () => {
      const title = buildMetricsTitle("Мира", "created");
      expect(title).toBe("Сезонный ритм Мира: добавлены новые данные");
    });

    it("generates correct title for updated action", () => {
      const title = buildMetricsTitle("Руфа", "updated");
      expect(title).toBe("Сезонный ритм Руфа: обновлены данные");
    });

    it("generates correct title for deleted action", () => {
      const title = buildMetricsTitle("Злата", "deleted");
      expect(title).toBe("Сезонный ритм Злата: удалены данные");
    });

    it("handles unknown action gracefully", () => {
      const title = buildMetricsTitle("Мира", "unknown");
      expect(title).toBe("Сезонный ритм Мира: изменение");
    });
  });

  describe("Notification body generation", () => {
    it("includes detail when provided", () => {
      const body = buildMetricsBody("Мира", "created", "Январь: 45 л");
      expect(body).toBe("добавлены новые данные сезонного ритма для Мира: Январь: 45 л");
    });

    it("uses generic message when no detail", () => {
      const body = buildMetricsBody("Руфа", "updated");
      expect(body).toBe("обновлены данные сезонного ритма для Руфа.");
    });

    it("uses generic message when detail is undefined", () => {
      const body = buildMetricsBody("Злата", "deleted", undefined);
      expect(body).toBe("удалены данные сезонного ритма для Злата.");
    });

    it("includes detail for delete action", () => {
      const body = buildMetricsBody("Мира", "deleted", "Март");
      expect(body).toBe("удалены данные сезонного ритма для Мира: Март");
    });
  });

  describe("Notification link generation", () => {
    it("generates correct link for animal slug", () => {
      const link = buildMetricsLink("mira");
      expect(link).toBe("/tracker?animal=mira");
    });

    it("handles slugs with special characters", () => {
      const link = buildMetricsLink("my-goat-123");
      expect(link).toBe("/tracker?animal=my-goat-123");
    });
  });

  describe("Notification preference filtering", () => {
    it("respects metricsUpdate preference when enabled", () => {
      const prefs = { metricsUpdate: true };
      expect(shouldNotifyByPreference("metrics_update", prefs)).toBe(true);
    });

    it("respects metricsUpdate preference when disabled", () => {
      const prefs = { metricsUpdate: false };
      expect(shouldNotifyByPreference("metrics_update", prefs)).toBe(false);
    });

    it("defaults to true for unknown notification types", () => {
      const prefs = { metricsUpdate: true };
      expect(shouldNotifyByPreference("unknown_type", prefs)).toBe(true);
    });

    it("maps metrics_update type correctly", () => {
      expect(TYPE_TO_PREF_KEY["metrics_update"]).toBe("metricsUpdate");
    });

    it("maps all known types correctly including metrics_update", () => {
      expect(TYPE_TO_PREF_KEY["composition_update"]).toBe("compositionUpdate");
      expect(TYPE_TO_PREF_KEY["metrics_update"]).toBe("metricsUpdate");
      expect(TYPE_TO_PREF_KEY["photo_approved"]).toBe("photoApproved");
      expect(TYPE_TO_PREF_KEY["photo_rejected"]).toBe("photoRejected");
      expect(TYPE_TO_PREF_KEY["club_post"]).toBe("clubPost");
      expect(TYPE_TO_PREF_KEY["club_event"]).toBe("clubEvent");
    });
  });

  describe("Full notification flow (unit)", () => {
    it("builds complete notification for metrics create", () => {
      const input: MetricsNotificationInput = {
        animalId: 1,
        animalName: "Мира",
        animalSlug: "mira",
        action: "created",
        detail: "Январь: 45 л",
      };

      const title = buildMetricsTitle(input.animalName, input.action);
      const body = buildMetricsBody(input.animalName, input.action, input.detail);
      const link = buildMetricsLink(input.animalSlug);

      expect(title).toContain("Мира");
      expect(title).toContain("добавлены");
      expect(body).toContain("Январь: 45 л");
      expect(link).toBe("/tracker?animal=mira");
    });

    it("builds complete notification for metrics update without detail", () => {
      const input: MetricsNotificationInput = {
        animalId: 2,
        animalName: "Руфа",
        animalSlug: "Rufa",
        action: "updated",
      };

      const title = buildMetricsTitle(input.animalName, input.action);
      const body = buildMetricsBody(input.animalName, input.action, input.detail);
      const link = buildMetricsLink(input.animalSlug);

      expect(title).toContain("обновлены");
      expect(body).toContain("Руфа.");
      expect(link).toBe("/tracker?animal=Rufa");
    });

    it("builds complete notification for metrics delete", () => {
      const input: MetricsNotificationInput = {
        animalId: 3,
        animalName: "Злата",
        animalSlug: "zlata",
        action: "deleted",
        detail: "Февраль",
      };

      const title = buildMetricsTitle(input.animalName, input.action);
      const body = buildMetricsBody(input.animalName, input.action, input.detail);
      const link = buildMetricsLink(input.animalSlug);

      expect(title).toContain("удалены");
      expect(body).toContain("Февраль");
      expect(link).toBe("/tracker?animal=zlata");
    });
  });

  describe("Edge cases", () => {
    it("handles animal names with special characters", () => {
      const title = buildMetricsTitle("Козочка «Звёздочка»", "created");
      expect(title).toContain("Козочка «Звёздочка»");
    });

    it("handles very long detail strings", () => {
      const longDetail = "A".repeat(500);
      const body = buildMetricsBody("Мира", "updated", longDetail);
      expect(body).toContain(longDetail);
    });

    it("handles empty animal slug", () => {
      const link = buildMetricsLink("");
      expect(link).toBe("/tracker?animal=");
    });
  });
});
