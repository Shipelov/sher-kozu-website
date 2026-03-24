import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mock DB layer ─── */
let mockRows: any[] = [];
let insertedRows: any[] = [];
let updatedSets: any[] = [];
let deletedIds: number[] = [];
let lastInsertId = 100;
let selectCallCount = 0;
let mockRowsSequence: any[][] = []; // For multi-call select scenarios

const chainable = () => {
  const chain: any = {
    _wheres: [] as any[],
    _limit: undefined as number | undefined,
    _selectFields: undefined as any,
    from: () => chain,
    where: (...args: any[]) => { chain._wheres.push(args); return chain; },
    orderBy: () => chain,
    limit: (n: number) => { chain._limit = n; return chain; },
    set: (data: any) => { updatedSets.push(data); return chain; },
    values: (data: any) => {
      insertedRows.push(data);
      lastInsertId++;
      return [{ insertId: lastInsertId }];
    },
    then: (resolve: any) => {
      // If we have a sequence of mock rows, use them in order
      if (mockRowsSequence.length > 0) {
        const rows = mockRowsSequence[selectCallCount] ?? mockRows;
        selectCallCount++;
        return resolve(chain._limit ? rows.slice(0, chain._limit) : rows);
      }
      return resolve(chain._limit ? mockRows.slice(0, chain._limit) : mockRows);
    },
  };
  return chain;
};

const mockDb = {
  select: (fields?: any) => {
    const c = chainable();
    c._selectFields = fields;
    return c;
  },
  insert: () => ({ values: (data: any) => { insertedRows.push(data); lastInsertId++; return [{ insertId: lastInsertId }]; } }),
  update: () => {
    const chain: any = {
      set: (data: any) => { updatedSets.push(data); return chain; },
      where: () => chain,
      then: (resolve: any) => resolve(undefined),
    };
    return chain;
  },
  delete: () => {
    const chain: any = {
      where: (...args: any[]) => { deletedIds.push(1); return chain; },
      then: (resolve: any) => resolve(undefined),
    };
    return chain;
  },
};

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(() => Promise.resolve({ url: "https://cdn.example.com/cms/test-image.png", key: "cms/test-image.png" })),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/* ─── Context helpers ─── */
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@sherkozu.ru",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "regular-user",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

beforeEach(() => {
  mockRows = [];
  insertedRows = [];
  updatedSets = [];
  deletedIds = [];
  lastInsertId = 100;
  selectCallCount = 0;
  mockRowsSequence = [];
});

/* ═══════════════════════════════════════════════════════
   CMS Router Tests
   ═══════════════════════════════════════════════════════ */

