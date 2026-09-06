import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return {
    ...actual,
    invokeLLM: vi.fn().mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: "Проверенный ответ Зои",
            consideredFacts: [],
            answer: "Общий информационный ответ без персонального расчёта.",
            mealPlan: {
              enabled: false,
              title: "",
              meals: [],
              dailyNutrition: {
                kcal: null,
                proteinG: null,
                fatG: null,
                carbsG: null,
                estimated: false,
              },
              farmProductShareText: "",
            },
            substitutions: [],
            warnings: [],
            sources: [],
            referenceNote: "",
          }),
        },
      }],
    }),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "test@example.com",
    name: "Тестовый Пользователь",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return createUserContext({ id: 1, role: "admin", openId: "admin-1", name: "Admin" });
}

// ═══════════════════════════════════════════════════════════════
// Knowledge Base — Public Procedures
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.knowledge.list", () => {
  it("returns a list of knowledge entries for guests", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.list({
      limit: 5,
      offset: 0,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
    // Should have seeded data
    expect(result.total).toBeGreaterThan(0);
  });

  it("filters knowledge entries by category", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.list({
      category: "breed_profile",
      limit: 50,
      offset: 0,
    });

    expect(result.items.length).toBeGreaterThan(0);
    // All returned entries should be breed_profile category
    for (const entry of result.items) {
      expect(entry.category).toBe("breed_profile");
    }
  });
});

describe("nutritionist.knowledge.search", () => {
  it("searches knowledge base by query", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.search({
      query: "козье молоко кальций",
      limit: 5,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.some((entry) => /коз|молок|кальц/i.test(`${entry.title} ${entry.content}`)),
    ).toBe(true);
  });

  it.each([
    ["Сколько кальция в овечьем молоке?", [/овеч/i, /кальц/i]],
    ["Сколько белка в овечьем молоке?", [/овеч/i, /белк/i]],
    ["Безопасен ли А2 казеин при аллергии?", [/(?:a2|а2)/i, /казеин/i]],
    ["Подходит ли козье молоко при непереносимости лактозы?", [/коз/i, /лактоз/i]],
    ["Какие витамины есть в козьем сыре?", [/коз/i, /сыр/i]],
    ["Полезны ли ферментированные продукты для микробиома?", [/микробиом/i]],
  ])("retrieves relevant knowledge for %s", async (query, patterns) => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.search({ query, limit: 6 });
    const searchableText = result.map((entry) => `${entry.title} ${entry.content}`).join("\n");

    expect(result.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(searchableText).toMatch(pattern);
    }
  });
});

describe("nutritionist.knowledge.getById", () => {
  it("returns a specific knowledge entry by ID", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    // First get a list to find a valid ID
    const list = await caller.nutritionist.knowledge.list({ limit: 1, offset: 0 });
    expect(list.items.length).toBeGreaterThan(0);

    const entry = await caller.nutritionist.knowledge.getById({
      id: list.items[0].id,
    });

    expect(entry).toBeDefined();
    expect(entry.id).toBe(list.items[0].id);
    expect(entry.title).toBeTruthy();
    expect(entry.content).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Chat — Public Procedure (flat: nutritionist.chat)
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.chat", () => {
  it("returns a response from Zoya for a guest user", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.chat({
      messages: [{ role: "user", content: "Чем козье молоко полезнее коровьего?" }],
      fingerprint: "test-fp-123",
    });

    expect(result).toBeDefined();
    expect(typeof result.reply).toBe("string");
    expect(result.reply.length).toBeGreaterThan(10);
    expect(result.userType).toBe("guest");
  }, 30000);

  it("returns a response for an authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.chat({
      messages: [{ role: "user", content: "Какие продукты из козьего молока лучше для пищеварения?" }],
    });

    expect(result).toBeDefined();
    expect(typeof result.reply).toBe("string");
    expect(result.reply.length).toBeGreaterThan(10);
    expect(["guest", "registered", "owner"]).toContain(result.userType);
  }, 30000);
});

// ═══════════════════════════════════════════════════════════════
// Sessions — Protected Procedures
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.listSessions", () => {
  it("requires authentication", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.nutritionist.listSessions()).rejects.toThrow();
  });

  it("returns sessions for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.listSessions();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Profile — Protected Procedures
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.profile", () => {
  it("requires authentication for getProfile", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.nutritionist.getProfile()).rejects.toThrow();
  });

  it("returns profile for authenticated user (may be null)", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.getProfile();
    // Profile may be null if not yet created
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("updates profile for authenticated user", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.updateProfile({
      goals: ["healthy_eating", "weight_management"],
      allergies: ["орехи"],
    });

    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// Admin — Knowledge Management
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.admin.knowledge", () => {
  it("rejects non-admin users from creating knowledge", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.nutritionist.knowledge.create({
        category: "general",
        title: "Test entry",
        content: "Test content",
        confidence: "verified",
      })
    ).rejects.toThrow();
  });

  it("allows admin to create knowledge entry", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.create({
      category: "general",
      title: "Временная тестовая запись от админа",
      content: "Временное содержание для проверки создания записи через админ-панель.",
      confidence: "verified",
      tags: ["тест", "админ"],
    });

    try {
      expect(result).toBeDefined();
      expect(result.title).toBe("Временная тестовая запись от админа");
      expect(result.status).toBe("active");
    } finally {
      await caller.nutritionist.knowledge.delete({ id: result.id });
    }
  });

  it("allows admin to update knowledge entry", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // First create an entry
    const created = await caller.nutritionist.knowledge.create({
      category: "general",
      title: "Запись для обновления",
      content: "Оригинальное содержание.",
      confidence: "verified",
    });

    try {
      // Then update it
      const updated = await caller.nutritionist.knowledge.update({
        id: created.id,
        title: "Временно обновлённая запись",
        content: "Временно обновлённое содержание.",
      });

      expect(updated).toBeDefined();
      expect(updated.title).toBe("Временно обновлённая запись");
    } finally {
      await caller.nutritionist.knowledge.delete({ id: created.id });
    }
  });

  it("allows admin to delete knowledge entry", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create an entry to delete
    const created = await caller.nutritionist.knowledge.create({
      category: "general",
      title: "Запись для удаления",
      content: "Будет удалена.",
      confidence: "unverified",
    });

    const result = await caller.nutritionist.knowledge.delete({
      id: created.id,
    });

    expect(result).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Admin — Import & Search Jobs
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.admin.imports", () => {
  it("rejects non-admin users from listing imports", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.nutritionist.knowledge.listImports()
    ).rejects.toThrow();
  });

  it("allows admin to list imports", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.listImports();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("nutritionist.admin.searchSettings", () => {
  it("allows admin to get search settings", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.knowledge.getSearchSettings();

    // May be null if not yet configured
    expect(result === null || typeof result === "object").toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Recipes — Public
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.listRecipes", () => {
  it("returns recipes list for guests", async () => {
    const ctx = createGuestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.listRecipes();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Analytics — Admin
// ═══════════════════════════════════════════════════════════════

describe("nutritionist.analytics", () => {
  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.nutritionist.analytics()).rejects.toThrow();
  });

  it("returns analytics for admin", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.nutritionist.analytics();

    expect(result).toBeDefined();
    expect(typeof result.sessions).toBe("number");
    expect(typeof result.messages).toBe("number");
    expect(result.period).toBeDefined();
    expect(typeof result.activeKnowledgeEntries).toBe("number");
  });
});
