import { describe, expect, it, vi, beforeEach } from "vitest";
import { faqChatRouter } from "./routers/faqChat";
import type { TrpcContext } from "./_core/context";

/* ─── Mock the LLM module ─── */
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content:
            "Привет! Я Маша, управляющая фермой «Шерь Козу». Рада помочь!",
        },
      },
    ],
  }),
}));

/* ─── Mock the DB module (fire-and-forget analytics) ─── */
vi.mock("./db", () => {
  // Build a deeply chainable mock that supports all query patterns
  const emptyArrayResult = {
    then: (resolve: any) => resolve([]),
    [Symbol.iterator]: function* () {},
  };
  const countResult = {
    then: (resolve: any) => resolve([{ count: 0 }]),
    [Symbol.iterator]: function* () { yield { count: 0 }; },
  };

  const makeChainable = (): any => {
    const chain: any = {
      ...emptyArrayResult,
      where: vi.fn().mockImplementation(() => makeChainable()),
      orderBy: vi.fn().mockImplementation(() => makeChainable()),
      limit: vi.fn().mockImplementation(() => makeChainable()),
      groupBy: vi.fn().mockImplementation(() => makeChainable()),
    };
    return chain;
  };

  const makeFromChainable = (): any => {
    const chain: any = {
      ...countResult,
      where: vi.fn().mockImplementation(() => makeChainable()),
      orderBy: vi.fn().mockImplementation(() => makeChainable()),
      limit: vi.fn().mockImplementation(() => makeChainable()),
      groupBy: vi.fn().mockImplementation(() => makeChainable()),
    };
    return chain;
  };

  return {
    getDb: vi.fn().mockResolvedValue({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation(() => makeFromChainable()),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      execute: vi.fn().mockResolvedValue([]),
    }),
  };
});

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-open-id",
      name: "Admin",
      email: "admin@test.com",
      role: "admin",
    } as any,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "user-open-id",
      name: "User",
      email: "user@test.com",
      role: "user",
    } as any,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("faqChat.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a reply from Masha for a simple question", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Расскажи о ферме" }],
    });

    expect(result).toHaveProperty("reply");
    expect(typeof result.reply).toBe("string");
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("accepts conversation history with multiple messages", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [
        { role: "user", content: "Привет!" },
        { role: "assistant", content: "Привет! Чем могу помочь?" },
        { role: "user", content: "Какие породы коз есть?" },
      ],
    });

    expect(result).toHaveProperty("reply");
    expect(typeof result.reply).toBe("string");
  });

  it("accepts optional sessionId and source parameters", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет!" }],
      sessionId: "test-session-123",
      source: "floating",
    });

    expect(result).toHaveProperty("reply");
  });

  it("accepts source 'faq' for FAQ page chat", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет!" }],
      sessionId: "faq-session-456",
      source: "faq",
    });

    expect(result).toHaveProperty("reply");
  });

  it("accepts optional userName for personalization", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет!" }],
      sessionId: "test-session",
      userName: "Андрей",
    });

    expect(result).toHaveProperty("reply");
  });

  it("accepts optional currentPage for context-aware responses", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Что здесь есть?" }],
      sessionId: "test-session",
      currentPage: "/animals",
    });

    expect(result).toHaveProperty("reply");
  });

  it("accepts both userName and currentPage together", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет!" }],
      sessionId: "test-session",
      userName: "Мария",
      currentPage: "/marketplace",
    });

    expect(result).toHaveProperty("reply");
  });

  it("rejects empty messages array", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.chat({ messages: [] })).rejects.toThrow();
  });

  it("rejects message content exceeding 10000 characters", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const longContent = "a".repeat(10001);
    await expect(
      caller.chat({ messages: [{ role: "user", content: longContent }] })
    ).rejects.toThrow();
  });

  it("rejects invalid role values", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.chat({
        messages: [{ role: "system" as any, content: "hack" }],
      })
    ).rejects.toThrow();
  });

  it("handles LLM errors gracefully", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockRejectedValueOnce(new Error("LLM unavailable"));

    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет" }],
    });

    expect(result).toHaveProperty("reply");
    expect(result.reply).toContain("пошло не так");
  });

  it("handles empty LLM response gracefully", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет" }],
    });

    expect(result).toHaveProperty("reply");
    expect(result.reply).toContain("технические трудности");
  });

  it("is accessible as a public procedure (no auth required)", async () => {
    const ctx = createPublicContext();
    expect(ctx.user).toBeNull();

    const caller = faqChatRouter.createCaller(ctx);
    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет!" }],
    });

    expect(result).toHaveProperty("reply");
  });
});

