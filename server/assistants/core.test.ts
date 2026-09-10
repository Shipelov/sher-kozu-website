import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const invokeLLMMock = vi.hoisted(() => vi.fn());
const invokeLLMStreamMock = vi.hoisted(() => vi.fn());

vi.mock("../_core/llm", () => ({
  invokeLLM: invokeLLMMock,
  invokeLLMStream: invokeLLMStreamMock,
}));

import {
  DEFAULT_HISTORY_MAX_MESSAGES,
  LLM_REQUEST_WARN_BYTES,
  estimateRequestBytes,
  STREAM_TOOL_ROUND_MAX_TOKENS,
  createToolDefiner,
  flattenToolHistory,
  runAssistant,
  toolsToLlmSpec,
} from "./core";
import type { Message } from "../_core/llm";

type Ctx = { userOpenId: string | null };
const tool = createToolDefiner<Ctx>();

const textResponse = (content: string, finish_reason = "stop") => ({
  id: "r",
  created: 0,
  model: "claude-sonnet",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const toolCallResponse = (calls: Array<{ id: string; name: string; args: string }>, content = "") => ({
  id: "r",
  created: 0,
  model: "claude-sonnet",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content,
        tool_calls: calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.args } })),
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function lastCallMessages(): Message[] {
  const call = invokeLLMMock.mock.calls.at(-1)?.[0] as { messages: Message[] } | undefined;
  return call?.messages ?? [];
}

