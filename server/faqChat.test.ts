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
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        // select().from() without where — used for totalCount: const [totalResult] = await db.select(...).from(...)
        then: (resolve: any) => resolve([{ count: 0 }]),
        [Symbol.iterator]: function* () { yield { count: 0 }; },
        where: vi.fn().mockReturnValue({
          // select().from().where() without chaining — used for periodCount/uniqueSessions
          then: (resolve: any) => resolve([{ count: 0 }]),
          [Symbol.iterator]: function* () { yield { count: 0 }; },
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            then: (resolve: any) => resolve([]),
            [Symbol.iterator]: function* () {},
          }),
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
            then: (resolve: any) => resolve([]),
            [Symbol.iterator]: function* () {},
          }),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    }),
  }),
}));

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

  it("rejects empty messages array", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(caller.chat({ messages: [] })).rejects.toThrow();
  });

  it("rejects message content exceeding 2000 characters", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    const longContent = "a".repeat(2001);
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