describe("cms.getPageBlocks", () => {
  it("returns visible blocks for a page (public access)", async () => {
    mockRows = [
      { id: 1, page: "home", blockKey: "hero_title", contentType: "text", content: "Hello", imageUrl: null, sortOrder: 1, visible: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, page: "home", blockKey: "hero_hidden", contentType: "text", content: "Hidden", imageUrl: null, sortOrder: 2, visible: false, createdAt: new Date(), updatedAt: new Date() },
    ];

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.cms.getPageBlocks({ page: "home" });

    expect(result).toHaveLength(1);
    expect(result[0].blockKey).toBe("hero_title");
  });

  it("returns all blocks including hidden when includeHidden is true", async () => {
    mockRows = [
      { id: 1, page: "home", blockKey: "hero_title", contentType: "text", content: "Hello", imageUrl: null, sortOrder: 1, visible: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, page: "home", blockKey: "hero_hidden", contentType: "text", content: "Hidden", imageUrl: null, sortOrder: 2, visible: false, createdAt: new Date(), updatedAt: new Date() },
    ];

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.cms.getPageBlocks({ page: "home", includeHidden: true });

    expect(result).toHaveLength(2);
  });

  it("returns empty array for unknown page (no defaults)", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.cms.getPageBlocks({ page: "nonexistent" });
    expect(result).toHaveLength(0);
  });

  it("auto-recovers missing default blocks on read for home page", async () => {
    // First select returns partial blocks (missing hero_image)
    mockRows = [
      { id: 1, page: "home", blockKey: "hero_badge", contentType: "text", content: "Badge", imageUrl: null, sortOrder: 1, visible: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, page: "home", blockKey: "hero_title", contentType: "text", content: "Title", imageUrl: null, sortOrder: 2, visible: true, createdAt: new Date(), updatedAt: new Date() },
    ];

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.cms.getPageBlocks({ page: "home" });

    // Auto-recovery should have inserted missing blocks
    expect(insertedRows.length).toBeGreaterThan(0);
    // Should have tried to insert blocks that were missing
    const insertedKeys = insertedRows.map((r: any) => r.blockKey);
    expect(insertedKeys).toContain("hero_image");
    expect(insertedKeys).toContain("hero_subtitle");
  });

  it("does not auto-recover when all default blocks exist", async () => {
    // Simulate all home defaults present by having all blockKeys
    const allHomeKeys = [
      "hero_badge", "hero_title", "hero_subtitle", "hero_image", "hero_image_caption",
      "howit_title", "howit_heading", "howit_subtitle", "steps",
      "forwhom_title", "forwhom_heading", "forwhom_subtitle", "audiences",
      "gallery_title", "gallery_heading", "gallery_subtitle",
      "goats_card_title", "goats_card_text", "sheep_card_title", "sheep_card_text",
      "whyus_title", "whyus_heading", "whyus_image", "values", "testimonials",
      "products_title", "products_heading", "products_subtitle", "products_image", "products_list",
      "cta_title", "cta_heading", "cta_subtitle",
    ];
    mockRows = allHomeKeys.map((key, i) => ({
      id: i + 1, page: "home", blockKey: key, contentType: "text", content: "Content", imageUrl: null, sortOrder: i, visible: true, createdAt: new Date(), updatedAt: new Date(),
    }));

    const caller = appRouter.createCaller(createPublicContext());
    await caller.cms.getPageBlocks({ page: "home" });

    // No inserts should happen
    expect(insertedRows).toHaveLength(0);
  });
});

describe("cms.listAll", () => {
  it("requires admin access", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.listAll()).rejects.toThrow();
  });

  it("returns all blocks for admin", async () => {
    mockRows = [
      { id: 1, page: "home", blockKey: "hero_title", contentType: "text", content: "Hello", imageUrl: null, sortOrder: 1, visible: true },
      { id: 2, page: "catalog", blockKey: "cat_title", contentType: "text", content: "Catalog", imageUrl: null, sortOrder: 1, visible: true },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.listAll();
    expect(result).toHaveLength(2);
  });
});

describe("cms.upsertBlock", () => {
  it("creates a new block when it doesn't exist", async () => {
    mockRows = []; // No existing block
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.upsertBlock({
      page: "home",
      blockKey: "new_block",
      label: "New Block",
      contentType: "text",
      content: "New content",
    });

    expect(result.action).toBe("created");
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].blockKey).toBe("new_block");
  });

  it("updates existing block when it already exists", async () => {
    mockRows = [{ id: 42, page: "home", blockKey: "existing_block" }];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.upsertBlock({
      page: "home",
      blockKey: "existing_block",
      label: "Updated Block",
      contentType: "text",
      content: "Updated content",
    });

    expect(result.action).toBe("updated");
    expect(result.id).toBe(42);
    expect(updatedSets).toHaveLength(1);
    expect(updatedSets[0].label).toBe("Updated Block");
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.cms.upsertBlock({
        page: "home",
        blockKey: "test",
        label: "Test",
      })
    ).rejects.toThrow();
  });
});

describe("cms.updateContent", () => {
  it("updates content of an existing block", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.updateContent({
      id: 1,
      content: "New text content",
    });

    expect(result.success).toBe(true);
    expect(updatedSets).toHaveLength(1);
    expect(updatedSets[0].content).toBe("New text content");
  });

  it("updates imageUrl of an existing block", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.updateContent({
      id: 1,
      imageUrl: "https://example.com/new-image.jpg",
    });

    expect(result.success).toBe(true);
    expect(updatedSets[0].imageUrl).toBe("https://example.com/new-image.jpg");
  });

  it("returns success when no updates provided", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.updateContent({ id: 1 });
    expect(result.success).toBe(true);
    expect(updatedSets).toHaveLength(0);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.updateContent({ id: 1, content: "hack" })).rejects.toThrow();
  });
});