beforeEach(() => {
  invokeLLMMock.mockReset();
  invokeLLMStreamMock.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("toolsToLlmSpec", () => {
  it("converts zod schemas to JSON Schema without $schema", () => {
    const spec = toolsToLlmSpec([
      tool({
        name: "get_animal",
        description: "profile",
        inputSchema: z.object({ slug: z.string().describe("slug"), percent: z.union([z.literal(50), z.literal(100)]).optional() }),
        handler: () => null,
      }),
    ]);
    expect(spec[0].type).toBe("function");
    expect(spec[0].function.name).toBe("get_animal");
    const parameters = spec[0].function.parameters as Record<string, unknown>;
    expect(parameters.$schema).toBeUndefined();
    expect(parameters.type).toBe("object");
    expect(parameters.required).toEqual(["slug"]);
  });
});

describe("runAssistant", () => {
  it("executes a tool call with validated args and feeds the result back to the model", async () => {
    const handler = vi.fn(async (args: { slug: string }, ctx: Ctx) => ({ slug: args.slug, viewer: ctx.userOpenId }));
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([{ id: "c1", name: "get_animal", args: '{"slug":"rufa"}' }]))
      .mockResolvedValueOnce(textResponse("Руфа — овца Лакон."));

    const result = await runAssistant<Ctx>({
      systemPrompt: "sys",
      tools: [tool({ name: "get_animal", description: "", inputSchema: z.object({ slug: z.string() }), handler })],
      messages: [{ role: "user", content: "кто такая Руфа" }],
      ctx: { userOpenId: "u1" },
    });

    expect(handler).toHaveBeenCalledWith({ slug: "rufa" }, { userOpenId: "u1" });
    expect(result.text).toBe("Руфа — овца Лакон.");
    expect(result.finishedBy).toBe("model");
    expect(result.rounds).toBe(2);
    expect(result.toolTrace).toEqual([expect.objectContaining({ name: "get_animal", ok: true, args: { slug: "rufa" } })]);
    expect(result.usage).toEqual({ promptTokens: 30, completionTokens: 13, totalTokens: 43, llmCalls: 2 });

    const firstCall = invokeLLMMock.mock.calls[0][0] as { tools: unknown[]; toolChoice: string };
    expect(firstCall.tools).toHaveLength(1);
    expect(firstCall.toolChoice).toBe("auto");

    const messages = lastCallMessages();
    expect(messages[0]).toEqual({ role: "system", content: "sys" });
    expect(messages[2]).toMatchObject({ role: "assistant", tool_calls: [expect.objectContaining({ id: "c1" })] });
    expect(messages[3]).toMatchObject({ role: "tool", tool_call_id: "c1", name: "get_animal" });
    expect(JSON.parse(String(messages[3].content))).toEqual({ slug: "rufa", viewer: "u1" });
  });

  it("runs several tool calls of one round in parallel", async () => {
    const starts: number[] = [];
    const slow = tool({
      name: "slow",
      description: "",
      inputSchema: z.object({ n: z.number() }),
      handler: async ({ n }) => {
        starts.push(Date.now());
        await sleep(60);
        return { n };
      },
    });
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([
        { id: "a", name: "slow", args: '{"n":1}' },
        { id: "b", name: "slow", args: '{"n":2}' },
      ]))
      .mockResolvedValueOnce(textResponse("ok"));

    const startedAt = Date.now();
    const result = await runAssistant<Ctx>({ systemPrompt: "s", tools: [slow], messages: [{ role: "user", content: "go" }], ctx: { userOpenId: null } });

    expect(result.toolTrace.map((entry) => entry.ok)).toEqual([true, true]);
    expect(Math.abs(starts[1] - starts[0])).toBeLessThan(40);
    expect(Date.now() - startedAt).toBeLessThan(150);
  });

  it("returns tool failures to the model as {error} instead of throwing", async () => {
    const onToolCall = vi.fn();
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([{ id: "c1", name: "boom", args: "{}" }]))
      .mockResolvedValueOnce(textResponse("Сейчас не могу проверить, но расскажу общее."));

    const result = await runAssistant<Ctx>({
      systemPrompt: "s",
      tools: [tool({ name: "boom", description: "", inputSchema: z.object({}), handler: async () => { throw new Error("db down"); } })],
      messages: [{ role: "user", content: "?" }],
      ctx: { userOpenId: null },
      onToolCall,
    });

    expect(result.text).toContain("расскажу общее");
    expect(result.toolTrace[0]).toMatchObject({ name: "boom", ok: false, error: "db down" });
    expect(JSON.parse(String(lastCallMessages()[3].content))).toEqual({ error: "db down" });
    expect(onToolCall).toHaveBeenCalledWith("boom", {}, { error: "db down" });
  });

  it("times out a slow tool and continues the dialogue", async () => {
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([{ id: "c1", name: "hang", args: "{}" }]))
      .mockResolvedValueOnce(textResponse("ответ"));

    const result = await runAssistant<Ctx>({
      systemPrompt: "s",
      tools: [tool({ name: "hang", description: "", inputSchema: z.object({}), handler: () => sleep(500).then(() => "late") })],
      messages: [{ role: "user", content: "?" }],
      ctx: { userOpenId: null },
      toolTimeoutMs: 30,
    });

    expect(result.text).toBe("ответ");
    expect(result.toolTrace[0].ok).toBe(false);
    expect(result.toolTrace[0].error).toContain("timeout after 30ms");
  });

  it("reports unknown tools, invalid JSON and schema violations as tool errors", async () => {
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([
        { id: "u", name: "nope", args: "{}" },
        { id: "j", name: "echo", args: "{not json" },
        { id: "v", name: "echo", args: '{"text":42}' },
      ]))
      .mockResolvedValueOnce(textResponse("ok"));

    const result = await runAssistant<Ctx>({
      systemPrompt: "s",
      tools: [tool({ name: "echo", description: "", inputSchema: z.object({ text: z.string() }), handler: ({ text }) => text })],
      messages: [{ role: "user", content: "?" }],
      ctx: { userOpenId: null },
    });

    const errors = result.toolTrace.map((entry) => entry.error ?? "");
    expect(errors[0]).toContain('unknown tool "nope"');
    expect(errors[1]).toContain("invalid JSON");
    expect(errors[2]).toContain("invalid arguments");
    expect(result.text).toBe("ok");
  });

  it("stops after maxToolRounds and answers without tools on flattened history", async () => {
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([{ id: "1", name: "echo", args: '{"text":"a"}' }]))
      .mockResolvedValueOnce(toolCallResponse([{ id: "2", name: "echo", args: '{"text":"b"}' }]))
      .mockResolvedValueOnce(textResponse("итог"));

    const result = await runAssistant<Ctx>({
      systemPrompt: "sys",
      tools: [tool({ name: "echo", description: "", inputSchema: z.object({ text: z.string() }), handler: ({ text }) => ({ text }) })],
      messages: [{ role: "user", content: "?" }],
      ctx: { userOpenId: null },
      maxToolRounds: 2,
    });

    expect(result.finishedBy).toBe("rounds_exhausted");
    expect(result.text).toBe("итог");
    expect(invokeLLMMock).toHaveBeenCalledTimes(3);
    const finalCall = invokeLLMMock.mock.calls[2][0] as { tools?: unknown; messages: Message[] };
    expect(finalCall.tools).toBeUndefined();
    expect(finalCall.messages.some((message) => message.role === "tool")).toBe(false);
    expect(String(finalCall.messages[0].content)).toContain('echo({"text":"a"})');
    expect(String(finalCall.messages[0].content)).toContain('{"text":"b"}');
  });

  it("streams the final answer via invokeLLMStream when the tool round was cut by length", async () => {
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([{ id: "1", name: "echo", args: '{"text":"a"}' }]))
      .mockResolvedValueOnce(textResponse("длинный ответ, обрезан", "length"));
    invokeLLMStreamMock.mockImplementation(async function* () {
      yield "Полный ";
      yield "ответ";
    });
    const chunks: string[] = [];

    const result = await runAssistant<Ctx>({
      systemPrompt: "sys",
      tools: [tool({ name: "echo", description: "", inputSchema: z.object({ text: z.string() }), handler: ({ text }) => ({ text }) })],
      messages: [{ role: "user", content: "?" }],
      ctx: { userOpenId: null },
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(["Полный ", "ответ"]);
    expect(result.text).toBe("Полный ответ");
    expect(result.finishedBy).toBe("rounds_exhausted");
    const roundCall = invokeLLMMock.mock.calls[0][0] as { maxTokens: number };
    expect(roundCall.maxTokens).toBe(STREAM_TOOL_ROUND_MAX_TOKENS);
    const streamCall = invokeLLMStreamMock.mock.calls[0][0] as { tools?: unknown; messages: Message[] };
    expect(streamCall.tools).toBeUndefined();
    expect(streamCall.messages.some((message) => message.role === "tool")).toBe(false);
  });

  it("delivers a short direct answer as a single chunk in streaming mode", async () => {
    invokeLLMMock.mockResolvedValueOnce(textResponse("Привет!"));
    const chunks: string[] = [];

    const result = await runAssistant<Ctx>({
      systemPrompt: "sys",
      tools: [tool({ name: "echo", description: "", inputSchema: z.object({}), handler: () => null })],
      messages: [{ role: "user", content: "привет" }],
      ctx: { userOpenId: null },
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(["Привет!"]);
    expect(result.text).toBe("Привет!");
    expect(invokeLLMStreamMock).not.toHaveBeenCalled();
  });

  it("compacts the history to the last messages but keeps the first user message", async () => {
    invokeLLMMock.mockResolvedValueOnce(textResponse("ok"));
    const messages = Array.from({ length: 14 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg-${index}`,
    }));

    await runAssistant<Ctx>({ systemPrompt: "sys", tools: [], messages, ctx: { userOpenId: null } });

    const sent = lastCallMessages();
    expect(sent[0].role).toBe("system");
    const history = sent.slice(1);
    expect(history.length).toBeLessThanOrEqual(DEFAULT_HISTORY_MAX_MESSAGES);
    expect(history[0].content).toBe("msg-0");
    expect(history.at(-1)?.content).toBe("msg-13");
  });

  it("does not pass tools when the tool list is empty", async () => {
    invokeLLMMock.mockResolvedValueOnce(textResponse("plain"));
    const result = await runAssistant<Ctx>({ systemPrompt: "sys", tools: [], messages: [{ role: "user", content: "?" }], ctx: { userOpenId: null } });
    expect(result.text).toBe("plain");
    const call = invokeLLMMock.mock.calls[0][0] as { tools?: unknown };
    expect(call.tools).toBeUndefined();
  });
});

describe("request size logging", () => {
  it("logs the request body size on every round and warns above the threshold", async () => {
    const big = "я".repeat(60_000); // 120 КБ в UTF-8
    invokeLLMMock
      .mockResolvedValueOnce(toolCallResponse([{ id: "1", name: "echo", args: '{"text":"a"}' }]))
      .mockResolvedValueOnce(textResponse("ok"));
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await runAssistant<Ctx>({
      systemPrompt: "sys",
      tools: [tool({ name: "echo", description: "", inputSchema: z.object({ text: z.string() }), handler: () => ({ big }) })],
      messages: [{ role: "user", content: "?" }],
      ctx: { userOpenId: null },
    });

    const infoLines = info.mock.calls.map((call) => String(call[0]));
    expect(infoLines.some((line) => /\[assistant:generic\] round=1 requestBytes=\d+$/.test(line))).toBe(true);
    const warnLines = warn.mock.calls.map((call) => String(call[0]));
    expect(warnLines.some((line) => line.includes("round=2 requestBytes=") && line.includes(String(LLM_REQUEST_WARN_BYTES)))).toBe(true);
    const round2 = Number(/round=2 requestBytes=(\d+)/.exec(warnLines.join("\n"))?.[1]);
    expect(round2).toBeGreaterThan(120_000);
  });

  it("estimates bytes in UTF-8 including tools", () => {
    const messages: Message[] = [{ role: "user", content: "яя" }];
    const withoutTools = estimateRequestBytes(messages);
    const withTools = estimateRequestBytes(messages, [{ type: "function", function: { name: "f", parameters: { type: "object" } } }]);
    expect(withoutTools).toBe(Buffer.byteLength(JSON.stringify({ messages })));
    expect(withTools).toBeGreaterThan(withoutTools);
  });
});

describe("flattenToolHistory", () => {
  it("moves tool results into the system prompt and drops tool_calls messages", () => {
    const flattened = flattenToolHistory([
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
      { role: "assistant", content: "", tool_calls: [{ id: "1", type: "function", function: { name: "list_animals", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "1", name: "list_animals", content: '{"total":2}' },
    ]);
    expect(flattened.map((message) => message.role)).toEqual(["system", "user"]);
    expect(String(flattened[0].content)).toContain("### list_animals({})");
    expect(String(flattened[0].content)).toContain('{"total":2}');
  });
});