describe("faqChat.analytics", () => {
  it("is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.analytics();

    expect(result).toHaveProperty("recent");
    expect(result).toHaveProperty("stats");
    expect(result.stats).toHaveProperty("totalCount");
    expect(result.stats).toHaveProperty("periodCount");
    expect(result.stats).toHaveProperty("uniqueSessions");
    expect(result.stats).toHaveProperty("sourceBreakdown");
    expect(result.stats).toHaveProperty("dailyStats");
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.analytics()).rejects.toThrow("FORBIDDEN");
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.analytics()).rejects.toThrow();
  });
});

describe("faqChat.clearOld", () => {
  it("is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.clearOld({ olderThanDays: 30 });

    expect(result).toHaveProperty("success", true);
    expect(result.message).toContain("30");
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.clearOld({ olderThanDays: 30 })).rejects.toThrow(
      "FORBIDDEN"
    );
  });

  it("validates olderThanDays range", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.clearOld({ olderThanDays: 0 })).rejects.toThrow();
    await expect(caller.clearOld({ olderThanDays: 366 })).rejects.toThrow();
  });
});

describe("FAQ page structure", () => {
  it("FAQ route is registered in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appContent).toContain('path="/faq"');
    expect(appContent).toContain("FAQ");
  });

  it("FAQ page component exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("client/src/pages/FAQ.tsx")).toBe(true);
  });

  it("FAQ link is in the Navbar", async () => {
    const fs = await import("fs");
    const navContent = fs.readFileSync(
      "client/src/components/Navbar.tsx",
      "utf-8"
    );
    expect(navContent).toContain("/faq");
    expect(navContent).toContain("FAQ");
  });

  it("FAQ page includes Masha chat component", async () => {
    const fs = await import("fs");
    const faqContent = fs.readFileSync("client/src/pages/FAQ.tsx", "utf-8");
    expect(faqContent).toContain("MashaChat");
    expect(faqContent).toContain("faqChat.chat");
  });

  it("FAQ page includes accordion sections with categories", async () => {
    const fs = await import("fs");
    const faqContent = fs.readFileSync("client/src/pages/FAQ.tsx", "utf-8");
    expect(faqContent).toContain("О персональном фермерстве");
    expect(faqContent).toContain("Животные и породы");
    expect(faqContent).toContain("Продукты и доставка");
    expect(faqContent).toContain("Клуб владельцев");
    expect(faqContent).toContain("Стоимость и оплата");
    expect(faqContent).toContain("Безопасность и качество");
  });

  it("faqChat router is integrated in appRouter", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    expect(routersContent).toContain("faqChat: faqChatRouter");
    expect(routersContent).toContain("faqChatRouter");
  });
});

describe("Floating Masha chat widget", () => {
  it("MashaFloatingChat component exists", async () => {
    const fs = await import("fs");
    expect(
      fs.existsSync("client/src/components/MashaFloatingChat.tsx")
    ).toBe(true);
  });

  it("MashaFloatingChat is imported in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appContent).toContain("MashaFloatingChat");
    expect(appContent).toContain("<MashaFloatingChat />");
  });

  it("MashaFloatingChat hides on /faq page", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain('/faq"');
    expect(content).toContain("return null");
  });

  it("MashaFloatingChat uses source 'floating' for analytics", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain('source: "floating"');
  });

  it("MashaFloatingChat includes sessionId for analytics tracking", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("sessionId");
    expect(content).toContain("floating-");
  });

  it("MashaFloatingChat supports mobile full-screen mode", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    // Mobile: inset-0 for full-screen, sm:inset-auto for desktop panel
    expect(content).toContain("inset-0");
    expect(content).toContain("sm:inset-auto");
  });

  it("MashaFloatingChat has context-aware suggested prompts", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    // Should have page-specific prompts
    expect(content).toContain("PAGE_PROMPTS");
    expect(content).toContain("/animals");
    expect(content).toContain("/marketplace");
    expect(content).toContain("/club");
    expect(content).toContain("/dashboard");
  });

  it("MashaFloatingChat sends userName for personalization", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("userName");
    expect(content).toContain("useAuth");
  });

  it("MashaFloatingChat sends currentPage for context", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("currentPage");
    expect(content).toContain("location");
  });

  it("MashaFloatingChat asks for name if user is not authenticated", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("Как я могу к вам обращаться");
  });
});