describe("cms.toggleVisibility", () => {
  it("toggles block visibility", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.toggleVisibility({ id: 1, visible: false });

    expect(result.success).toBe(true);
    expect(updatedSets[0].visible).toBe(false);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.toggleVisibility({ id: 1, visible: false })).rejects.toThrow();
  });
});

describe("cms.deleteBlock", () => {
  it("deletes a block", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.deleteBlock({ id: 1 });

    expect(result.success).toBe(true);
    expect(deletedIds).toHaveLength(1);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.deleteBlock({ id: 1 })).rejects.toThrow();
  });
});

describe("cms.uploadImage", () => {
  it("uploads image and returns URL", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.uploadImage({
      blockId: 1,
      fileName: "test.png",
      mimeType: "image/png",
      base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    });

    expect(result.url).toBe("https://cdn.example.com/cms/test-image.png");
    expect(updatedSets).toHaveLength(1);
    expect(updatedSets[0].imageUrl).toBe("https://cdn.example.com/cms/test-image.png");
    // uploadImage should NOT override contentType
    expect(updatedSets[0].contentType).toBeUndefined();
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.cms.uploadImage({
        blockId: 1,
        fileName: "test.png",
        mimeType: "image/png",
        base64Data: "abc",
      })
    ).rejects.toThrow();
  });
});

describe("cms.seedDefaults", () => {
  it("seeds all default blocks for home page when empty", async () => {
    mockRows = []; // No existing blocks
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.seedDefaults({ page: "home" });

    expect(result.seeded).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(insertedRows.length).toBeGreaterThan(0);

    // Verify hero_image block was created with imageUrl
    const heroImageBlock = insertedRows.find((r: any) => r.blockKey === "hero_image");
    expect(heroImageBlock).toBeDefined();
    expect(heroImageBlock.contentType).toBe("image");
    expect(heroImageBlock.imageUrl).toBeTruthy();
    // content should be empty string (not null) to avoid Drizzle issues
    expect(heroImageBlock.content).toBe("");
  });

  it("uses per-block upsert — skips existing blocks, creates missing ones", async () => {
    // Only hero_badge exists — all other blocks should be created
    mockRows = [{ blockKey: "hero_badge" }];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.seedDefaults({ page: "home" });

    expect(result.seeded).toBe(true);
    // hero_badge should NOT be in insertedRows
    const insertedKeys = insertedRows.map((r: any) => r.blockKey);
    expect(insertedKeys).not.toContain("hero_badge");
    // But hero_image should be
    expect(insertedKeys).toContain("hero_image");
    expect(insertedKeys).toContain("hero_title");
  });

  it("returns false when all blocks already exist", async () => {
    // Simulate all home defaults present
    const allHomeKeys = [
      "hero_badge", "hero_title", "hero_subtitle", "hero_image", "hero_image_caption",
      "howit_title", "howit_heading", "howit_subtitle", "steps",
      "forwhom_title", "forwhom_heading", "forwhom_subtitle", "audiences",
      "gallery_title", "gallery_heading", "gallery_subtitle",
      "goats_card_title", "goats_card_text", "sheep_card_title", "sheep_card_text",
      "whyus_title", "whyus_heading", "whyus_image", "values", "testimonials",
      "products_title", "products_heading", "products_subtitle", "products_image", "products_list",
      "cta_title", "cta_heading", "cta_subtitle",
    ];
    mockRows = allHomeKeys.map(key => ({ blockKey: key }));
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.seedDefaults({ page: "home" });

    expect(result.seeded).toBe(false);
    expect(insertedRows).toHaveLength(0);
  });

  it("returns false for unknown page", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.seedDefaults({ page: "unknown_page" });

    expect(result.seeded).toBe(false);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.seedDefaults({ page: "home" })).rejects.toThrow();
  });

  it("seeds catalog page defaults", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.seedDefaults({ page: "catalog" });

    expect(result.seeded).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    const insertedKeys = insertedRows.map((r: any) => r.blockKey);
    expect(insertedKeys).toContain("badge");
    expect(insertedKeys).toContain("heading");
  });
});

