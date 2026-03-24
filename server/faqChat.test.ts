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

  it("rejects empty messages array", async () => {
    const ctx = createPublicContext();
    const caller = faqChatRouter.createCaller(ctx);

    await expect(
      caller.chat({ messages: [] })
    ).rejects.toThrow();
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
