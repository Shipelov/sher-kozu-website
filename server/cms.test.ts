import { describe, it, expect, vi, beforeEach } from "vitest";

/* ─── Mock DB layer ─── */
let mockRows: any[] = [];
let insertedRows: any[] = [];
let updatedSets: any[] = [];
let deletedIds: number[] = [];
let lastInsertId = 100;

const chainable = () => {
  const chain: any = {
    _wheres: [] as any[],
    _limit: undefined as number | undefined,
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
    then: (resolve: any) => resolve(chain._limit ? mockRows.slice(0, chain._limit) : mockRows),
  };
  return chain;
};

const mockDb = {
  select: () => chainable(),
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

  it("returns empty array when no blocks exist", async () => {
    mockRows = [];
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.cms.getPageBlocks({ page: "nonexistent" });
    expect(result).toHaveLength(0);
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
    expect(updatedSets[0].contentType).toBe("image");
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
  it("seeds default blocks for home page when empty", async () => {
    mockRows = []; // No existing blocks
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.cms.seedDefaults({ page: "home" });

    expect(result.seeded).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(insertedRows.length).toBeGreaterThan(0);
  });

  it("does not overwrite existing blocks", async () => {
    mockRows = [{ id: 1, page: "home", blockKey: "hero_title" }];
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
});