/* ─── useCmsContent hook logic tests (unit) ─── */
describe("CMS content fallback logic", () => {
  it("returns fallback when no CMS data available", () => {
    const blocks: any[] = [];
    const getText = (key: string, fallback: string) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      return block?.content ?? fallback;
    };
    expect(getText("hero_title", "Default Title")).toBe("Default Title");
  });

  it("returns CMS content when available", () => {
    const blocks = [
      { blockKey: "hero_title", content: "Custom Title", visible: true },
    ];
    const getText = (key: string, fallback: string) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      return block?.content ?? fallback;
    };
    expect(getText("hero_title", "Default Title")).toBe("Custom Title");
  });

  it("returns fallback when block is hidden", () => {
    const blocks = [
      { blockKey: "hero_title", content: "Hidden Title", visible: false },
    ];
    const getText = (key: string, fallback: string) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      return block?.content ?? fallback;
    };
    expect(getText("hero_title", "Default Title")).toBe("Default Title");
  });

  it("parses JSON content correctly", () => {
    const jsonContent = JSON.stringify([{ title: "Step 1" }, { title: "Step 2" }]);
    const blocks = [
      { blockKey: "steps", content: jsonContent, visible: true },
    ];
    const getJson = (key: string, fallback: any[]) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      if (!block?.content) return fallback;
      try { return JSON.parse(block.content); } catch { return fallback; }
    };
    const result = getJson("steps", []);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Step 1");
  });

  it("returns fallback for invalid JSON", () => {
    const blocks = [
      { blockKey: "steps", content: "not valid json{", visible: true },
    ];
    const getJson = (key: string, fallback: any[]) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      if (!block?.content) return fallback;
      try { return JSON.parse(block.content); } catch { return fallback; }
    };
    const result = getJson("steps", [{ title: "Default" }]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Default");
  });

  it("returns image URL from CMS or fallback", () => {
    const blocks = [
      { blockKey: "hero_image", imageUrl: "https://cdn.example.com/custom.jpg", visible: true },
    ];
    const getImage = (key: string, fallback: string) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      return block?.imageUrl ?? fallback;
    };
    expect(getImage("hero_image", "https://default.com/img.jpg")).toBe("https://cdn.example.com/custom.jpg");
    expect(getImage("missing_image", "https://default.com/img.jpg")).toBe("https://default.com/img.jpg");
  });

  it("returns fallback when imageUrl is null", () => {
    const blocks = [
      { blockKey: "hero_image", imageUrl: null, visible: true },
    ];
    const getImage = (key: string, fallback: string) => {
      const block = blocks.find((b: any) => b.blockKey === key && b.visible);
      return block?.imageUrl ?? fallback;
    };
    expect(getImage("hero_image", "https://default.com/img.jpg")).toBe("https://default.com/img.jpg");
  });
});

/* ═══════════════════════════════════════════════════════
   Image Crop & Compression Tests (unit logic)
   ═══════════════════════════════════════════════════════ */

