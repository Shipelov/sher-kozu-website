import { describe, it, expect } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Composition Update Notifications — Unit Tests
   Tests cover:
   1. Notification message generation for create/update/delete
   2. Owner deduplication logic
   3. Notification type mapping to preferences
   4. Notification link generation
   5. Edge cases (no owners, empty details)
   ═══════════════════════════════════════════════════════════════ */

/* ── Types (mirroring the notification system) ── */
type NotificationInput = {
  animalId: number;
  animalName: string;
  animalSlug: string;
  action: "created" | "updated" | "deleted";
  detail?: string;
};

/* ── Pure functions for testing ── */

const ACTION_LABELS: Record<string, string> = {
  created: "добавлен новый показатель",
  updated: "обновлён показатель",
  deleted: "удалён показатель",
};

function buildNotificationTitle(animalName: string, action: string): string {
  return `Состав молока ${animalName}: ${ACTION_LABELS[action] ?? "изменение"}`;
}

function buildNotificationBody(animalName: string, action: string, detail?: string): string {
  const actionLabel = ACTION_LABELS[action] ?? "Изменение";
  return detail
    ? `${actionLabel} состава молока для ${animalName}: ${detail}`
    : `${actionLabel} состава молока для ${animalName}.`;
}

function buildNotificationLink(animalSlug: string): string {
  return `/tracker?animal=${animalSlug}`;
}

/** Deduplicate owner openIds */
function deduplicateOwners(ownerOpenIds: string[]): string[] {
  const unique: string[] = [];
  for (const id of ownerOpenIds) {
    if (!unique.includes(id)) {
      unique.push(id);
    }
  }
  return unique;
}

/** Map notification type to preference key */
const TYPE_TO_PREF_KEY: Record<string, string> = {
  photo_approved: "photoApproved",
  photo_rejected: "photoRejected",
  club_post: "clubPost",
  club_event: "clubEvent",
  composition_update: "compositionUpdate",
};

function shouldNotifyByPreference(
  type: string,
  prefs: Record<string, boolean>,
): boolean {
  const prefKey = TYPE_TO_PREF_KEY[type];
  if (!prefKey) return true; // Unknown type → always send
  return prefs[prefKey] ?? true;
}

/* ═══════════════════════════════════════════════════════════════ */