describe("Admin FAQ Analytics page", () => {
  it("AdminFaqAnalytics page component exists", async () => {
    const fs = await import("fs");
    expect(fs.existsSync("client/src/pages/AdminFaqAnalytics.tsx")).toBe(true);
  });

  it("AdminFaqAnalytics route is registered in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync("client/src/App.tsx", "utf-8");
    expect(appContent).toContain('path="/admin/faq-analytics"');
    expect(appContent).toContain("AdminFaqAnalytics");
  });

  it("AdminFaqAnalytics is linked from AdminHub", async () => {
    const fs = await import("fs");
    const hubContent = fs.readFileSync(
      "client/src/pages/AdminHub.tsx",
      "utf-8"
    );
    expect(hubContent).toContain("/admin/faq-analytics");
    expect(hubContent).toContain("FAQ аналитика");
  });

  it("AdminFaqAnalytics uses DashboardLayout", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("DashboardLayout");
  });

  it("AdminFaqAnalytics calls faqChat.analytics", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("faqChat.analytics");
  });

  it("AdminFaqAnalytics displays key metrics", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("totalCount");
    expect(content).toContain("periodCount");
    expect(content).toContain("uniqueSessions");
    expect(content).toContain("sourceBreakdown");
  });

  it("AdminFaqAnalytics has clearOld functionality", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("clearOld");
  });
});

describe("FAQ analytics DB schema", () => {
  it("faqQuestions table is defined in schema", async () => {
    const fs = await import("fs");
    const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schemaContent).toContain("faqQuestions");
    expect(schemaContent).toContain("question");
    expect(schemaContent).toContain("answer");
    expect(schemaContent).toContain("sessionId");
    expect(schemaContent).toContain("source");
  });
});

describe("Backend personalization support", () => {
  it("faqChat.chat input schema accepts userName", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("userName: z.string()");
  });

  it("faqChat.chat input schema accepts currentPage", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("currentPage: z.string()");
  });

  it("system prompt is personalized with userName when provided", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("input.userName");
    expect(content).toContain("Обращайся к нему/ней по имени");
  });

  it("system prompt includes currentPage context when provided", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("input.currentPage");
    expect(content).toContain("Учитывай это в контексте ответов");
  });
});

/* ─── Feature: CSV Export ─── */
describe("faqChat.exportCsv", () => {
  it("is accessible by admin users and returns CSV string", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv();

    expect(result).toHaveProperty("csv");
    expect(typeof result.csv).toBe("string");
    // Should have BOM + header
    expect(result.csv).toContain("\uFEFF");
    expect(result.csv).toContain("ID,Дата,Вопрос,Ответ,Источник,Session ID,User OpenID");
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.exportCsv()).rejects.toThrow("FORBIDDEN");
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.exportCsv()).rejects.toThrow();
  });
});

describe("CSV export UI integration", () => {
  it("AdminFaqAnalytics has CSV export button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("exportCsv");
    expect(content).toContain("Экспорт CSV");
    expect(content).toContain("Download");
  });

  it("CSV export creates a downloadable blob", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Blob");
    expect(content).toContain("text/csv");
    expect(content).toContain("createObjectURL");
    expect(content).toContain(".csv");
  });
});