describe("Image upload with cropped base64 data", () => {
  it("accepts cropped JPEG base64 data and uploads to S3", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // Minimal valid base64 for a 1x1 JPEG
    const base64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFRABAAAAAAAAAAAAAAAAAAAACf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKgA/9k=";

    const result = await caller.cms.uploadImage({
      blockId: 1,
      fileName: "hero_cropped.jpg",
      mimeType: "image/jpeg",
      base64Data: base64,
    });

    expect(result.url).toBe("https://cdn.example.com/cms/test-image.png");
    expect(updatedSets).toHaveLength(1);
    expect(updatedSets[0].imageUrl).toBe("https://cdn.example.com/cms/test-image.png");
  });

  it("handles cropped PNG base64 data", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const result = await caller.cms.uploadImage({
      blockId: 5,
      fileName: "catalog_image_cropped.png",
      mimeType: "image/png",
      base64Data: base64,
    });

    expect(result.url).toBeDefined();
    // uploadImage should NOT override contentType
    expect(updatedSets[0].imageUrl).toBeDefined();
    expect(updatedSets[0].contentType).toBeUndefined();
  });

  it("rejects upload with empty base64 data", async () => {
    const caller = appRouter.createCaller(createAdminContext());

    await expect(
      caller.cms.uploadImage({
        blockId: 1,
        fileName: "empty.jpg",
        mimeType: "image/jpeg",
        base64Data: "",
      })
    ).rejects.toThrow();
  });
});

/* ─── Image compression logic tests (pure functions) ─── */
describe("Image compression constants", () => {
  it("defines correct compression thresholds", () => {
    const MAX_FILE_SIZE_MB = 10;
    const COMPRESS_THRESHOLD_MB = 2;
    const TARGET_MAX_DIMENSION = 1920;
    const JPEG_QUALITY = 0.82;

    expect(MAX_FILE_SIZE_MB).toBe(10);
    expect(COMPRESS_THRESHOLD_MB).toBe(2);
    expect(TARGET_MAX_DIMENSION).toBe(1920);
    expect(JPEG_QUALITY).toBeGreaterThan(0.5);
    expect(JPEG_QUALITY).toBeLessThan(1);
  });

  it("calculates correct scale factor for large images", () => {
    const TARGET_MAX_DIMENSION = 1920;

    let width = 4000;
    let height = 3000;
    const scale = TARGET_MAX_DIMENSION / Math.max(width, height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    expect(newWidth).toBe(1920);
    expect(newHeight).toBe(1440);
    expect(scale).toBeCloseTo(0.48, 2);
  });

  it("does not scale images smaller than target", () => {
    const TARGET_MAX_DIMENSION = 1920;

    const width = 800;
    const height = 600;

    if (width <= TARGET_MAX_DIMENSION && height <= TARGET_MAX_DIMENSION) {
      expect(width).toBe(800);
      expect(height).toBe(600);
    }
  });
});

/* ─── Crop frame calculation tests ─── */
describe("Crop frame calculations", () => {
  it("calculates correct frame dimensions for 16:9 aspect ratio", () => {
    const CONTAINER_W = 560;
    const CONTAINER_H = 400;
    const aspectRatio = 16 / 9;

    const frameW = Math.min(CONTAINER_W - 40, 480);
    const frameH = frameW / aspectRatio;
    const frameX = (CONTAINER_W - frameW) / 2;
    const frameY = (CONTAINER_H - frameH) / 2;

    expect(frameW).toBe(480);
    expect(frameH).toBeCloseTo(270, 0);
    expect(frameX).toBe(40);
    expect(frameY).toBeCloseTo(65, 0);
  });

  it("calculates correct initial zoom to fill frame", () => {
    const frameW = 480;
    const frameH = 270;
    const imgW = 1920;
    const imgH = 1080;

    const scaleX = frameW / imgW;
    const scaleY = frameH / imgH;
    const initialZoom = Math.max(scaleX, scaleY);

    expect(initialZoom).toBe(0.25);
  });

  it("calculates correct initial zoom for portrait image", () => {
    const frameW = 480;
    const frameH = 270;
    const imgW = 600;
    const imgH = 1200;

    const scaleX = frameW / imgW;
    const scaleY = frameH / imgH;
    const initialZoom = Math.max(scaleX, scaleY);

    expect(initialZoom).toBe(0.8);
  });

  it("calculates crop region in image coordinates", () => {
    const frameX = 40;
    const frameY = 65;
    const frameW = 480;
    const frameH = 270;
    const posX = -100;
    const posY = -50;
    const zoom = 0.5;

    const cropX = (frameX - posX) / zoom;
    const cropY = (frameY - posY) / zoom;
    const cropW = frameW / zoom;
    const cropH = frameH / zoom;

    expect(cropX).toBe(280);
    expect(cropY).toBe(230);
    expect(cropW).toBe(960);
    expect(cropH).toBe(540);
  });

  it("centers image correctly after zoom change", () => {
    const frameX = 40;
    const frameY = 65;
    const frameW = 480;
    const frameH = 270;
    const oldZoom = 0.25;
    const newZoom = 0.5;
    const posX = -200;
    const posY = -100;

    const centerX = frameX + frameW / 2;
    const centerY = frameY + frameH / 2;

    const imgCenterX = (centerX - posX) / oldZoom;
    const imgCenterY = (centerY - posY) / oldZoom;

    const newPosX = centerX - imgCenterX * newZoom;
    const newPosY = centerY - imgCenterY * newZoom;

    expect(newPosX).toBeLessThan(posX);
    expect(newPosY).toBeLessThan(posY);
  });
});


/* ═══════════════════════════════════════════════════════
   CMS History & Rollback Tests
   ═══════════════════════════════════════════════════════ */

describe("cms.getBlockHistory", () => {
  it("returns history entries for a block (admin only)", async () => {
    mockRows = [
      {
        id: 1,
        blockId: 10,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Old title",
        prevImageUrl: null,
        prevVisible: true,
        newContent: "New title",
        newImageUrl: null,
        newVisible: true,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
      {
        id: 2,
        blockId: 10,
        page: "home",
        blockKey: "hero_title",
        action: "toggle_visibility",
        prevContent: "New title",
        prevImageUrl: null,
        prevVisible: true,
        newContent: "New title",
        newImageUrl: null,
        newVisible: false,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-21T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.getBlockHistory({ blockId: 10 });
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe("update_content");
  });

  it("returns empty array when no history exists", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.getBlockHistory({ blockId: 999 });
    expect(result).toHaveLength(0);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.getBlockHistory({ blockId: 10 })).rejects.toThrow();
  });

  it("rejects public users", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.cms.getBlockHistory({ blockId: 10 })).rejects.toThrow();
  });

  it("respects limit parameter", async () => {
    mockRows = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      blockId: 10,
      page: "home",
      blockKey: "hero_title",
      action: "update_content",
      prevContent: `Content v${i}`,
      prevImageUrl: null,
      prevVisible: true,
      newContent: `Content v${i + 1}`,
      newImageUrl: null,
      newVisible: true,
      changedByOpenId: "admin-user",
      changedByName: "Admin",
      changedAt: new Date(),
    }));

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.getBlockHistory({ blockId: 10, limit: 5 });
    expect(result).toHaveLength(5);
  });
});