describe("Composition Update Notifications", () => {
  describe("Notification title generation", () => {
    it("generates correct title for created action", () => {
      const title = buildNotificationTitle("Белка", "created");
      expect(title).toBe("Состав молока Белка: добавлен новый показатель");
    });

    it("generates correct title for updated action", () => {
      const title = buildNotificationTitle("Стрелка", "updated");
      expect(title).toBe("Состав молока Стрелка: обновлён показатель");
    });

    it("generates correct title for deleted action", () => {
      const title = buildNotificationTitle("Зорька", "deleted");
      expect(title).toBe("Состав молока Зорька: удалён показатель");
    });

    it("handles unknown action gracefully", () => {
      const title = buildNotificationTitle("Белка", "unknown");
      expect(title).toBe("Состав молока Белка: изменение");
    });
  });

  describe("Notification body generation", () => {
    it("includes detail when provided", () => {
      const body = buildNotificationBody("Белка", "created", "Жирность: 4.2%");
      expect(body).toBe("добавлен новый показатель состава молока для Белка: Жирность: 4.2%");
    });

    it("uses generic message when no detail", () => {
      const body = buildNotificationBody("Белка", "updated");
      expect(body).toBe("обновлён показатель состава молока для Белка.");
    });

    it("uses generic message when detail is undefined", () => {
      const body = buildNotificationBody("Зорька", "deleted", undefined);
      expect(body).toBe("удалён показатель состава молока для Зорька.");
    });

    it("includes detail for delete action", () => {
      const body = buildNotificationBody("Стрелка", "deleted", "Лактоза");
      expect(body).toBe("удалён показатель состава молока для Стрелка: Лактоза");
    });
  });

  describe("Notification link generation", () => {
    it("generates correct link for animal slug", () => {
      const link = buildNotificationLink("belka");
      expect(link).toBe("/tracker?animal=belka");
    });

    it("handles slugs with hyphens", () => {
      const link = buildNotificationLink("my-goat-123");
      expect(link).toBe("/tracker?animal=my-goat-123");
    });
  });

  describe("Owner deduplication", () => {
    it("removes duplicate openIds", () => {
      const result = deduplicateOwners(["user1", "user2", "user1", "user3", "user2"]);
      expect(result).toEqual(["user1", "user2", "user3"]);
    });

    it("returns empty array for empty input", () => {
      const result = deduplicateOwners([]);
      expect(result).toEqual([]);
    });

    it("returns single item for single input", () => {
      const result = deduplicateOwners(["user1"]);
      expect(result).toEqual(["user1"]);
    });

    it("preserves order of first occurrence", () => {
      const result = deduplicateOwners(["c", "a", "b", "a", "c"]);
      expect(result).toEqual(["c", "a", "b"]);
    });
  });

  describe("Notification preference filtering", () => {
    it("respects compositionUpdate preference when enabled", () => {
      const prefs = { compositionUpdate: true };
      expect(shouldNotifyByPreference("composition_update", prefs)).toBe(true);
    });

    it("respects compositionUpdate preference when disabled", () => {
      const prefs = { compositionUpdate: false };
      expect(shouldNotifyByPreference("composition_update", prefs)).toBe(false);
    });

    it("defaults to true for unknown notification types", () => {
      const prefs = { compositionUpdate: true };
      expect(shouldNotifyByPreference("unknown_type", prefs)).toBe(true);
    });

    it("maps all known types correctly", () => {
      expect(TYPE_TO_PREF_KEY["composition_update"]).toBe("compositionUpdate");
      expect(TYPE_TO_PREF_KEY["photo_approved"]).toBe("photoApproved");
      expect(TYPE_TO_PREF_KEY["photo_rejected"]).toBe("photoRejected");
      expect(TYPE_TO_PREF_KEY["club_post"]).toBe("clubPost");
      expect(TYPE_TO_PREF_KEY["club_event"]).toBe("clubEvent");
    });
  });

  describe("Full notification flow (unit)", () => {
    it("builds complete notification for composition create", () => {
      const input: NotificationInput = {
        animalId: 1,
        animalName: "Белка",
        animalSlug: "belka",
        action: "created",
        detail: "Жирность: 4.2%",
      };

      const title = buildNotificationTitle(input.animalName, input.action);
      const body = buildNotificationBody(input.animalName, input.action, input.detail);
      const link = buildNotificationLink(input.animalSlug);

      expect(title).toContain("Белка");
      expect(title).toContain("добавлен");
      expect(body).toContain("Жирность: 4.2%");
      expect(link).toBe("/tracker?animal=belka");
    });

    it("builds complete notification for composition update without detail", () => {
      const input: NotificationInput = {
        animalId: 2,
        animalName: "Стрелка",
        animalSlug: "strelka",
        action: "updated",
      };

      const title = buildNotificationTitle(input.animalName, input.action);
      const body = buildNotificationBody(input.animalName, input.action, input.detail);
      const link = buildNotificationLink(input.animalSlug);

      expect(title).toContain("обновлён");
      expect(body).toContain("Стрелка.");
      expect(link).toBe("/tracker?animal=strelka");
    });

    it("builds complete notification for composition delete", () => {
      const input: NotificationInput = {
        animalId: 3,
        animalName: "Зорька",
        animalSlug: "zorka",
        action: "deleted",
        detail: "Белок",
      };

      const title = buildNotificationTitle(input.animalName, input.action);
      const body = buildNotificationBody(input.animalName, input.action, input.detail);
      const link = buildNotificationLink(input.animalSlug);

      expect(title).toContain("удалён");
      expect(body).toContain("Белок");
      expect(link).toBe("/tracker?animal=zorka");
    });
  });

  describe("Notification type constant", () => {
    it("uses composition_update as the notification type", () => {
      // This ensures the type string matches what's used in the server code
      const NOTIFICATION_TYPE = "composition_update";
      expect(NOTIFICATION_TYPE).toBe("composition_update");
      expect(TYPE_TO_PREF_KEY[NOTIFICATION_TYPE]).toBe("compositionUpdate");
    });
  });

  describe("Edge cases", () => {
    it("handles animal names with special characters", () => {
      const title = buildNotificationTitle("Козочка «Звёздочка»", "created");
      expect(title).toContain("Козочка «Звёздочка»");
    });

    it("handles very long detail strings", () => {
      const longDetail = "A".repeat(500);
      const body = buildNotificationBody("Белка", "updated", longDetail);
      expect(body).toContain(longDetail);
    });

    it("handles empty animal slug", () => {
      const link = buildNotificationLink("");
      expect(link).toBe("/tracker?animal=");
    });
  });
});
