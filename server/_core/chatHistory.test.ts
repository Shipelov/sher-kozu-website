import { describe, expect, it } from "vitest";
import { chatHistoryLength, chatMessageLength, compactChatHistory } from "./chatHistory";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const msg = (role: Msg["role"], content: string): Msg => ({ role, content });

describe("compactChatHistory", () => {
  it("returns an empty array for empty input", () => {
    expect(compactChatHistory([])).toEqual([]);
  });

  it("keeps everything when limits are not set", () => {
    const messages = [msg("system", "s"), msg("user", "a"), msg("assistant", "b"), msg("user", "c")];
    expect(compactChatHistory(messages)).toEqual(messages);
  });

  it("keeps only the first system message and the newest history by count", () => {
    const messages: Msg[] = [
      msg("system", "first system"),
      msg("system", "second system"),
      ...Array.from({ length: 10 }, (_, i) => msg(i % 2 ? "assistant" : "user", `m${i}`)),
    ];
    const compacted = compactChatHistory(messages, { maxMessages: 3 });
    expect(compacted.map((m) => m.content)).toEqual(["first system", "m7", "m8", "m9"]);
  });

  it("limits history by characters but always keeps the last message", () => {
    const messages: Msg[] = [
      msg("system", "sys"),
      msg("assistant", "old"),
      msg("user", "x".repeat(8_000)),
    ];
    const compacted = compactChatHistory(messages, { maxChars: 1_000 });
    expect(compacted).toHaveLength(2);
    expect(compacted.at(-1)?.content).toHaveLength(8_000);
  });

  it("pins the first user message when keepFirstUserMessage is set", () => {
    const messages: Msg[] = [
      msg("user", "first"),
      msg("assistant", "a".repeat(500)),
      msg("user", "b".repeat(500)),
      msg("assistant", "c".repeat(500)),
      msg("user", "last"),
    ];
    const compacted = compactChatHistory(messages, { maxChars: 600, keepFirstUserMessage: true });
    expect(compacted.map((m) => m.content)).toEqual(["first", "c".repeat(500), "last"]);
  });

  it("does not duplicate the first user message when it is also the last", () => {
    const messages: Msg[] = [msg("user", "only")];
    expect(compactChatHistory(messages, { maxChars: 1, keepFirstUserMessage: true })).toEqual(messages);
  });

  it("counts the pinned message toward the message limit", () => {
    const messages: Msg[] = [
      msg("user", "first"),
      msg("assistant", "a1"),
      msg("user", "u2"),
      msg("assistant", "a2"),
      msg("user", "u3"),
    ];
    const compacted = compactChatHistory(messages, { maxMessages: 3, keepFirstUserMessage: true });
    expect(compacted.map((m) => m.content)).toEqual(["first", "a2", "u3"]);
  });

  it("keeps the pinned message and the last one even when together they exceed the budget", () => {
    const messages: Msg[] = [
      msg("user", "f".repeat(700)),
      msg("assistant", "mid"),
      msg("user", "l".repeat(700)),
    ];
    const compacted = compactChatHistory(messages, { maxChars: 1_000, keepFirstUserMessage: true });
    expect(compacted.map((m) => m.content[0])).toEqual(["f", "l"]);
  });
});

describe("chatMessageLength / chatHistoryLength", () => {
  it("measures string content by length and structured content by JSON size", () => {
    expect(chatMessageLength({ role: "user", content: "abc" })).toBe(3);
    expect(chatMessageLength({ role: "user", content: [{ type: "text", text: "hi" }] })).toBe(
      JSON.stringify([{ type: "text", text: "hi" }]).length,
    );
    expect(chatHistoryLength([msg("user", "ab"), msg("assistant", "cde")])).toBe(5);
  });
});