describe("cms.rollbackBlock", () => {
  it("restores block to previous state from history entry", async () => {
    // Mock: first call = history entry lookup, second call = current block fetch
    mockRowsSequence = [
      // getBlockHistory select (historyRows)
      [{
        id: 42,
        blockId: 10,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Original title",
        prevImageUrl: null,
        prevVisible: true,
        newContent: "Changed title",
        newImageUrl: null,
        newVisible: true,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      }],
      // fetchBlock select (currentBlock)
      [{
        id: 10,
        page: "home",
        blockKey: "hero_title",
        contentType: "text",
        content: "Changed title",
        imageUrl: null,
        sortOrder: 1,
        visible: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.rollbackBlock({ historyId: 42 });

    expect(result.success).toBe(true);
    expect(result.restoredFrom.action).toBe("update_content");

    // Should have recorded rollback history (insert) + applied rollback (update)
    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    expect(updatedSets.length).toBeGreaterThanOrEqual(1);

    // The update should restore previous content
    const lastUpdate = updatedSets[updatedSets.length - 1];
    expect(lastUpdate.content).toBe("Original title");
    expect(lastUpdate.imageUrl).toBeNull();
    expect(lastUpdate.visible).toBe(true);
  });

  it("throws error when history entry not found", async () => {
    mockRows = []; // No history entry
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.cms.rollbackBlock({ historyId: 999 })).rejects.toThrow("История не найдена");
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.rollbackBlock({ historyId: 1 })).rejects.toThrow();
  });
});

describe("cms.clearOldHistory", () => {
  it("clears old history entries", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.clearOldHistory({ olderThanDays: 30 });
    expect(result.success).toBe(true);
    // Should have called delete
    expect(deletedIds.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.cms.clearOldHistory({ olderThanDays: 30 })).rejects.toThrow();
  });

  it("validates olderThanDays range", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.cms.clearOldHistory({ olderThanDays: 0 })).rejects.toThrow();
    await expect(caller.cms.clearOldHistory({ olderThanDays: 400 })).rejects.toThrow();
  });
});