/* ─── Feature: Uncertainty Detection & Owner Notifications ─── */
describe("Uncertainty detection and owner notifications", () => {
  it("faqChat router imports notifyOwner", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("notifyOwner");
    expect(content).toContain("../_core/notification");
  });

  it("defines UNCERTAIN_PHRASES array", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("UNCERTAIN_PHRASES");
    expect(content).toContain("не знаю");
    expect(content).toContain("не уверена");
    expect(content).toContain("затрудняюсь");
  });

  it("has isUncertainAnswer function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("function isUncertainAnswer");
    expect(content).toContain("toLowerCase");
  });

  it("has notifyUncertainAnswer function", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("async function notifyUncertainAnswer");
    expect(content).toContain("Маша не смогла уверенно ответить");
  });

  it("checks uncertainty after LLM response", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("isUncertainAnswer(content)");
    expect(content).toContain("notifyUncertainAnswer");
  });

  it("returns uncertain flag in chat response", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.chat({
      messages: [{ role: "user", content: "Привет" }],
    });

    expect(result).toHaveProperty("uncertain");
    expect(typeof result.uncertain).toBe("boolean");
  });
});

/* ─── Feature: A/B Testing for Greeting Variants ─── */
describe("A/B testing DB schema", () => {
  it("greetingVariants table is defined in schema", async () => {
    const fs = await import("fs");
    const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schemaContent).toContain("greetingVariants");
    expect(schemaContent).toContain("variantKey");
    expect(schemaContent).toContain("greetingText");
    expect(schemaContent).toContain("isActive");
  });

  it("abTestSessions table is defined in schema", async () => {
    const fs = await import("fs");
    const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schemaContent).toContain("abTestSessions");
    expect(schemaContent).toContain("variantKey");
    expect(schemaContent).toContain("didRespond");
    expect(schemaContent).toContain("messageCount");
    expect(schemaContent).toContain("durationSeconds");
  });
});

describe("A/B testing backend procedures", () => {
  it("getGreetingVariant procedure exists and returns default when no variants", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.getGreetingVariant({
      sessionId: "test-ab-session-1",
      source: "floating",
    });

    expect(result).toHaveProperty("variantKey");
    expect(result).toHaveProperty("greetingText");
    expect(typeof result.variantKey).toBe("string");
    expect(typeof result.greetingText).toBe("string");
  });

  it("trackAbEngagement procedure exists", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.trackAbEngagement({
      sessionId: "test-ab-session-1",
      didRespond: true,
      messageCount: 5,
      durationSeconds: 120,
    });

    expect(result).toHaveProperty("success");
  });

  it("abTestResults is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.abTestResults();

    expect(result).toHaveProperty("variants");
    expect(result).toHaveProperty("totalSessions");
    expect(Array.isArray(result.variants)).toBe(true);
  });

  it("abTestResults rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.abTestResults()).rejects.toThrow("FORBIDDEN");
  });

  it("upsertGreetingVariant is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.upsertGreetingVariant({
      variantKey: "test_variant",
      greetingText: "Тестовое приветствие",
      description: "Тестовый вариант",
    });

    expect(result).toHaveProperty("success", true);
  });

  it("upsertGreetingVariant rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.upsertGreetingVariant({
        variantKey: "test_variant",
        greetingText: "Тестовое приветствие",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("toggleGreetingVariant is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.toggleGreetingVariant({
      variantKey: "test_variant",
      isActive: false,
    });

    expect(result).toHaveProperty("success", true);
  });

  it("toggleGreetingVariant rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.toggleGreetingVariant({
        variantKey: "test_variant",
        isActive: false,
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("A/B testing frontend integration", () => {
  it("MashaFloatingChat integrates A/B greeting variant", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("getGreetingVariant");
    expect(content).toContain("greetingQuery");
    expect(content).toContain("greetingText");
  });

  it("MashaFloatingChat tracks engagement metrics", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("trackAbEngagement");
    expect(content).toContain("trackEngagement");
    expect(content).toContain("userMessageCount");
    expect(content).toContain("chatStartTime");
    expect(content).toContain("durationSeconds");
  });

  it("MashaFloatingChat tracks engagement on close", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/components/MashaFloatingChat.tsx",
      "utf-8"
    );
    expect(content).toContain("handleClose");
    expect(content).toContain("trackEngagement.mutate");
  });

  it("AdminFaqAnalytics displays A/B testing section", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("abTestResults");
    expect(content).toContain("A/B Тестирование приветствий");
    expect(content).toContain("FlaskConical");
  });

  it("AdminFaqAnalytics has variant toggle functionality", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("toggleGreetingVariant");
    expect(content).toContain("toggleVariant");
    expect(content).toContain("ToggleRight");
    expect(content).toContain("ToggleLeft");
  });

  it("AdminFaqAnalytics shows variant metrics (sessions, messages, duration)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("totalSessions");
    expect(content).toContain("avgMessageCount");
    expect(content).toContain("avgDuration");
    expect(content).toContain("responseRate");
  });

  it("AdminFaqAnalytics shows leader variant summary", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Лидер");
    expect(content).toContain("responseRate");
  });
});

