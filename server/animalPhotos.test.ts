import { describe, expect, it } from "vitest";

function buildPhotoMeta(sizeBytes: number) {
  return `Загружено владельцем · ${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

function buildPhotoKey(animalSlug: string, ownerOpenId: string, timestamp: number, fileName: string) {
  return `animal-photos/${animalSlug}/${ownerOpenId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

describe("animal photo helpers", () => {
  it("sanitizes file names for storage keys", () => {
    expect(sanitizeFileName("Марта Весна 2026!.JPG")).toBe("2026-.jpg");
    expect(sanitizeFileName("family photo.png")).toBe("family-photo.png");
  });

  it("builds stable storage key paths", () => {
    expect(buildPhotoKey("marta", "owner-1", 1710000000000, "family photo.png")).toBe(
      "animal-photos/marta/owner-1/1710000000000-family-photo.png",
    );
  });

  it("formats photo metadata in kilobytes", () => {
    expect(buildPhotoMeta(512)).toBe("Загружено владельцем · 1 KB");
    expect(buildPhotoMeta(4096)).toBe("Загружено владельцем · 4 KB");
  });
});
