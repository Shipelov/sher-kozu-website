/**
 * Tests for chat history auto-trim at 30 messages and character counter.
 *
 * Verifies:
 * - Server validates max 30 messages
 * - Server validates max 10000 chars per message
 * - Client-side trimMessages keeps greeting + most recent messages
 * - Character counter appears at threshold
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const floatingChatSrc = readFileSync(
  resolve(__dirname, "../client/src/components/MashaFloatingChat.tsx"),
  "utf-8",
);

const faqPageSrc = readFileSync(
  resolve(__dirname, "../client/src/pages/FAQ.tsx"),
  "utf-8",
);

// Схема входа faqChat.chat объявлена в assistants/mashaChat.ts (общая с SSE)
const faqChatRouterSrc = readFileSync(
  resolve(__dirname, "assistants/mashaChat.ts"),
  "utf-8",
);

describe("Chat history auto-trim and character limits", () => {
  describe("Server-side validation", () => {
    it("limits messages array to max 30", () => {
      expect(faqChatRouterSrc).toContain(".max(30)");
    });

    it("limits individual message content to max 10000 chars", () => {
      expect(faqChatRouterSrc).toContain(".max(10000)");
    });
  });

  describe("MashaFloatingChat: trimMessages function", () => {
    it("defines MAX_MESSAGES = 30", () => {
      expect(floatingChatSrc).toContain("const MAX_MESSAGES = 30");
    });

    it("defines MAX_CHARS = 10000", () => {
      expect(floatingChatSrc).toContain("const MAX_CHARS = 10000");
    });

    it("defines CHAR_WARNING_THRESHOLD = 8000", () => {
      expect(floatingChatSrc).toContain("const CHAR_WARNING_THRESHOLD = 8000");
    });

    it("has a trimMessages function that keeps first + last messages", () => {
      expect(floatingChatSrc).toContain("function trimMessages(");
      expect(floatingChatSrc).toContain("msgs[0]");
      expect(floatingChatSrc).toContain("msgs.slice(-(max - 1))");
    });

    it("calls trimMessages before sending to server", () => {
      expect(floatingChatSrc).toContain("trimMessages(updated, MAX_MESSAGES)");
      expect(floatingChatSrc).toContain("setMessages(trimmed)");
      expect(floatingChatSrc).toContain("messages: trimmed,");
    });

    it("enforces maxLength on textarea input", () => {
      expect(floatingChatSrc).toContain("maxLength={MAX_CHARS}");
    });

    it("shows character counter when approaching limit", () => {
      expect(floatingChatSrc).toContain("input.length >= CHAR_WARNING_THRESHOLD");
      expect(floatingChatSrc).toContain("{input.length}/{MAX_CHARS}");
    });

    it("shows destructive color when near max", () => {
      expect(floatingChatSrc).toContain("input.length >= MAX_CHARS * 0.95");
      expect(floatingChatSrc).toContain("text-destructive");
    });
  });

  describe("FAQ page MashaChat: trimming and limits", () => {
    it("defines FAQ_MAX_MESSAGES = 30", () => {
      expect(faqPageSrc).toContain("const FAQ_MAX_MESSAGES = 30");
    });

    it("defines FAQ_MAX_CHARS = 10000", () => {
      expect(faqPageSrc).toContain("const FAQ_MAX_CHARS = 10000");
    });

    it("has a trimFaqMessages function", () => {
      expect(faqPageSrc).toContain("function trimFaqMessages(");
    });

    it("calls trimFaqMessages before sending to server", () => {
      expect(faqPageSrc).toContain("trimFaqMessages(updated, FAQ_MAX_MESSAGES)");
      expect(faqPageSrc).toContain("setMessages(trimmed)");
      expect(faqPageSrc).toContain("messages: trimmed");
    });

    it("enforces maxLength on textarea input", () => {
      expect(faqPageSrc).toContain("maxLength={FAQ_MAX_CHARS}");
    });

    it("shows character counter when approaching limit", () => {
      expect(faqPageSrc).toContain("input.length >= FAQ_CHAR_WARNING_THRESHOLD");
      expect(faqPageSrc).toContain("{input.length}/{FAQ_MAX_CHARS}");
    });
  });

  describe("trimMessages logic (unit)", () => {
    // Inline the function for direct testing
    function trimMessages(
      msgs: { role: string; content: string }[],
      max: number,
    ) {
      if (msgs.length <= max) return msgs;
      return [msgs[0], ...msgs.slice(-(max - 1))];
    }

    it("returns messages unchanged when under limit", () => {
      const msgs = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg ${i}`,
      }));
      expect(trimMessages(msgs, 30)).toHaveLength(10);
    });

    it("trims to exactly max, keeping first and last messages", () => {
      const msgs = Array.from({ length: 40 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg ${i}`,
      }));
      const trimmed = trimMessages(msgs, 30);
      expect(trimmed).toHaveLength(30);
      // First message (greeting) is preserved
      expect(trimmed[0].content).toBe("msg 0");
      // Last message is the most recent
      expect(trimmed[29].content).toBe("msg 39");
    });

    it("preserves the greeting message (index 0) even after heavy trimming", () => {
      const msgs = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg ${i}`,
      }));
      const trimmed = trimMessages(msgs, 30);
      expect(trimmed[0].content).toBe("msg 0");
      expect(trimmed[trimmed.length - 1].content).toBe("msg 99");
    });
  });
});