/* ─── Feature: Admin Greeting Variant Management ─── */
describe("faqChat.deleteGreetingVariant", () => {
  it("is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.deleteGreetingVariant({
      variantKey: "test_variant",
    });

    expect(result).toHaveProperty("success", true);
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.deleteGreetingVariant({ variantKey: "test_variant" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.deleteGreetingVariant({ variantKey: "test_variant" })
    ).rejects.toThrow();
  });

  it("validates variantKey is not empty", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.deleteGreetingVariant({ variantKey: "" })
    ).rejects.toThrow();
  });
});

describe("Admin variant management UI", () => {
  it("AdminFaqAnalytics has create variant button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Новый вариант");
    expect(content).toContain("openCreateVariant");
    expect(content).toContain("Plus");
  });

  it("AdminFaqAnalytics has variant edit button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("openEditVariant");
    expect(content).toContain("Edit3");
    expect(content).toContain("Редактировать");
  });

  it("AdminFaqAnalytics has variant delete button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("deleteGreetingVariant");
    expect(content).toContain("deleteVariant");
  });

  it("AdminFaqAnalytics has variant creation/edit dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("variantDialogOpen");
    expect(content).toContain("variantForm");
    expect(content).toContain("Ключ варианта");
    expect(content).toContain("Текст приветствия");
    expect(content).toContain("upsertGreetingVariant");
  });

  it("AdminFaqAnalytics has editingVariant state for edit mode", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("editingVariant");
    expect(content).toContain("Редактировать вариант");
    expect(content).toContain("Новый вариант приветствия");
  });
});

/* ─── Feature: CSV Export with Date/Source Filters ─── */
describe("faqChat.exportCsv with filters", () => {
  it("accepts dateFrom filter", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv({ dateFrom: "2025-01-01" });

    expect(result).toHaveProperty("csv");
    expect(typeof result.csv).toBe("string");
  });

  it("accepts dateTo filter", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv({ dateTo: "2025-12-31" });

    expect(result).toHaveProperty("csv");
  });

  it("accepts source filter 'faq'", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv({ source: "faq" });

    expect(result).toHaveProperty("csv");
  });

  it("accepts source filter 'floating'", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv({ source: "floating" });

    expect(result).toHaveProperty("csv");
  });

  it("accepts source filter 'all'", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv({ source: "all" });

    expect(result).toHaveProperty("csv");
  });

  it("accepts combined dateFrom + dateTo + source filters", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv({
      dateFrom: "2025-01-01",
      dateTo: "2025-06-30",
      source: "floating",
    });

    expect(result).toHaveProperty("csv");
    expect(result.csv).toContain("\uFEFF");
  });

  it("works without any filters (backward compatible)", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.exportCsv();

    expect(result).toHaveProperty("csv");
  });
});

describe("CSV filter UI integration", () => {
  it("AdminFaqAnalytics has CSV filter panel", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("csvFiltersOpen");
    expect(content).toContain("csvDateFrom");
    expect(content).toContain("csvDateTo");
    expect(content).toContain("csvSource");
    expect(content).toContain("Filter");
  });

  it("AdminFaqAnalytics has source select dropdown", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Все источники");
    expect(content).toContain("Виджет");
    expect(content).toContain("Страница FAQ");
    expect(content).toContain("SelectItem");
  });

  it("AdminFaqAnalytics has filter reset button", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Сбросить");
    expect(content).toContain("hasActiveFilters");
  });

  it("AdminFaqAnalytics passes filter input to exportCsv query", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("csvFilterInput");
    expect(content).toContain("exportCsv.useQuery(csvFilterInput");
  });
});