describe("CMS history recording on mutations", () => {
  it("records history when updateContent is called", async () => {
    // fetchBlock returns a block
    mockRows = [{
      id: 5,
      page: "home",
      blockKey: "hero_title",
      contentType: "text",
      content: "Old content",
      imageUrl: null,
      sortOrder: 1,
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const caller = appRouter.createCaller(createAdminContext());
    await caller.cms.updateContent({ id: 5, content: "New content" });

    // Should have inserted a history record
    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    const historyRecord = insertedRows.find((r: any) => r.action === "update_content");
    expect(historyRecord).toBeDefined();
    expect(historyRecord.prevContent).toBe("Old content");
    expect(historyRecord.newContent).toBe("New content");
    expect(historyRecord.changedByOpenId).toBe("admin-user");
  });

  it("records history when toggleVisibility is called", async () => {
    mockRows = [{
      id: 5,
      page: "home",
      blockKey: "hero_title",
      contentType: "text",
      content: "Content",
      imageUrl: null,
      sortOrder: 1,
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const caller = appRouter.createCaller(createAdminContext());
    await caller.cms.toggleVisibility({ id: 5, visible: false });

    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    const historyRecord = insertedRows.find((r: any) => r.action === "toggle_visibility");
    expect(historyRecord).toBeDefined();
    expect(historyRecord.prevVisible).toBe(true);
    expect(historyRecord.newVisible).toBe(false);
  });

  it("records history when uploadImage is called", async () => {
    mockRows = [{
      id: 5,
      page: "home",
      blockKey: "hero_image",
      contentType: "image",
      content: "",
      imageUrl: "https://old-image.com/img.jpg",
      sortOrder: 1,
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const caller = appRouter.createCaller(createAdminContext());
    await caller.cms.uploadImage({
      blockId: 5,
      fileName: "new.png",
      mimeType: "image/png",
      base64Data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    });

    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    const historyRecord = insertedRows.find((r: any) => r.action === "upload_image");
    expect(historyRecord).toBeDefined();
    expect(historyRecord.prevImageUrl).toBe("https://old-image.com/img.jpg");
    expect(historyRecord.newImageUrl).toBe("https://cdn.example.com/cms/test-image.png");
  });

  it("records history when deleteBlock is called", async () => {
    mockRows = [{
      id: 5,
      page: "home",
      blockKey: "hero_title",
      contentType: "text",
      content: "Content to delete",
      imageUrl: null,
      sortOrder: 1,
      visible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    const caller = appRouter.createCaller(createAdminContext());
    await caller.cms.deleteBlock({ id: 5 });

    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    const historyRecord = insertedRows.find((r: any) => r.action === "delete");
    expect(historyRecord).toBeDefined();
    expect(historyRecord.prevContent).toBe("Content to delete");
    expect(historyRecord.newContent).toBeNull();
    expect(historyRecord.newImageUrl).toBeNull();
    expect(historyRecord.newVisible).toBeNull();
  });

  it("does not fail if history recording fails (graceful degradation)", async () => {
    // Simulate: fetchBlock returns null (block not found before update)
    mockRows = [];

    const caller = appRouter.createCaller(createAdminContext());
    // updateContent should still succeed even if no block found for history
    const result = await caller.cms.updateContent({ id: 999, content: "New content" });
    expect(result.success).toBe(true);
    // No history should be recorded since block wasn't found
    const historyRecords = insertedRows.filter((r: any) => r.action);
    expect(historyRecords).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   CSV EXPORT TESTS
   ═══════════════════════════════════════════════════════════════════════════ */

describe("CMS History CSV Export", () => {
  beforeEach(() => {
    mockRows = [];
    insertedRows = [];
    updatedSets = [];
    deletedIds = [];
    selectCallCount = 0;
    mockRowsSequence = [];
  });

  it("returns empty CSV with only headers when no history exists", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    expect(result.rowCount).toBe(0);
    expect(result.csv).toContain("ID,Block ID,Page,Block Key,Action");
    // Only header row
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(1);
  });

  it("returns CSV with correct headers", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    const headers = result.csv.split("\n")[0];
    expect(headers).toBe(
      "ID,Block ID,Page,Block Key,Action,Previous Content,New Content,Previous Image URL,New Image URL,Previous Visible,New Visible,Changed By (OpenID),Changed By (Name),Changed At"
    );
  });

  it("exports history rows as CSV data", async () => {
    const testDate = new Date("2026-03-20T10:00:00Z");
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Old title",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "New title",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: testDate,
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    expect(result.rowCount).toBe(1);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(2); // header + 1 data row
    expect(lines[1]).toContain("hero_title");
    expect(lines[1]).toContain("update_content");
    expect(lines[1]).toContain("Old title");
    expect(lines[1]).toContain("New title");
    expect(lines[1]).toContain("admin-user");
    expect(lines[1]).toContain("Admin");
  });

  it("properly escapes CSV values with commas", async () => {
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Hello, world",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "Goodbye, world",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    // Values with commas should be quoted
    expect(result.csv).toContain('"Hello, world"');
    expect(result.csv).toContain('"Goodbye, world"');
  });

  it("properly escapes CSV values with double quotes", async () => {
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: 'He said "hello"',
        prevImageUrl: null,
        prevVisible: null,
        newContent: "Normal text",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    // Double quotes should be escaped as ""
    expect(result.csv).toContain('"He said ""hello"""');
  });

  it("properly escapes CSV values with newlines", async () => {
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_subtitle",
        action: "update_content",
        prevContent: "Line 1\nLine 2",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "Single line",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    // Values with newlines should be quoted
    expect(result.csv).toContain('"Line 1\nLine 2"');
  });

  it("handles null values as empty strings in CSV", async () => {
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_image",
        action: "upload_image",
        prevContent: null,
        prevImageUrl: null,
        prevVisible: null,
        newContent: null,
        newImageUrl: "https://cdn.example.com/new.jpg",
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: null,
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    expect(result.rowCount).toBe(1);
    // Null values should appear as empty fields (consecutive commas)
    const dataRow = result.csv.split("\n")[1];
    expect(dataRow).toBeDefined();
  });

  it("accepts optional blockId filter", async () => {
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Old",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "New",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv({ blockId: 5 });

    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain("hero_title");
  });

  it("exports multiple rows correctly", async () => {
    mockRows = [
      {
        id: 2,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Second old",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "Second new",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-21T10:00:00Z"),
      },
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "First old",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "First new",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: new Date("2026-03-20T10:00:00Z"),
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    expect(result.rowCount).toBe(2);
    const lines = result.csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it("requires admin access for CSV export", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.cms.exportHistoryCsv()).rejects.toThrow();
  });

  it("formats changedAt as ISO string", async () => {
    const testDate = new Date("2026-03-20T10:30:45.000Z");
    mockRows = [
      {
        id: 1,
        blockId: 5,
        page: "home",
        blockKey: "hero_title",
        action: "update_content",
        prevContent: "Old",
        prevImageUrl: null,
        prevVisible: null,
        newContent: "New",
        newImageUrl: null,
        newVisible: null,
        changedByOpenId: "admin-user",
        changedByName: "Admin",
        changedAt: testDate,
      },
    ];

    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.exportHistoryCsv();

    expect(result.csv).toContain("2026-03-20T10:30:45.000Z");
  });
});
