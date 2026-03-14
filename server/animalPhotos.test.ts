import { describe, expect, it } from "vitest";

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type PhotoRecord = {
  photoId: number;
  sortOrder: number;
  isCover: boolean;
};

function buildPhotoMeta(sizeBytes: number) {
  return `Загружено владельцем · ${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function sanitizeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "photo";
}

function buildPhotoKey(animalSlug: string, ownerOpenId: string, timestamp: number, fileName: string) {
  return `animal-photos/${animalSlug}/${ownerOpenId}/${timestamp}-${sanitizeFileName(fileName)}`;
}

function validateUploadFile(type: string, sizeBytes: number) {
  const hasAllowedType = ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number]);
  const hasAllowedSize = sizeBytes <= MAX_UPLOAD_SIZE_BYTES;

  return {
    hasAllowedType,
    hasAllowedSize,
    isValid: hasAllowedType && hasAllowedSize,
  };
}

function resolveCoverImageId(imageIds: string[], currentCoverId: string) {
  if (!imageIds.length) return null;
  return imageIds.includes(currentCoverId) ? currentCoverId : imageIds[0];
}

function reorderPhotoRecords(records: PhotoRecord[], orderedPhotoIds: number[]) {
  const indexById = new Map(orderedPhotoIds.map((photoId, index) => [photoId, index]));

  return records
    .map((record) => ({
      ...record,
      sortOrder: indexById.get(record.photoId) ?? record.sortOrder,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
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

  it("accepts only supported image types within size limit", () => {
    expect(validateUploadFile("image/jpeg", 3 * 1024 * 1024)).toEqual({
      hasAllowedType: true,
      hasAllowedSize: true,
      isValid: true,
    });
    expect(validateUploadFile("image/gif", 1024)).toEqual({
      hasAllowedType: false,
      hasAllowedSize: true,
      isValid: false,
    });
    expect(validateUploadFile("image/png", MAX_UPLOAD_SIZE_BYTES + 1)).toEqual({
      hasAllowedType: true,
      hasAllowedSize: false,
      isValid: false,
    });
  });

  it("falls back to first image when current cover no longer exists", () => {
    expect(resolveCoverImageId(["user-1", "cover", "live"], "user-1")).toBe("user-1");
    expect(resolveCoverImageId(["cover", "live"], "user-1")).toBe("cover");
    expect(resolveCoverImageId([], "user-1")).toBeNull();
  });

  it("preserves cover flag while reassigning sequential sort order", () => {
    const reordered = reorderPhotoRecords(
      [
        { photoId: 11, sortOrder: 0, isCover: false },
        { photoId: 22, sortOrder: 1, isCover: true },
        { photoId: 33, sortOrder: 2, isCover: false },
      ],
      [33, 22, 11],
    );

    expect(reordered).toEqual([
      { photoId: 33, sortOrder: 0, isCover: false },
      { photoId: 22, sortOrder: 1, isCover: true },
      { photoId: 11, sortOrder: 2, isCover: false },
    ]);
  });

  it("moves the chosen photo to the front when requested order starts with the future first item", () => {
    const reordered = reorderPhotoRecords(
      [
        { photoId: 101, sortOrder: 0, isCover: true },
        { photoId: 202, sortOrder: 1, isCover: false },
        { photoId: 303, sortOrder: 2, isCover: false },
      ],
      [202, 101, 303],
    );

    expect(reordered.map((photo) => photo.photoId)).toEqual([202, 101, 303]);
    expect(reordered.map((photo) => photo.sortOrder)).toEqual([0, 1, 2]);
    expect(reordered.find((photo) => photo.isCover)?.photoId).toBe(101);
  });
});