/* ─── Feature: Uncertain Answers History ─── */
describe("uncertainAnswers DB schema", () => {
  it("uncertainAnswers table is defined in schema", async () => {
    const fs = await import("fs");
    const schemaContent = fs.readFileSync("drizzle/schema.ts", "utf-8");
    expect(schemaContent).toContain("uncertainAnswers");
    expect(schemaContent).toContain("question");
    expect(schemaContent).toContain("answer");
    expect(schemaContent).toContain("resolved");
    expect(schemaContent).toContain("adminNote");
    expect(schemaContent).toContain("resolvedAt");
  });
});

describe("faqChat.uncertainAnswersList", () => {
  it("is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.uncertainAnswersList();

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("unresolvedCount");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.uncertainAnswersList()).rejects.toThrow("FORBIDDEN");
  });

  it("accepts resolved filter", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.uncertainAnswersList({ resolved: false });

    expect(result).toHaveProperty("items");
  });

  it("accepts limit parameter", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.uncertainAnswersList({ limit: 10 });

    expect(result).toHaveProperty("items");
  });
});

describe("faqChat.resolveUncertainAnswer", () => {
  it("is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.resolveUncertainAnswer({
      id: 1,
      resolved: true,
      adminNote: "Добавлено в базу знаний",
    });

    expect(result).toHaveProperty("success", true);
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.resolveUncertainAnswer({ id: 1, resolved: true })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("accepts resolve without admin note", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.resolveUncertainAnswer({
      id: 1,
      resolved: true,
    });

    expect(result).toHaveProperty("success", true);
  });

  it("can unresolve an answer", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.resolveUncertainAnswer({
      id: 1,
      resolved: false,
    });

    expect(result).toHaveProperty("success", true);
  });
});

describe("faqChat.deleteUncertainAnswer", () => {
  it("is accessible by admin users", async () => {
    const ctx = createAdminContext();
    const caller = faqChatRouter.createCaller(ctx);

    const result = await caller.deleteUncertainAnswer({ id: 1 });

    expect(result).toHaveProperty("success", true);
  });

  it("rejects non-admin users", async () => {
    const ctx = createUserContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.deleteUncertainAnswer({ id: 1 })
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("Uncertain answers UI integration", () => {
  it("AdminFaqAnalytics has uncertain answers section", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Неуверенные ответы Маши");
    expect(content).toContain("AlertTriangle");
    expect(content).toContain("uncertainAnswersList");
  });

  it("AdminFaqAnalytics has uncertain answers filter tabs", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("uncertainFilter");
    expect(content).toContain("Открытые");
    expect(content).toContain("Решённые");
  });

  it("AdminFaqAnalytics has resolve functionality", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("resolveUncertainAnswer");
    expect(content).toContain("resolveUncertain");
    expect(content).toContain("Отметить как решённое");
  });

  it("AdminFaqAnalytics has admin note dialog", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("noteDialogOpen");
    expect(content).toContain("adminNote");
    expect(content).toContain("Заметка");
    expect(content).toContain("Textarea");
  });

  it("AdminFaqAnalytics has delete uncertain answer functionality", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("deleteUncertainAnswer");
    expect(content).toContain("deleteUncertain");
  });

  it("AdminFaqAnalytics shows unresolved count", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("unresolvedCount");
    expect(content).toContain("totalCount");
  });

  it("AdminFaqAnalytics has undo resolve functionality", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "client/src/pages/AdminFaqAnalytics.tsx",
      "utf-8"
    );
    expect(content).toContain("Вернуть в открытые");
    expect(content).toContain("Undo2");
    expect(content).toContain("resolved: false");
  });
});

describe("notifyUncertainAnswer saves to DB", () => {
  it("notifyUncertainAnswer inserts into uncertainAnswers table", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "server/routers/faqChat.ts",
      "utf-8"
    );
    expect(content).toContain("db.insert(uncertainAnswers)");
    expect(content).toContain("question,");
    expect(content).toContain("answer,");
    expect(content).toContain("source,");
    expect(content).toContain("sessionId,");
  });
});
