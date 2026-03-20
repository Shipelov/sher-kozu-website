import { describe, expect, it } from "vitest";

/* ═══════════════════════════════════════════════════════════════
   Chat Notification — Unit Tests
   Tests cover:
   1. Notification is triggered only for owner messages (not admin)
   2. Notification title includes owner name and animal name
   3. Text preview is truncated at 100 characters
   4. Photo-only messages show 📷 Фото as preview
   5. Fallback owner name when ctx.user.name is null
   ═══════════════════════════════════════════════════════════════ */

type Sender = "owner" | "admin";

/**
 * Determines whether a notification should be sent.
 * Mirrors the server-side logic in productTrack.ts sendMessage.
 */
function shouldNotifyAdmin(sender: Sender): boolean {
  return sender === "owner";
}

/**
 * Builds the notification title.
 * Mirrors the server-side logic in productTrack.ts sendMessage.
 */
function buildNotificationTitle(ownerName: string | null, animalName: string): string {
  const name = ownerName ?? "Владелец";
  return `💬 Новое сообщение от ${name} (${animalName})`;
}

/**
 * Builds the notification content preview.
 * Mirrors the server-side logic in productTrack.ts sendMessage.
 */
function buildNotificationPreview(text: string | null, hasPhoto: boolean): string {
  if (text) {
    return text.length > 100 ? text.slice(0, 100) + "…" : text;
  }
  return hasPhoto ? "📷 Фото" : "";
}

describe("Chat notification: trigger conditions", () => {
  it("should notify admin when sender is owner", () => {
    expect(shouldNotifyAdmin("owner")).toBe(true);
  });

  it("should NOT notify admin when sender is admin", () => {
    expect(shouldNotifyAdmin("admin")).toBe(false);
  });
});

describe("Chat notification: title formatting", () => {
  it("includes owner name and animal name", () => {
    const title = buildNotificationTitle("Иван Петров", "Мира");
    expect(title).toBe("💬 Новое сообщение от Иван Петров (Мира)");
  });

  it("uses fallback when owner name is null", () => {
    const title = buildNotificationTitle(null, "Злата");
    expect(title).toBe("💬 Новое сообщение от Владелец (Злата)");
  });

  it("handles long owner names correctly", () => {
    const title = buildNotificationTitle("Александра Константиновна Иванова", "Руфа");
    expect(title).toContain("Александра Константиновна Иванова");
    expect(title).toContain("Руфа");
  });
});

describe("Chat notification: content preview", () => {
  it("returns full text when under 100 characters", () => {
    const preview = buildNotificationPreview("Здравствуйте, хотел уточнить по доставке сыра.", false);
    expect(preview).toBe("Здравствуйте, хотел уточнить по доставке сыра.");
  });

  it("truncates text at 100 characters with ellipsis", () => {
    const longText = "а".repeat(150);
    const preview = buildNotificationPreview(longText, false);
    expect(preview).toHaveLength(101); // 100 chars + "…"
    expect(preview.endsWith("…")).toBe(true);
  });

  it("returns exactly 100 chars without truncation", () => {
    const exactText = "б".repeat(100);
    const preview = buildNotificationPreview(exactText, false);
    expect(preview).toBe(exactText);
    expect(preview).toHaveLength(100);
  });

  it("returns photo placeholder for photo-only message", () => {
    const preview = buildNotificationPreview(null, true);
    expect(preview).toBe("📷 Фото");
  });

  it("returns text preview even when photo is also present", () => {
    const preview = buildNotificationPreview("Вот фото продукции", true);
    expect(preview).toBe("Вот фото продукции");
  });

  it("returns empty string when no text and no photo", () => {
    const preview = buildNotificationPreview(null, false);
    expect(preview).toBe("");
  });
});
